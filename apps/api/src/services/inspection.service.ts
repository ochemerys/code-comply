import { prisma, addendumDelegateOf, type AddendumRow } from '@codecomply/db'
import type { PermitInspection, Prisma } from '@codecomply/db'
import crypto from 'node:crypto'
import {
  AUDIT_ACTION,
  AUDIT_ENTITY,
  auditLogService,
  inspectionPayloadForAudit,
} from './audit-log.service.js'
import { assertInspectionMutable, isInspectionFinalized } from '../middleware/immutable.js'

/**
 * GPS Coordinates DTO
 */
export interface GPSCoordinates {
  latitude: number
  longitude: number
  accuracy?: number
  timestamp: string
}

export interface InspectionFinalizeInput {
  finalizedAt?: string
  finalizeGps: GPSCoordinates
  outcome: 'PASSED' | 'FAILED'
  signature: string
  certificationSnapshot: Prisma.InputJsonValue
}

export type UpdateInspectionInput = {
  notes?: string
  scheduledDate?: string
}

export type CreateAddendumInput = {
  reason: string
  content: string
  signature?: string
}

/**
 * Inspection Service
 *
 * Domain service for inspection-related business logic.
 * Framework-agnostic - can be tested without HTTP layer.
 *
 * Responsibilities:
 * - Inspection retrieval and management
 * - Assignment logic
 * - Inspection lifecycle (start, complete, cancel)
 * - Business rules enforcement
 */
