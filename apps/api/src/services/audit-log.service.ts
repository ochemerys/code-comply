import { prisma } from '@codecomply/db'
import type { AuditLog, Prisma } from '@codecomply/db'

export const AUDIT_ENTITY = {
  PERMIT: 'Permit',
  PERMIT_INSPECTION: 'PermitInspection',
  DEFICIENCY: 'Deficiency',
  PHOTO: 'Photo',
  REPORT: 'Report',
  INSPECTION_DOCUMENT: 'InspectionDocument',
  VOC: 'VerificationOfCompliance',
  COMPLIANCE_SEARCH: 'ComplianceSearch',
  SECURITY: 'Security',
} as const

export const AUDIT_ACTION = {
  INSPECTION_CREATED: 'INSPECTION_CREATED',
  INSPECTION_STARTED: 'INSPECTION_STARTED',
  INSPECTION_FINALIZED: 'INSPECTION_FINALIZED',
  INSPECTION_IMMUTABLE_VIOLATION: 'INSPECTION_IMMUTABLE_VIOLATION',
  ADDENDUM_CREATED: 'ADDENDUM_CREATED',
  DEFICIENCY_CREATED: 'DEFICIENCY_CREATED',
  DEFICIENCY_UPDATED: 'DEFICIENCY_UPDATED',
  PHOTO_ADDED: 'PHOTO_ADDED',
  REPORT_DISTRIBUTED: 'REPORT_DISTRIBUTED',
  REPORT_DISTRIBUTION_FAILED: 'REPORT_DISTRIBUTION_FAILED',
  DOCUMENT_EMAILED: 'DOCUMENT_EMAILED',
  DOCUMENT_SIGNED: 'DOCUMENT_SIGNED',
  REPORT_SIGNED: 'REPORT_SIGNED',
  COMPLIANCE_SEARCH: 'COMPLIANCE_SEARCH',
  RBAC_ACCESS_DENIED: 'RBAC_ACCESS_DENIED',
  REMOTE_WIPE_REQUESTED: 'REMOTE_WIPE_REQUESTED',
  REMOTE_WIPE_CONFIRMED: 'REMOTE_WIPE_CONFIRMED',
  PERMIT_SYNC: 'PERMIT_SYNC',
} as const

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION]

export type AppendAuditInput = {
  entityType: string
  entityId: string
  action: AuditAction | string
  userId: string
  beforeData?: Prisma.InputJsonValue | null
  afterData?: Prisma.InputJsonValue | null
  metadata?: Prisma.InputJsonValue | null
}

export function inspectionPayloadForAudit(inspection: {
  id: string
  status: string
  permitId?: string | null
  esiteId?: string | null
  uniqueId?: string | null
  scheduledDate?: Date
  completedDate?: Date | null
  finalizedAt?: Date | null
  inspectorId?: string | null
  documentHash?: string | null
  notes?: string | null
}): Prisma.InputJsonValue {
  return {
    id: inspection.id,
    status: inspection.status,
    permitId: inspection.permitId ?? null,
    esiteId: inspection.esiteId ?? null,
    uniqueId: inspection.uniqueId ?? null,
    scheduledDate: inspection.scheduledDate?.toISOString?.() ?? null,
    completedDate: inspection.completedDate?.toISOString?.() ?? null,
    finalizedAt: inspection.finalizedAt?.toISOString?.() ?? null,
    inspectorId: inspection.inspectorId ?? null,
    documentHash: inspection.documentHash ?? null,
    notes: inspection.notes ?? null,
  }
}

export function deficiencyPayloadForAudit(d: {
  id: string
  inspectionId: string
  clientId: string
  description: string
  severity: string
  status: string
  location?: string | null
  checklistItemId?: string | null
  etag?: string | null
}): Prisma.InputJsonValue {
  return {
    id: d.id,
    inspectionId: d.inspectionId,
    clientId: d.clientId,
    description: d.description,
    severity: d.severity,
    status: d.status,
    location: d.location ?? null,
    checklistItemId: d.checklistItemId ?? null,
    etag: d.etag ?? null,
  }
}

export class AuditLogService {
  /**
   * Append-only: creates a new audit row. Pass `tx` to participate in a transaction.
   * Updates/deletes on `audit_logs` are blocked at the database layer.
   */
  async append(input: AppendAuditInput, tx?: Prisma.TransactionClient): Promise<AuditLog> {
    const db = tx ?? prisma
    const beforeData =
      input.beforeData === undefined ? undefined : (input.beforeData as Prisma.InputJsonValue)
    const afterData =
      input.afterData === undefined ? undefined : (input.afterData as Prisma.InputJsonValue)
    const metadata =
      input.metadata === undefined ? undefined : (input.metadata as Prisma.InputJsonValue)

    return db.auditLog.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        userId: input.userId,
        beforeData,
        afterData,
        metadata,
      },
    })
  }

  async listForEntity(entityType: string, entityId: string, take = 500): Promise<AuditLog[]> {
    return prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { timestamp: 'asc' },
      take,
    })
  }

  async list(filters: {
    action?: string
    entityType?: string
    limit?: number
  }): Promise<AuditLog[]> {
    const where: { action?: string; entityType?: string } = {}
    if (filters.action?.trim()) where.action = filters.action.trim()
    if (filters.entityType?.trim()) where.entityType = filters.entityType.trim()

    return prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: filters.limit ?? 20,
    })
  }
}

export const auditLogService = new AuditLogService()
