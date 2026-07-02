import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ComplianceSearchService } from './compliance-search.service.js'
import type { AuditLogService } from './audit-log.service.js'
import { AUDIT_ACTION, AUDIT_ENTITY } from './audit-log.service.js'

vi.mock('@codecomply/db', () => ({
  prisma: {
    permitInspection: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { prisma } from '@codecomply/db'

describe('ComplianceSearchService (M10-S16)', () => {
  let append: ReturnType<typeof vi.fn>
  let service: ComplianceSearchService

  beforeEach(() => {
    vi.clearAllMocks()
    append = vi.fn().mockResolvedValue({ id: 'audit-1' })
    service = new ComplianceSearchService({
      auditLog: { append, listForEntity: vi.fn() } as unknown as AuditLogService,
    })
  })

  it('searches with permit and legal land filters', async () => {
    const row = {
      id: 'insp-1',
      status: 'PASSED',
      scheduledDate: new Date('2024-03-01'),
      completedDate: null,
      finalizedAt: null,
      permit: {
        permitNumber: 'P-001',
        address: '123 Main',
        legalLandDesc: 'Plan 1234AB Block 5',
      },
      schedule: { assignedTo: { id: 'u1', name: 'Alice' } },
      inspector: null,
      deficiencies: [{ id: 'd1' }],
    }

    vi.mocked(prisma.permitInspection.findMany).mockResolvedValue([row] as never)
    vi.mocked(prisma.permitInspection.count).mockResolvedValue(1)

    const result = await service.search(
      {
        legalLandDescription: '1234AB',
        permitNumber: 'P-001',
        limit: 100,
        offset: 0,
      },
      'admin-1',
    )

    expect(result.total).toBe(1)
    expect(result.results).toHaveLength(1)
    expect(result.results[0]?.permitNumber).toBe('P-001')
    expect(result.results[0]?.legalLandDescription).toBe('Plan 1234AB Block 5')
    expect(result.results[0]?.deficiencyCount).toBe(1)
    expect(result.searchAuditId).toBeDefined()

    expect(prisma.permitInspection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          permit: {
            legalLandDesc: { contains: '1234AB', mode: 'insensitive' },
            permitNumber: { contains: 'P-001', mode: 'insensitive' },
          },
        }),
        orderBy: { scheduledDate: 'desc' },
      }),
    )
  })

  it('filters by date range and inspector', async () => {
    vi.mocked(prisma.permitInspection.findMany).mockResolvedValue([])
    vi.mocked(prisma.permitInspection.count).mockResolvedValue(0)

    await service.search(
      {
        dateFrom: '2024-01-01',
        dateTo: '2024-06-30',
        inspectorId: 'inspector-1',
        limit: 50,
        offset: 0,
      },
      'admin-1',
    )

    expect(prisma.permitInspection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          scheduledDate: {
            gte: new Date('2024-01-01T00:00:00.000Z'),
            lte: new Date('2024-06-30T23:59:59.999Z'),
          },
          OR: [{ inspectorId: 'inspector-1' }, { schedule: { assignedToId: 'inspector-1' } }],
        }),
        take: 50,
      }),
    )
  })

  it('logs audit entry for each search', async () => {
    vi.mocked(prisma.permitInspection.findMany).mockResolvedValue([])
    vi.mocked(prisma.permitInspection.count).mockResolvedValue(0)

    const result = await service.search({ permitNumber: 'P-99', limit: 100, offset: 0 }, 'admin-42')

    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: AUDIT_ENTITY.COMPLIANCE_SEARCH,
        entityId: result.searchAuditId,
        action: AUDIT_ACTION.COMPLIANCE_SEARCH,
        userId: 'admin-42',
        metadata: expect.objectContaining({
          criteria: expect.objectContaining({ permitNumber: 'P-99' }),
          resultCount: 0,
        }),
      }),
    )
  })

  it('applies outcome filter when status not set', async () => {
    vi.mocked(prisma.permitInspection.findMany).mockResolvedValue([])
    vi.mocked(prisma.permitInspection.count).mockResolvedValue(0)

    await service.search({ outcome: 'FAILED', limit: 100, offset: 0 }, 'admin-1')

    expect(prisma.permitInspection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'FAILED' }),
      }),
    )
  })
})