export class InspectionService {
  private ensureUniqueId(existing?: string | null): string {
    if (existing) return existing
    // Prefer UUID for legal integrity + interoperability
    return crypto.randomUUID()
  }

  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value)
    if (Array.isArray(value)) return `[${value.map((v) => this.stableStringify(v)).join(',')}]`
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj).sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${this.stableStringify(obj[k])}`).join(',')}}`
  }

  private computeDocumentHash(payload: Record<string, unknown>): string {
    const canonical = this.stableStringify(payload)
    return crypto.createHash('sha256').update(canonical).digest('hex')
  }

  /**
   * Get inspection by ID with full details
   *
   * @param id - Inspection ID
   * @param userId - User ID (for access control)
   * @returns Inspection or null if not found
   * @throws Error if user doesn't have access
   */
  async getById(id: string, userId: string): Promise<PermitInspection | null> {
    const inspection = await prisma.permitInspection.findUnique({
      where: { id },
      include: {
        permit: true,
        schedule: {
          include: {
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
                designationId: true,
              },
            },
          },
        },
        deficiencies: {
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    })

    if (!inspection) {
      return null
    }

    // Business logic: Check user access
    const hasAccess = await this.checkUserAccess(inspection, userId)
    if (!hasAccess) {
      throw new Error('Unauthorized access to inspection')
    }

    return inspection
  }

  /**
   * Get inspections assigned to a specific user
   *
   * @param userId - User ID
   * @param filters - Optional filters
   * @returns Array of assigned inspections
   */
  async getAssigned(
    userId: string,
    filters?: {
      status?: string
      scheduledAfter?: Date
      scheduledBefore?: Date
      limit?: number
      offset?: number
    },
  ): Promise<PermitInspection[]> {
    const where: Prisma.PermitInspectionWhereInput = {
      schedule: {
        assignedToId: userId,
      },
    }

    // Apply filters
    if (filters?.status) {
      where.status = filters.status as any
    }

    if (filters?.scheduledAfter || filters?.scheduledBefore) {
      where.scheduledDate = {}
      if (filters.scheduledAfter) {
        where.scheduledDate.gte = filters.scheduledAfter
      }
      if (filters.scheduledBefore) {
        where.scheduledDate.lte = filters.scheduledBefore
      }
    }

    const inspections = await prisma.permitInspection.findMany({
      where,
      include: {
        permit: true,
        schedule: {
          include: {
            assignedTo: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        deficiencies: {
          select: {
            id: true,
            status: true,
            severity: true,
          },
        },
      },
      orderBy: {
        scheduledDate: 'asc',
      },
      take: filters?.limit || 50,
      skip: filters?.offset || 0,
    })

    return inspections
  }

  /**
   * List all inspections with optional filters
   *
   * @param filters - Search filters
   * @returns Array of inspections
   */
  async list(filters?: {
    permitId?: string
    status?: string
    assignedToId?: string
    limit?: number
    offset?: number
  }): Promise<PermitInspection[]> {
    const where: Prisma.PermitInspectionWhereInput = {}

    if (filters?.permitId) {
      where.permitId = filters.permitId
    }

    if (filters?.status) {
      where.status = filters.status as any
    }

    if (filters?.assignedToId) {
      where.schedule = {
        assignedToId: filters.assignedToId,
      }
    }

    return await prisma.permitInspection.findMany({
      where,
      include: {
        permit: true,
        schedule: {
          include: {
            assignedTo: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        deficiencies: {
          select: {
            id: true,
            status: true,
            severity: true,
          },
        },
      },
      orderBy: {
        scheduledDate: 'desc',
      },
      take: filters?.limit || 20,
      skip: filters?.offset || 0,
    })
  }

  /**
   * Start an inspection
   *
   * Business logic:
   * - Validates inspection is in SCHEDULED status
   * - Validates user is assigned to inspection
   * - Records GPS coordinates at start
   * - Updates status to IN_PROGRESS
   *
   * @param id - Inspection ID
   * @param userId - User ID
   * @param gpsCoords - GPS coordinates at start
   * @returns Updated inspection
   * @throws Error if validation fails
   */
  async start(id: string, userId: string, gpsCoords: GPSCoordinates): Promise<PermitInspection> {
    // Get inspection with schedule
    const inspection = await prisma.permitInspection.findUnique({
      where: { id },
      include: {
        schedule: true,
        permit: true,
      },
    })

    if (!inspection) {
      throw new Error('Inspection not found')
    }

    await assertInspectionMutable(inspection, userId, 'start')

    // Business logic: Validate status
    if (inspection.status !== 'SCHEDULED') {
      throw new Error(
        `Cannot start inspection with status ${inspection.status}. Must be SCHEDULED.`,
      )
    }

    // Business logic: Validate assignment
    if (inspection.schedule?.assignedToId !== userId) {
      throw new Error('User not assigned to this inspection')
    }

    const uniqueId = this.ensureUniqueId((inspection as any).uniqueId)

    // Business logic: Optional geofence validation
    if (inspection.permit?.latitude && inspection.permit?.longitude) {
      const distance = this.calculateDistance(
        gpsCoords.latitude,
        gpsCoords.longitude,
        inspection.permit.latitude,
        inspection.permit.longitude,
      )

      // Configurable geofence radius (default: 500m)
      const geofenceRadius = parseInt(process.env.GEOFENCE_RADIUS || '500', 10)

      if (distance > geofenceRadius) {
        console.warn(
          `[InspectionService] Geofence warning: Inspector is ${distance}m from permit location`,
        )
        // Note: This is a warning, not a blocker
        // The inspection can still be started
      }
    }

    const beforeSnapshot = inspectionPayloadForAudit(inspection as any)

    const updatedInspection = await prisma.$transaction(async (tx) => {
      const updated = await tx.permitInspection.update({
        where: { id },
        data: {
          uniqueId,
          status: 'IN_PROGRESS',
          inspectorId: (inspection as any).inspectorId ?? userId,
          startGps: {
            lat: gpsCoords.latitude,
            lng: gpsCoords.longitude,
            accuracy: gpsCoords.accuracy,
            timestamp: gpsCoords.timestamp,
          },
          notes: inspection.notes
            ? `${inspection.notes}\n\nStarted at: ${gpsCoords.timestamp}\nGPS: ${gpsCoords.latitude}, ${gpsCoords.longitude} (accuracy: ${gpsCoords.accuracy || 'unknown'}m)`
            : `Started at: ${gpsCoords.timestamp}\nGPS: ${gpsCoords.latitude}, ${gpsCoords.longitude} (accuracy: ${gpsCoords.accuracy || 'unknown'}m)`,
          updatedAt: new Date(),
        },
        include: {
          permit: true,
          schedule: {
            include: {
              assignedTo: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          deficiencies: true,
        },
      })

      await auditLogService.append(
        {
          entityType: AUDIT_ENTITY.PERMIT_INSPECTION,
          entityId: id,
          action: AUDIT_ACTION.INSPECTION_STARTED,
          userId,
          beforeData: beforeSnapshot,
          afterData: inspectionPayloadForAudit(updated as any),
          metadata: { startGpsLat: gpsCoords.latitude, startGpsLng: gpsCoords.longitude },
        },
        tx,
      )

      return updated
    })

    console.log(`[InspectionService] Inspection ${id} started by user ${userId}`)

    return updatedInspection
  }

  /**
   * Finalize an inspection (legal integrity capture)
   *
   * Business logic:
   * - Validates user is assigned to inspection
   * - Records finalized timestamp, GPS, inspector ID, certification snapshot
   * - Computes SHA-256 document hash of legal payload
   */
  async finalize(
    id: string,
    userId: string,
    input: InspectionFinalizeInput,
  ): Promise<PermitInspection> {
    const inspection = await prisma.permitInspection.findUnique({
      where: { id },
      include: {
        schedule: true,
        permit: true,
        deficiencies: true,
      },
    })

    if (!inspection) {
      throw new Error('Inspection not found')
    }

    if (inspection.schedule?.assignedToId !== userId) {
      throw new Error('User not assigned to this inspection')
    }

    if ((inspection as any).finalizedAt != null) {
      throw new Error('Inspection is already finalized')
    }

    if (input.outcome !== 'PASSED' && input.outcome !== 'FAILED') {
      throw new Error('Invalid outcome. Must be PASSED or FAILED.')
    }

    const uniqueId = this.ensureUniqueId((inspection as any).uniqueId)
    const finalizedAtDate = input.finalizedAt ? new Date(input.finalizedAt) : new Date()

    const nextNotesBase = inspection.notes ?? ''
    const noteMarkers: string[] = []
    if (!nextNotesBase.includes('[SIGNATURE_CAPTURED]')) noteMarkers.push('[SIGNATURE_CAPTURED]')
    if (!nextNotesBase.includes('[FINALIZATION_GPS]')) {
      noteMarkers.push(
        `[FINALIZATION_GPS] lat=${input.finalizeGps.latitude}, lng=${input.finalizeGps.longitude}`,
      )
    }
    const nextNotes = [nextNotesBase, ...noteMarkers].filter((s) => s.trim().length > 0).join('\n')

    const legalPayload = {
      uniqueId,
      inspectionId: inspection.id,
      permitId: inspection.permitId,
      esiteId: inspection.esiteId,
      status: input.outcome,
      scheduledDate: inspection.scheduledDate.toISOString(),
      createdAt: inspection.createdAt.toISOString(),
      inspectorId: (inspection as any).inspectorId ?? userId,
      startGps: (inspection as any).startGps ?? null,
      finalizedAt: finalizedAtDate.toISOString(),
      finalizeGps: {
        lat: input.finalizeGps.latitude,
        lng: input.finalizeGps.longitude,
        accuracy: input.finalizeGps.accuracy,
        timestamp: input.finalizeGps.timestamp,
      },
      certificationSnapshot: input.certificationSnapshot,
      signature: input.signature,
      deficiencies: (inspection as any).deficiencies?.map((d: any) => ({
        id: d.id,
        clientId: d.clientId,
        esiteId: d.esiteId,
        createdById: d.createdById,
        description: d.description,
        location: d.location,
        severity: d.severity,
        status: d.status,
        dueDate: d.dueDate ? new Date(d.dueDate).toISOString() : null,
        codeReference: d.codeReference ?? null,
        isStopWork: d.isStopWork,
        isUnsafe: d.isUnsafe,
        createdAt: new Date(d.createdAt).toISOString(),
      })),
    } satisfies Record<string, unknown>

    const documentHash = this.computeDocumentHash(legalPayload)

    const beforeSnapshot = inspectionPayloadForAudit(inspection as any)

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.permitInspection.update({
        where: { id },
        data: {
          uniqueId,
          inspectorId: (inspection as any).inspectorId ?? userId,
          status: input.outcome,
          notes: nextNotes,
          finalizedAt: finalizedAtDate,
          completedDate: finalizedAtDate,
          certificationSnapshot: input.certificationSnapshot,
          finalizeGps: legalPayload.finalizeGps as any,
          documentHash,
          updatedAt: new Date(),
        },
        include: {
          permit: true,
          schedule: {
            include: {
              assignedTo: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          deficiencies: true,
        },
      })

      await auditLogService.append(
        {
          entityType: AUDIT_ENTITY.PERMIT_INSPECTION,
          entityId: id,
          action: AUDIT_ACTION.INSPECTION_FINALIZED,
          userId,
          beforeData: beforeSnapshot,
          afterData: inspectionPayloadForAudit(updated as any),
          metadata: { documentHash },
        },
        tx,
      )

      return updated
    })
  }

  /**
   * Update a non-finalized inspection (notes / schedule). Finalized records are append-only.
   */
  async update(
    id: string,
    userId: string,
    input: UpdateInspectionInput,
  ): Promise<PermitInspection> {
    const inspection = await prisma.permitInspection.findUnique({
      where: { id },
      include: { schedule: true },
    })
    if (!inspection) {
      throw new Error('Inspection not found')
    }

    const hasAccess = await this.checkUserAccess(inspection, userId)
    if (!hasAccess) {
      throw new Error('Unauthorized access to inspection')
    }

    await assertInspectionMutable(inspection, userId, 'update')

    const beforeSnapshot = inspectionPayloadForAudit(inspection)

    return prisma.$transaction(async (tx) => {
      const updated = await tx.permitInspection.update({
        where: { id },
        data: {
          notes: input.notes ?? inspection.notes,
          scheduledDate: input.scheduledDate
            ? new Date(input.scheduledDate)
            : inspection.scheduledDate,
          updatedAt: new Date(),
        },
      })

      await auditLogService.append(
        {
          entityType: AUDIT_ENTITY.PERMIT_INSPECTION,
          entityId: id,
          action: 'INSPECTION_UPDATED',
          userId,
          beforeData: beforeSnapshot,
          afterData: inspectionPayloadForAudit(updated),
        },
        tx,
      )

      return updated
    })
  }

  /**
   * Delete an inspection. Blocked once legally finalized (append-only record).
   */
  async delete(id: string, userId: string): Promise<void> {
    const inspection = await prisma.permitInspection.findUnique({
      where: { id },
      include: { schedule: true },
    })
    if (!inspection) {
      throw new Error('Inspection not found')
    }

    const hasAccess = await this.checkUserAccess(inspection, userId)
    if (!hasAccess) {
      throw new Error('Unauthorized access to inspection')
    }

    await assertInspectionMutable(inspection, userId, 'delete')

    await prisma.permitInspection.delete({ where: { id } })
  }

  /**
   * Create an addendum on a finalized inspection — the only permitted post-finalization mutation.
   */
  async createAddendum(
    id: string,
    userId: string,
    input: CreateAddendumInput,
  ): Promise<AddendumRow> {
    const inspection = await prisma.permitInspection.findUnique({
      where: { id },
      include: { schedule: true },
    })
    if (!inspection) {
      throw new Error('Inspection not found')
    }

    const hasAccess = await this.checkUserAccess(inspection, userId)
    if (!hasAccess) {
      throw new Error('Unauthorized access to inspection')
    }

    if (!isInspectionFinalized(inspection)) {
      throw new Error('Addendums require a finalized inspection')
    }

    return prisma.$transaction(async (tx) => {
      const addendum = await addendumDelegateOf(tx).create({
        data: {
          inspectionId: id,
          reason: input.reason,
          content: input.content,
          createdById: userId,
          signature: input.signature ?? null,
        },
      })

      await auditLogService.append(
        {
          entityType: AUDIT_ENTITY.PERMIT_INSPECTION,
          entityId: id,
          action: AUDIT_ACTION.ADDENDUM_CREATED,
          userId,
          beforeData: inspectionPayloadForAudit(inspection),
          afterData: {
            addendumId: addendum.id,
            reason: addendum.reason,
            createdAt: addendum.createdAt.toISOString(),
          },
          metadata: { addendumId: addendum.id },
        },
        tx,
      )

      return addendum
    })
  }

  /**
   * Check if user has access to inspection
   *
   * Business logic:
   * - Admins have access to all inspections
   * - Inspectors only have access to their assigned inspections
   *
   * @param inspection - Inspection with schedule
   * @param userId - User ID
   * @returns True if user has access
   */
  private async checkUserAccess(
    inspection: PermitInspection & { schedule?: { assignedToId: string } | null },
    userId: string,
  ): Promise<boolean> {
    // Get user role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })

    if (!user) {
      return false
    }

    // Admins have access to all inspections
    if (user.role === 'ADMIN') {
      return true
    }

    // Inspectors only have access to their assigned inspections
    return inspection.schedule?.assignedToId === userId
  }

  /**
   * Calculate distance between two GPS coordinates using Haversine formula
   *
   * @param lat1 - Latitude of point 1
   * @param lon1 - Longitude of point 1
   * @param lat2 - Latitude of point 2
   * @param lon2 - Longitude of point 2
   * @returns Distance in meters
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c // Distance in meters
  }
}

// Export singleton instance
export const inspectionService = new InspectionService()
