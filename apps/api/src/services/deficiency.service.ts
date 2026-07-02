import { randomUUID } from 'node:crypto'
import { prisma } from '@codecomply/db'
import type { Deficiency, DeficiencySeverity, DeficiencyStatus, Prisma } from '@codecomply/db'
import type { CreateDeficiencyDTO, UpdateDeficiencyDTO } from '@codecomply/validators'
import {
  AUDIT_ACTION,
  AUDIT_ENTITY,
  auditLogService,
  deficiencyPayloadForAudit,
} from './audit-log.service.js'

/**
 * Pluggable notification hooks (Stop Work / CRITICAL escalation). Replace or spy in tests.
 * Failures are logged and do not fail the surrounding create/update/stop-work operation.
 */
export const deficiencyNotificationHooks = {
  onStopWorkOrderIssued: async (_p: {
    deficiencyId: string
    inspectionId: string
  }): Promise<void> => {},
  onCriticalDeficiencyCreated: async (_p: {
    deficiencyId: string
    inspectionId: string
  }): Promise<void> => {},
  /** M6-S16 — unsafe flag escalation (create or first-time toggle to unsafe). */
  onUnsafeConditionEscalation: async (_p: {
    deficiencyId: string
    inspectionId: string
  }): Promise<void> => {},
}

export type DeficiencyFilters = {
  userId: string
  inspectionId?: string
  status?: DeficiencyStatus
  severity?: DeficiencySeverity
  isStopWork?: boolean
  limit?: number
  offset?: number
}

/** Domain record for a Stop Work order (no separate DB table; tied to deficiency.isStopWork). */
export type StopWorkOrder = {
  id: string
  deficiencyId: string
  inspectionId: string
  issuedAt: string
}

function newEtag(): string {
  return randomUUID()
}

type NotificationPayload = { deficiencyId: string; inspectionId: string }

async function runDeficiencyNotificationHook(
  hookName: string,
  payload: NotificationPayload,
  run: () => Promise<void>,
): Promise<void> {
  try {
    await run()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(
      `[DeficiencyService] notification hook ${hookName} failed for deficiency ${payload.deficiencyId} (inspection ${payload.inspectionId}): ${message}`,
      err,
    )
  }
}

type DeficiencyWithInspection = Deficiency & {
  inspection: {
    id: string
    schedule: { assignedToId: string } | null
  }
}

/**
 * Deficiency domain service — CRUD, offline clientId deduplication, optimistic concurrency, Stop Work.
 */
export class DeficiencyService {
  async create(data: CreateDeficiencyDTO, userId: string): Promise<Deficiency> {
    const existing = await prisma.deficiency.findUnique({
      where: { clientId: data.clientId },
    })
    if (existing) {
      return existing
    }

    const inspection = await prisma.permitInspection.findUnique({
      where: { id: data.inspectionId },
      include: { schedule: true },
    })
    if (!inspection) {
      throw new Error('Inspection not found')
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    if (!user) {
      throw new Error('User not assigned to this inspection')
    }
    if (user.role !== 'ADMIN' && inspection.schedule?.assignedToId !== userId) {
      throw new Error('User not assigned to this inspection')
    }

    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.deficiency.create({
        data: {
          clientId: data.clientId,
          inspectionId: data.inspectionId,
          checklistItemId: data.checklistItemId,
          createdById: userId,
          description: data.description,
          location: data.location,
          severity: data.severity,
          codeReference: data.codeReference as Prisma.InputJsonValue | undefined,
          isStopWork: data.isStopWork ?? false,
          isUnsafe: data.isUnsafe ?? false,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
          status: 'OPEN',
          syncedAt: new Date(),
          etag: newEtag(),
        },
      })

      await auditLogService.append(
        {
          entityType: AUDIT_ENTITY.DEFICIENCY,
          entityId: created.id,
          action: AUDIT_ACTION.DEFICIENCY_CREATED,
          userId,
          beforeData: null,
          afterData: deficiencyPayloadForAudit(created),
          metadata: { inspectionId: data.inspectionId },
        },
        tx,
      )

      return created
    })

