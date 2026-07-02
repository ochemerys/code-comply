import { prisma } from '@codecomply/db'
import type { SyncMutation, SyncResult, Change } from '@codecomply/validators'
import {
  AUDIT_ACTION,
  AUDIT_ENTITY,
  auditLogService,
  deficiencyPayloadForAudit,
} from './audit-log.service.js'
import { distributionService } from './distribution.service.js'
import { InspectionWorkflowSyncPayloadSchema } from '@codecomply/validators'
import { inspectionWorkflowService } from './inspection-workflow.service.js'

/**
 * Sync Service - Handles batch sync operations
 *
 * Business Logic:
 * - Deduplication via clientId
 * - Conflict detection via ETag
 * - Transaction support for batch operations
 * - Audit logging for all sync operations
 */
export class SyncService {
  /**
   * Process batch of mutations from client
   *
   * Business Rules:
   * - Check clientId for deduplication
   * - Validate user permissions
   * - Process in order (FIFO)
   * - Return results for each mutation
   */
  async processPushMutations(mutations: SyncMutation[], userId: string): Promise<SyncResult[]> {
    const results: SyncResult[] = []

    // Process mutations sequentially to maintain order
    for (const mutation of mutations) {
      try {
        const result = await this.processSingleMutation(mutation, userId)
        results.push(result)
      } catch (error: any) {
        console.error('[SyncService] Error processing mutation:', error)
        results.push({
          clientId: mutation.clientId,
          success: false,
          error: error.message || 'Unknown error',
          conflict: error.message?.includes('Conflict') || false,
        })
      }
    }

    return results
  }

  /**
   * Process a single mutation
   */
  private async processSingleMutation(mutation: SyncMutation, userId: string): Promise<SyncResult> {
    const { clientId, entity, operation, payload } = mutation

    // Route to appropriate handler based on entity type
    switch (entity) {
      case 'deficiency':
        return await this.processDeficiencyMutation(clientId, operation, payload, userId)

      case 'inspection':
        return await this.processInspectionMutation(clientId, operation, payload, userId)

      case 'checklist':
        return await this.processChecklistMutation(clientId, operation, payload, userId)

      case 'document':
        return await this.processDocumentMutation(clientId, operation, payload, userId)

      default:
        throw new Error(`Unknown entity type: ${entity}`)
    }
  }

  /**
   * Process deficiency mutation
   *
   * Business Rules:
   * - Check for existing record by clientId (deduplication)
   * - Validate user has access to inspection
   * - Handle optimistic concurrency with ETag
   */
  private async processDeficiencyMutation(
    clientId: string,
    operation: string,
    payload: any,
    userId: string,
  ): Promise<SyncResult> {
    // Check for existing record (deduplication)
    const existing = await prisma.deficiency.findUnique({
      where: { clientId },
    })

    if (operation === 'create') {
      if (existing) {
        // Already exists - return existing ID (idempotent)
        return {
          clientId,
          success: true,
          serverId: existing.id,
          conflict: false,
        }
      }

      // Validate user has access to inspection
      const inspection = await prisma.permitInspection.findUnique({
        where: { id: payload.inspectionId },
        include: { schedule: true },
      })

      if (!inspection) {
        throw new Error('Inspection not found')
      }

      if (inspection.schedule?.assignedToId !== userId) {
        throw new Error('User not assigned to this inspection')
      }

      const deficiency = await prisma.$transaction(async (tx) => {
        const row = await tx.deficiency.create({
          data: {
            clientId,
            inspectionId: payload.inspectionId,
            createdById: userId,
            description: payload.description,
            location: payload.location,
            severity: payload.severity,
            status: 'OPEN',
            codeReference: payload.codeReference,
            syncedAt: new Date(),
          },
        })

        await auditLogService.append(
          {
            entityType: AUDIT_ENTITY.DEFICIENCY,
            entityId: row.id,
            action: AUDIT_ACTION.DEFICIENCY_CREATED,
            userId,
            beforeData: null,
            afterData: deficiencyPayloadForAudit(row),
            metadata: { inspectionId: payload.inspectionId, source: 'sync' },
          },
          tx,
        )

        return row
      })

      await this.triggerPostSyncDistribution(payload.inspectionId, userId)

      return {
        clientId,
        success: true,
        serverId: deficiency.id,
        conflict: false,
      }
    }

    if (operation === 'update') {
      if (!existing) {
        throw new Error('Deficiency not found')
      }

      // Check ETag for optimistic concurrency
      if (payload.etag && existing.etag !== payload.etag) {
        return {
          clientId,
          success: false,
          error: 'Conflict: Resource has been modified',
          conflict: true,
        }
      }

      const beforeSnapshot = deficiencyPayloadForAudit(existing)

      const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.deficiency.update({
          where: { id: existing.id },
          data: {
            description: payload.description,
            location: payload.location,
            severity: payload.severity,
            status: payload.status,
            codeReference: payload.codeReference,
            etag: crypto.randomUUID(),
            updatedAt: new Date(),
            syncedAt: new Date(),
          },
        })

        await auditLogService.append(
          {
            entityType: AUDIT_ENTITY.DEFICIENCY,
            entityId: row.id,
            action: AUDIT_ACTION.DEFICIENCY_UPDATED,
            userId,
            beforeData: beforeSnapshot,
            afterData: deficiencyPayloadForAudit(row),
            metadata: { inspectionId: row.inspectionId, source: 'sync' },
          },
          tx,
        )

        return row
      })

