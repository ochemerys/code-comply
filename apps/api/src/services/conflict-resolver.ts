import { prisma as db } from '@codecomply/db'
import type { Prisma } from '@codecomply/db'

/**
 * Conflict Resolution Strategy:
 * - Inspection data: Field wins (inspector's data is authoritative)
 * - Permit metadata: Server wins (server data is authoritative)
 * - User data: Server wins (server data is authoritative)
 */

export interface ConflictData {
  entityType: string
  entityId: string
  clientVersion: any
  serverVersion: any
  etag?: string
}

export interface ConflictResolution {
  id: string
  entityType: string
  entityId: string
  clientVersion: any
  serverVersion: any
  resolution: 'FIELD_WINS' | 'SERVER_WINS' | 'MANUAL_REQUIRED'
  resolvedAt: Date
}

export class ConflictResolverService {
  /**
   * Detect if a conflict exists based on ETag comparison
   */
  async detectConflict(
    entityType: string,
    entityId: string,
    clientEtag?: string,
  ): Promise<boolean> {
    if (!clientEtag) {
      return false // No ETag provided, no conflict detection possible
    }

    let serverEtag: string | null = null

    switch (entityType) {
      case 'inspection': {
        const inspection = await db.permitInspection.findUnique({
          where: { id: entityId },
          select: { etag: true },
        })
        serverEtag = inspection?.etag || null
        break
      }
      case 'deficiency': {
        const deficiency = await db.deficiency.findUnique({
          where: { id: entityId },
          select: { etag: true },
        })
        serverEtag = deficiency?.etag || null
        break
      }
      default:
        throw new Error(`Unsupported entity type: ${entityType}`)
    }

    // Conflict exists if ETags don't match
    return serverEtag !== null && serverEtag !== clientEtag
  }

  /**
   * Log a conflict to the database for audit purposes
   */
  async logConflict(conflictData: ConflictData): Promise<ConflictResolution> {
    const resolution = this.determineResolution(conflictData.entityType)

    const conflict = await db.syncConflict.create({
      data: {
        entityType: conflictData.entityType,
        entityId: conflictData.entityId,
        clientVersion: conflictData.clientVersion as Prisma.InputJsonValue,
        serverVersion: conflictData.serverVersion as Prisma.InputJsonValue,
        resolution,
        resolvedAt: new Date(),
      },
    })

    console.log(
      `[ConflictResolver] Conflict logged: ${conflictData.entityType}/${conflictData.entityId} - Resolution: ${resolution}`,
    )

    return {
      id: conflict.id,
      entityType: conflict.entityType,
      entityId: conflict.entityId,
      clientVersion: conflict.clientVersion,
      serverVersion: conflict.serverVersion,
      resolution: conflict.resolution as 'FIELD_WINS' | 'SERVER_WINS' | 'MANUAL_REQUIRED',
      resolvedAt: conflict.resolvedAt,
    }
  }

  /**
   * Determine resolution strategy based on entity type
   */
  private determineResolution(
    entityType: string,
  ): 'FIELD_WINS' | 'SERVER_WINS' | 'MANUAL_REQUIRED' {
    switch (entityType) {
      case 'inspection':
      case 'deficiency':
      case 'checklist_response':
      case 'photo':
        // Field data is authoritative for inspection results
        return 'FIELD_WINS'

      case 'permit':
      case 'permit_metadata':
      case 'checklist_template':
        // Server data is authoritative for metadata
        return 'SERVER_WINS'

      case 'user':
      case 'certification':
        // Server data is authoritative for user data
        return 'SERVER_WINS'

      default:
        // Unknown entity type requires manual resolution
        console.warn(`[ConflictResolver] Unknown entity type: ${entityType}`)
        return 'MANUAL_REQUIRED'
    }
  }

  /**
   * Resolve a conflict by applying the appropriate strategy
   */
  async resolveConflict(conflictData: ConflictData): Promise<any> {
    const resolution = this.determineResolution(conflictData.entityType)

    // Log the conflict for audit
    await this.logConflict(conflictData)

    switch (resolution) {
      case 'FIELD_WINS':
        // Return client version (field data wins)
        return conflictData.clientVersion

      case 'SERVER_WINS':
        // Return server version (server data wins)
        return conflictData.serverVersion

      case 'MANUAL_REQUIRED':
        // Throw error for manual resolution
        throw new Error(
          `Manual conflict resolution required for ${conflictData.entityType}/${conflictData.entityId}`,
        )

      default:
        throw new Error(`Unknown resolution strategy: ${resolution}`)
    }
  }

  /**
   * Get all conflicts for a specific entity
   */
  async getConflictsByEntity(entityType: string, entityId: string): Promise<ConflictResolution[]> {
    const conflicts = await db.syncConflict.findMany({
      where: {
        entityType,
        entityId,
      },
      orderBy: {
        resolvedAt: 'desc',
      },
    })

    return conflicts.map((conflict) => ({
      id: conflict.id,
      entityType: conflict.entityType,
      entityId: conflict.entityId,
      clientVersion: conflict.clientVersion,
      serverVersion: conflict.serverVersion,
      resolution: conflict.resolution as 'FIELD_WINS' | 'SERVER_WINS' | 'MANUAL_REQUIRED',
      resolvedAt: conflict.resolvedAt,
    }))
  }

  /**
   * Get all conflicts (for admin view)
   */
  async getAllConflicts(filters?: {
    entityType?: string
    resolution?: string
    startDate?: Date
    endDate?: Date
  }): Promise<ConflictResolution[]> {
    const where: Prisma.SyncConflictWhereInput = {}

    if (filters?.entityType) {
      where.entityType = filters.entityType
    }

    if (filters?.resolution) {
      where.resolution = filters.resolution
    }

    if (filters?.startDate || filters?.endDate) {
      where.resolvedAt = {}
      if (filters.startDate) {
        where.resolvedAt.gte = filters.startDate
      }
      if (filters.endDate) {
        where.resolvedAt.lte = filters.endDate
      }
    }

    const conflicts = await db.syncConflict.findMany({
      where,
      orderBy: {
        resolvedAt: 'desc',
      },
      take: 100, // Limit to 100 most recent conflicts
    })

    return conflicts.map((conflict) => ({
      id: conflict.id,
      entityType: conflict.entityType,
      entityId: conflict.entityId,
      clientVersion: conflict.clientVersion,
      serverVersion: conflict.serverVersion,
      resolution: conflict.resolution as 'FIELD_WINS' | 'SERVER_WINS' | 'MANUAL_REQUIRED',
      resolvedAt: conflict.resolvedAt,
    }))
  }

  /**
   * Get conflict statistics
   */
  async getConflictStats(): Promise<{
    total: number
    byResolution: Record<string, number>
    byEntityType: Record<string, number>
  }> {
    const conflicts = await db.syncConflict.findMany({
      select: {
        resolution: true,
        entityType: true,
      },
    })

    const byResolution: Record<string, number> = {}
    const byEntityType: Record<string, number> = {}

    conflicts.forEach((conflict) => {
      // Count by resolution
      byResolution[conflict.resolution] = (byResolution[conflict.resolution] || 0) + 1

      // Count by entity type
      byEntityType[conflict.entityType] = (byEntityType[conflict.entityType] || 0) + 1
    })

    return {
      total: conflicts.length,
      byResolution,
      byEntityType,
    }
  }
}

// Export singleton instance
export const conflictResolverService = new ConflictResolverService()