    if (data.severity === 'CRITICAL') {
      const p = { deficiencyId: row.id, inspectionId: row.inspectionId }
      await runDeficiencyNotificationHook('onCriticalDeficiencyCreated', p, () =>
        deficiencyNotificationHooks.onCriticalDeficiencyCreated(p),
      )
    }

    if (data.isUnsafe === true) {
      const p = { deficiencyId: row.id, inspectionId: row.inspectionId }
      await runDeficiencyNotificationHook('onUnsafeConditionEscalation', p, () =>
        deficiencyNotificationHooks.onUnsafeConditionEscalation(p),
      )
    }

    return row
  }

  async getById(id: string, userId: string): Promise<Deficiency | null> {
    const deficiency = await prisma.deficiency.findUnique({
      where: { id },
      include: {
        inspection: {
          select: {
            id: true,
            schedule: { select: { assignedToId: true } },
          },
        },
      },
    })
    if (!deficiency) {
      return null
    }

    const allowed = await this.canAccessDeficiencyRow(
      deficiency as DeficiencyWithInspection,
      userId,
    )
    if (!allowed) {
      throw new Error('Unauthorized access to deficiency')
    }

    return stripInspection(deficiency)
  }

  async list(filters: DeficiencyFilters): Promise<Deficiency[]> {
    const user = await prisma.user.findUnique({
      where: { id: filters.userId },
      select: { role: true },
    })
    if (!user) {
      return []
    }

    const where: Prisma.DeficiencyWhereInput = {}
    if (filters.inspectionId) {
      where.inspectionId = filters.inspectionId
    }
    if (filters.status) {
      where.status = filters.status
    }
    if (filters.severity) {
      where.severity = filters.severity
    }
    if (filters.isStopWork !== undefined) {
      where.isStopWork = filters.isStopWork
    }

    if (user.role !== 'ADMIN') {
      where.inspection = {
        schedule: { assignedToId: filters.userId },
      }
    }

    return prisma.deficiency.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
    })
  }

  async update(
    id: string,
    userId: string,
    data: UpdateDeficiencyDTO,
    etag?: string,
  ): Promise<Deficiency> {
    const current = await prisma.deficiency.findUnique({
      where: { id },
      include: {
        inspection: {
          select: {
            id: true,
            schedule: { select: { assignedToId: true } },
          },
        },
      },
    })
    if (!current) {
      throw new Error('Deficiency not found')
    }

    const allowed = await this.canMutateDeficiency(
      current as DeficiencyWithInspection & { createdById: string },
      userId,
    )
    if (!allowed) {
      throw new Error('Forbidden: insufficient permissions to update deficiency')
    }

    if (etag !== undefined && current.etag !== etag) {
      throw new Error('Optimistic concurrency conflict: ETag mismatch')
    }

    const next: Prisma.DeficiencyUpdateInput = {
      etag: newEtag(),
      syncedAt: new Date(),
    }

    if (data.description !== undefined) next.description = data.description
    if (data.location !== undefined) next.location = data.location
    if (data.severity !== undefined) next.severity = data.severity
    if (data.status !== undefined) next.status = data.status
    if (data.codeReference !== undefined) {
      next.codeReference = data.codeReference as Prisma.InputJsonValue
    }
    if (data.isStopWork !== undefined) next.isStopWork = data.isStopWork
    if (data.isUnsafe !== undefined) next.isUnsafe = data.isUnsafe
    if (data.dueDate !== undefined) {
      next.dueDate = data.dueDate ? new Date(data.dueDate) : null
    }
    if (data.checklistItemId !== undefined) {
      next.checklistItemId = data.checklistItemId
    }
    if (data.inspectionId !== undefined) {
      next.inspection = { connect: { id: data.inspectionId } }
    }

    const wasUnsafe = current.isUnsafe === true
    const beforeSnapshot = deficiencyPayloadForAudit(current)

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.deficiency.update({
        where: { id },
        data: next,
      })

      await auditLogService.append(
        {
          entityType: AUDIT_ENTITY.DEFICIENCY,
          entityId: row.id,
          action: AUDIT_ACTION.DEFICIENCY_UPDATED,
          userId,
          beforeData: beforeSnapshot,
          afterData: deficiencyPayloadForAudit(row),
          metadata: { inspectionId: row.inspectionId },
        },
        tx,
      )

      return row
    })

    if (data.isUnsafe === true && !wasUnsafe) {
      const p = { deficiencyId: updated.id, inspectionId: updated.inspectionId }
      await runDeficiencyNotificationHook('onUnsafeConditionEscalation', p, () =>
        deficiencyNotificationHooks.onUnsafeConditionEscalation(p),
      )
    }

    return updated
  }

  /**
   * Deletes a deficiency. Caller must be ADMIN, assigned inspector, or creator.
   */
  async delete(id: string, userId: string): Promise<void> {
    const row = await prisma.deficiency.findUnique({
      where: { id },
      include: {
        inspection: {
          select: {
            id: true,
            schedule: { select: { assignedToId: true } },
          },
        },
      },
    })
    if (!row) {
      throw new Error('Deficiency not found')
    }

    const canMutate = await this.canMutateDeficiency(
      row as DeficiencyWithInspection & { createdById: string },
      userId,
    )
    if (!canMutate) {
      throw new Error('Forbidden: insufficient permissions to delete deficiency')
    }

    await prisma.deficiency.delete({ where: { id } })
  }

  /**
   * Sets Stop Work on the deficiency and triggers notification hooks.
   */
  async createStopWorkOrder(deficiencyId: string, userId: string): Promise<StopWorkOrder> {
    const row = await prisma.deficiency.findUnique({
      where: { id: deficiencyId },
      include: {
        inspection: {
          select: {
            id: true,
            schedule: { select: { assignedToId: true } },
          },
        },
      },
    })
    if (!row) {
      throw new Error('Deficiency not found')
    }

    const allowed = await this.canAccessDeficiencyRow(row as DeficiencyWithInspection, userId)
    if (!allowed) {
      throw new Error('Unauthorized access to deficiency')
    }

    const beforeSnapshot = deficiencyPayloadForAudit(row)

    const updated = await prisma.$transaction(async (tx) => {
      const nextRow = await tx.deficiency.update({
        where: { id: deficiencyId },
        data: {
          isStopWork: true,
          etag: newEtag(),
          syncedAt: new Date(),
        },
      })

      await auditLogService.append(
        {
          entityType: AUDIT_ENTITY.DEFICIENCY,
          entityId: nextRow.id,
          action: AUDIT_ACTION.DEFICIENCY_UPDATED,
          userId,
          beforeData: beforeSnapshot,
          afterData: deficiencyPayloadForAudit(nextRow),
          metadata: { inspectionId: nextRow.inspectionId, reason: 'stop_work' },
        },
        tx,
      )

      return nextRow
    })

    const notifyPayload = { deficiencyId: updated.id, inspectionId: updated.inspectionId }
    await runDeficiencyNotificationHook('onStopWorkOrderIssued', notifyPayload, () =>
      deficiencyNotificationHooks.onStopWorkOrderIssued(notifyPayload),
    )

    return {
      id: `swo-${updated.id}`,
      deficiencyId: updated.id,
      inspectionId: updated.inspectionId,
      issuedAt: updated.updatedAt.toISOString(),
    }
  }

  private async canAccessDeficiencyRow(
    row: DeficiencyWithInspection,
    userId: string,
  ): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    if (!user) return false
    if (user.role === 'ADMIN') return true
    return row.inspection.schedule?.assignedToId === userId
  }

  private async canMutateDeficiency(
    row: DeficiencyWithInspection & { createdById: string },
    userId: string,
  ): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    if (!user) return false
    if (user.role === 'ADMIN') return true
    if (row.createdById === userId) return true
    return row.inspection.schedule?.assignedToId === userId
  }
}

function stripInspection(d: Deficiency & { inspection?: unknown }): Deficiency {
  const { inspection: _i, ...rest } = d
  return rest as Deficiency
}

export const deficiencyService = new DeficiencyService()