      await this.triggerPostSyncDistribution(updated.inspectionId, userId)

      return {
        clientId,
        success: true,
        serverId: updated.id,
        conflict: false,
      }
    }

    if (operation === 'delete') {
      if (!existing) {
        // Already deleted - idempotent
        return {
          clientId,
          success: true,
          conflict: false,
        }
      }

      const beforeSnapshot = deficiencyPayloadForAudit(existing)

      await prisma.$transaction(async (tx) => {
        const row = await tx.deficiency.update({
          where: { id: existing.id },
          data: {
            status: 'CLOSED',
            updatedAt: new Date(),
            syncedAt: new Date(),
          },
        })

        await auditLogService.append(
          {
            entityType: AUDIT_ENTITY.DEFICIENCY,
            entityId: row.id,
            action: AUDIT_ACTION.DEFICIENCY_UPDATED,
            userId,
            beforeData: beforeSnapshot,
            afterData: deficiencyPayloadForAudit(row),
            metadata: { inspectionId: row.inspectionId, source: 'sync', operation: 'delete' },
          },
          tx,
        )
      })

      return {
        clientId,
        success: true,
        serverId: existing.id,
        conflict: false,
      }
    }

    throw new Error(`Unknown operation: ${operation}`)
  }

  /**
   * Process inspection mutation (placeholder)
   */
  private async processInspectionMutation(
    clientId: string,
    operation: string,
    payload: unknown,
    userId: string,
  ): Promise<SyncResult> {
    if (operation !== 'update' && operation !== 'create') {
      throw new Error(`Unknown operation: ${operation}`)
    }

    const parsed = InspectionWorkflowSyncPayloadSchema.safeParse(payload)
    if (!parsed.success) {
      throw new Error('Invalid inspection workflow payload')
    }

    await inspectionWorkflowService.upsertFromSync(parsed.data, userId)

    return {
      clientId,
      success: true,
      serverId: parsed.data.inspectionId,
      conflict: false,
    }
  }

  /**
   * Process checklist mutation (placeholder)
   */
  private async processChecklistMutation(
    _clientId: string,
    _operation: string,
    _payload: unknown,
    _userId: string,
  ): Promise<SyncResult> {
    // TODO: Implement in future milestone
    throw new Error('Checklist mutations not yet implemented')
  }

  /**
   * Process document mutation (placeholder)
   */
  private async processDocumentMutation(
    _clientId: string,
    _operation: string,
    _payload: unknown,
    _userId: string,
  ): Promise<SyncResult> {
    // TODO: Implement in future milestone
    throw new Error('Document mutations not yet implemented')
  }

  private async triggerPostSyncDistribution(inspectionId: string, userId: string): Promise<void> {
    try {
      await distributionService.onSyncPushComplete([inspectionId], userId)
    } catch (error) {
      console.error('[SyncService] Post-sync distribution failed:', error)
    }
  }

  /**
   * Get changes since timestamp for pull sync
   *
   * Business Rules:
   * - Return only changes user has access to
   * - Order by timestamp (oldest first)
   * - Support pagination
   */
  async getPullChanges(
    since: Date | null,
    limit: number,
    userId: string,
  ): Promise<{ changes: Change[]; hasMore: boolean }> {
    const changes: Change[] = []

    // Fetch limit + 1 to check if there are more records
    const deficiencyChanges = await this.getDeficiencyChanges(since, limit + 1, userId)
    changes.push(...deficiencyChanges)

    // TODO: Add other entity types in future milestones
    // - Inspection changes
    // - Checklist changes
    // - Document changes

    // Sort by timestamp
    changes.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    // Apply limit and check if there are more
    const hasMore = changes.length > limit
    const limitedChanges = changes.slice(0, limit)

    return {
      changes: limitedChanges,
      hasMore,
    }
  }

  /**
   * Get deficiency changes for user
   */
  private async getDeficiencyChanges(
    since: Date | null,
    limit: number,
    userId: string,
  ): Promise<Change[]> {
    const whereClause: any = {
      inspection: {
        schedule: {
          assignedToId: userId,
        },
      },
    }

    if (since) {
      whereClause.syncedAt = {
        gt: since,
      }
    }

    const deficiencies = await prisma.deficiency.findMany({
      where: whereClause,
      include: {
        inspection: true,
      },
      orderBy: {
        syncedAt: 'asc',
      },
      take: limit,
    })

    return deficiencies.map((deficiency: any) => ({
      id: deficiency.id,
      entity: 'deficiency' as const,
      operation: 'update' as const, // For now, treat all as updates
      data: {
        id: deficiency.id,
        clientId: deficiency.clientId,
        inspectionId: deficiency.inspectionId,
        description: deficiency.description,
        location: deficiency.location,
        severity: deficiency.severity,
        status: deficiency.status,
        codeReference: deficiency.codeReference,
        createdAt: deficiency.createdAt.toISOString(),
        updatedAt: deficiency.updatedAt.toISOString(),
        syncedAt: deficiency.syncedAt?.toISOString(),
        etag: deficiency.etag,
      },
      timestamp: deficiency.syncedAt?.toISOString() || deficiency.updatedAt.toISOString(),
    }))
  }
}

// Export singleton instance
export const syncService = new SyncService()
