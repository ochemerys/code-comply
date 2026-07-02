import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  AuditLogService,
  AUDIT_ACTION,
  AUDIT_ENTITY,
  deficiencyPayloadForAudit,
  inspectionPayloadForAudit,
} from './audit-log.service.js'
import { prisma } from '@codecomply/db'

vi.mock('@codecomply/db', () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

describe('AuditLogService', () => {
  let service: AuditLogService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AuditLogService()
  })

  describe('append', () => {
    it('creates an audit row', async () => {
      const row = {
        id: 'log-1',
        entityType: AUDIT_ENTITY.PERMIT_INSPECTION,
        entityId: 'insp-1',
        action: AUDIT_ACTION.INSPECTION_STARTED,
        userId: 'u1',
        timestamp: new Date(),
        beforeData: null,
        afterData: { status: 'IN_PROGRESS' },
        metadata: null,
      }
      vi.mocked(prisma.auditLog.create).mockResolvedValue(row as any)

      const out = await service.append({
        entityType: AUDIT_ENTITY.PERMIT_INSPECTION,
        entityId: 'insp-1',
        action: AUDIT_ACTION.INSPECTION_STARTED,
        userId: 'u1',
        beforeData: null,
        afterData: { status: 'IN_PROGRESS' },
      })

      expect(out.id).toBe('log-1')
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entityType: AUDIT_ENTITY.PERMIT_INSPECTION,
          entityId: 'insp-1',
          action: AUDIT_ACTION.INSPECTION_STARTED,
          userId: 'u1',
        }),
      })
    })
  })

  describe('listForEntity', () => {
    it('returns logs ordered by timestamp', async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([])

      await service.listForEntity(AUDIT_ENTITY.DEFICIENCY, 'def-1')

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          entityType: AUDIT_ENTITY.DEFICIENCY,
          entityId: 'def-1',
        },
        orderBy: { timestamp: 'asc' },
        take: 500,
      })
    })
  })

  describe('payload helpers', () => {
    it('inspectionPayloadForAudit maps core fields', () => {
      const j = inspectionPayloadForAudit({
        id: 'i1',
        status: 'SCHEDULED',
        permitId: 'p1',
        uniqueId: null,
        scheduledDate: new Date('2026-01-01T00:00:00Z'),
        finalizedAt: null,
        inspectorId: null,
        documentHash: null,
        notes: null,
      })
      expect(j).toEqual(
        expect.objectContaining({
          id: 'i1',
          status: 'SCHEDULED',
          permitId: 'p1',
        }),
      )
    })

    it('deficiencyPayloadForAudit maps core fields', () => {
      const j = deficiencyPayloadForAudit({
        id: 'd1',
        inspectionId: 'i1',
        clientId: 'c1',
        description: 'desc',
        severity: 'MAJOR',
        status: 'OPEN',
        location: null,
        checklistItemId: null,
        etag: 'e1',
      })
      expect(j).toEqual(
        expect.objectContaining({
          id: 'd1',
          inspectionId: 'i1',
          severity: 'MAJOR',
        }),
      )
    })
  })
})
