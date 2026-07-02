import type { Context, Next } from 'hono'
import { prisma } from '@codecomply/db'
import type { Prisma } from '@codecomply/db'
import {
  AUDIT_ACTION,
  AUDIT_ENTITY,
  auditLogService,
  inspectionPayloadForAudit,
} from '../services/audit-log.service.js'

export const IMMUTABLE_INSPECTION_MESSAGE =
  'Finalized inspection records are append-only; use an addendum to amend the legal record.'

export class ImmutableInspectionError extends Error {
  readonly code = 'IMMUTABLE_INSPECTION' as const

  constructor(
    message: string = IMMUTABLE_INSPECTION_MESSAGE,
    public readonly inspectionId?: string,
    public readonly operation?: string,
  ) {
    super(message)
    this.name = 'ImmutableInspectionError'
  }
}

/** Finalized inspections are identified by `finalizedAt` (legal lock), not a separate status enum. */
export function isInspectionFinalized(inspection: { finalizedAt?: Date | null }): boolean {
  return inspection.finalizedAt != null
}

export async function logImmutableViolationAttempt(
  inspectionId: string,
  userId: string,
  operation: string,
  inspectionSnapshot: Prisma.InputJsonValue,
): Promise<void> {
  await auditLogService.append({
    entityType: AUDIT_ENTITY.PERMIT_INSPECTION,
    entityId: inspectionId,
    action: AUDIT_ACTION.INSPECTION_IMMUTABLE_VIOLATION,
    userId,
    beforeData: inspectionSnapshot,
    afterData: null,
    metadata: { operation, blocked: true },
  })
}

/**
 * Throws when the inspection is finalized; logs the blocked attempt to the audit trail first.
 */
export async function assertInspectionMutable(
  inspection: {
    id: string
    finalizedAt?: Date | null
    status?: string
    permitId?: string | null
    esiteId?: string | null
    uniqueId?: string | null
    scheduledDate?: Date
    completedDate?: Date | null
    inspectorId?: string | null
    documentHash?: string | null
    notes?: string | null
  },
  userId: string,
  operation: string,
): Promise<void> {
  if (!isInspectionFinalized(inspection)) {
    return
  }

  await logImmutableViolationAttempt(
    inspection.id,
    userId,
    operation,
    inspectionPayloadForAudit({
      ...inspection,
      status: inspection.status ?? 'UNKNOWN',
    }),
  )
  throw new ImmutableInspectionError(undefined, inspection.id, operation)
}

/**
 * Hono guard for routes that mutate inspections by `:id` (update/delete).
 * Returns 409 Conflict with a stable error code for API clients.
 */
export function immutableInspectionGuard(operation: 'update' | 'delete' | 'mutate') {
  return async (c: Context, next: Next) => {
    const id = c.req.param('id')
    if (!id) {
      return c.json({ error: 'Inspection id is required' }, 400)
    }

    const userId = c.get('userId')
    const inspection = await prisma.permitInspection.findUnique({ where: { id } })
    if (!inspection) {
      return c.json({ error: 'Inspection not found' }, 404)
    }

    if (isInspectionFinalized(inspection)) {
      await logImmutableViolationAttempt(
        id,
        userId,
        operation,
        inspectionPayloadForAudit(inspection),
      )
      return c.json(
        {
          error: IMMUTABLE_INSPECTION_MESSAGE,
          code: 'IMMUTABLE_INSPECTION',
        },
        409,
      )
    }

    await next()
  }
}
