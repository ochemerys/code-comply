import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  computeAppealDeadline,
  isSeniorSco,
  orderEscalationService,
} from './order-escalation.service.js'
import { prisma } from '@codecomply/db'
import { APPEAL_DEADLINE_DAYS } from '@codecomply/validators'

vi.mock('@codecomply/db', () => ({
  prisma: {
    deficiency: { findUnique: vi.fn(), findMany: vi.fn() },
    stopWorkEscalation: { upsert: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    report: { findFirst: vi.fn() },
  },
}))

vi.mock('./audit-log.service.js', () => ({
  auditLogService: { append: vi.fn(), listForEntity: vi.fn().mockResolvedValue([]) },
  AUDIT_ENTITY: { DEFICIENCY: 'Deficiency' },
  AUDIT_ACTION: { DEFICIENCY_UPDATED: 'DEFICIENCY_UPDATED' },
}))

vi.mock('./distribution.service.js', () => ({
  distributionService: {
    distributeForInspection: vi.fn().mockResolvedValue({
      inspectionId: 'insp-1',
      trigger: 'manual',
      results: [{ kind: 'stop-work-order', status: 'sent', messageId: 'msg-1' }],
    }),
  },
}))

vi.mock('../lib/sms/sms-service.js', () => ({
  getSmsService: () => ({
    sendUrgent: vi.fn().mockResolvedValue({
      to: '+1555',
      body: 'test',
      sentAt: new Date().toISOString(),
      providerMessageId: 'sms-1',
    }),
  }),
  resolveSeniorScoPhone: () => '+15551234',
}))

describe('order-escalation.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('computeAppealDeadline adds 14 days', () => {
    const served = new Date('2026-01-01T12:00:00.000Z')
    const deadline = computeAppealDeadline(served)
    expect(deadline.getUTCDate()).toBe(served.getUTCDate() + APPEAL_DEADLINE_DAYS)
  })

  it('isSeniorSco matches authorities tag', () => {
    expect(isSeniorSco({ id: 'u1', authorities: ['Senior SCO'] })).toBe(true)
    expect(isSeniorSco({ id: 'u1', authorities: ['Building'] })).toBe(false)
  })

  it('overrideLockOut rejects non-senior admin', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'admin-1',
      role: 'ADMIN',
      authorities: [],
      name: 'Admin',
    } as any)

    await expect(
      orderEscalationService.overrideLockOut('def-1', 'admin-1', 'Valid reason text here'),
    ).rejects.toThrow(/Senior SCO/)
  })
})
