import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@codecomply/db'
import { DistributionService } from './distribution.service.js'
import type { EmailService } from '../lib/email/email-service.js'
import type { ReportService } from './report.service.js'
import type { AuditLogService } from './audit-log.service.js'

vi.mock('@codecomply/db', () => ({
  prisma: {
    permitInspection: { findUnique: vi.fn() },
    report: { update: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn() },
  },
}))

function baseInspection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'insp-1',
    permitId: 'perm-1',
    status: 'PASSED',
    finalizedAt: new Date('2026-06-01T12:00:00.000Z'),
    permit: { permitNumber: 'P-100', address: '1 Main' },
    schedule: { assignedTo: { email: 'sco@example.com', name: 'SCO Pat' } },
    deficiencies: [],
    reports: [],
    ...overrides,
  }
}

describe('DistributionService', () => {
  const sendTemplated = vi.fn()
  const generateAndStore = vi.fn()
  const getObjectBytes = vi.fn()
  const append = vi.fn()
  const listForEntity = vi.fn()
  const sleepFn = vi.fn(async () => {})

  let service: DistributionService

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.DISTRIBUTION_OWNER_EMAIL = 'owner@example.com'
    process.env.DISTRIBUTION_CONTRACTOR_EMAIL = 'contractor@example.com'

    sendTemplated.mockResolvedValue({ messageId: 'msg-1' })
    generateAndStore.mockResolvedValue({
      id: 'rep-1',
      filename: 'inspection-report.pdf',
      storageKey: 'reports/insp-1/file.pdf',
      type: 'INSPECTION',
    })
    getObjectBytes.mockResolvedValue(new Uint8Array([37, 80, 68, 70]))
    listForEntity.mockResolvedValue([])
    append.mockResolvedValue({})
    vi.mocked(prisma.report.update).mockResolvedValue({} as never)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

    service = new DistributionService({
      reportService: { generateAndStore } as unknown as ReportService,
      emailService: { sendTemplated } as unknown as EmailService,
      storage: { getObjectBytes, putObject: vi.fn(), getSignedGetUrl: vi.fn() },
      auditLog: { append, listForEntity } as unknown as AuditLogService,
      maxRetries: 3,
      retryDelayMs: 1,
      sleepFn,
    })
  })

  it('distributes inspection report to owner with PDF attachment', async () => {
    vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(baseInspection() as never)

    const batch = await service.distributeForInspection('insp-1', 'user-1', 'sync')

    const reportResult = batch.results.find((r) => r.kind === 'inspection-report')
    expect(reportResult?.status).toBe('sent')
    expect(generateAndStore).toHaveBeenCalled()
    expect(sendTemplated).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@example.com',
        template: 'inspection-report',
        attachments: [expect.objectContaining({ filename: 'inspection-report.pdf' })],
      }),
    )
    expect(prisma.report.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rep-1' },
        data: expect.objectContaining({ distributedAt: expect.any(Date) }),
      }),
    )
    expect(append).toHaveBeenCalledWith(expect.objectContaining({ action: 'REPORT_DISTRIBUTED' }))
  })

  it('skips inspection report when not finalized', async () => {
    vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(
      baseInspection({ status: 'IN_PROGRESS', finalizedAt: null }) as never,
    )

    const batch = await service.distributeForInspection('insp-1', 'user-1', 'sync')
    const reportResult = batch.results.find((r) => r.kind === 'inspection-report')
    expect(reportResult?.status).toBe('skipped')
    expect(generateAndStore).not.toHaveBeenCalled()
  })

  it('distributes deficiency notice to contractor', async () => {
    vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(
      baseInspection({
        status: 'IN_PROGRESS',
        finalizedAt: null,
        deficiencies: [
          {
            id: 'def-1',
            description: 'Missing guard',
            status: 'OPEN',
            isStopWork: false,
            dueDate: null,
            verificationOfCompliance: null,
          },
        ],
      }) as never,
    )

    const batch = await service.distributeForInspection('insp-1', 'user-1', 'sync')
    const notice = batch.results.find((r) => r.kind === 'deficiency-notice')
    expect(notice?.status).toBe('sent')
    expect(sendTemplated).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'contractor@example.com',
        template: 'deficiency-notice',
      }),
    )
  })

  it('retries email delivery before failing', async () => {
    vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(
      baseInspection({
        status: 'IN_PROGRESS',
        finalizedAt: null,
        deficiencies: [
          {
            id: 'def-2',
            description: 'Unsafe',
            status: 'OPEN',
            isStopWork: false,
            dueDate: null,
            verificationOfCompliance: null,
          },
        ],
      }) as never,
    )

    sendTemplated
      .mockRejectedValueOnce(new Error('temporary'))
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce({ messageId: 'msg-retry' })

    const batch = await service.distributeForInspection('insp-1', 'user-1', 'sync', true)
    const notice = batch.results.find((r) => r.kind === 'deficiency-notice')
    expect(notice?.status).toBe('sent')
    expect(sendTemplated).toHaveBeenCalledTimes(3)
    expect(sleepFn).toHaveBeenCalledTimes(2)
  })

  it('records failure after retries are exhausted', async () => {
    vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(
      baseInspection({
        status: 'IN_PROGRESS',
        finalizedAt: null,
        deficiencies: [
          {
            id: 'def-3',
            description: 'Issue',
            status: 'OPEN',
            isStopWork: false,
            dueDate: null,
            verificationOfCompliance: null,
          },
        ],
      }) as never,
    )

    sendTemplated.mockRejectedValue(new Error('SendGrid down'))

    const batch = await service.distributeForInspection('insp-1', 'user-1', 'sync', true)
    const notice = batch.results.find((r) => r.kind === 'deficiency-notice')
    expect(notice?.status).toBe('failed')
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'REPORT_DISTRIBUTION_FAILED' }),
    )
  })

  it('distributeManually requires admin', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'SCO' } as never)
    await expect(service.distributeManually('insp-1', 'sco-1')).rejects.toThrow(/admin/)
  })

  it('distributeManually allows admin trigger', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'ADMIN' } as never)
    vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(
      baseInspection({ status: 'IN_PROGRESS', finalizedAt: null }) as never,
    )

    const batch = await service.distributeManually('insp-1', 'admin-1')
    expect(batch.trigger).toBe('manual')
  })

  it('distributes stop work order to all parties', async () => {
    vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(
      baseInspection({
        status: 'IN_PROGRESS',
        finalizedAt: null,
        deficiencies: [
          {
            id: 'def-sw',
            description: 'Unsafe excavation',
            status: 'OPEN',
            isStopWork: true,
            dueDate: null,
            verificationOfCompliance: null,
          },
        ],
      }) as never,
    )

    const batch = await service.distributeForInspection('insp-1', 'user-1', 'sync', true)
    const swo = batch.results.find((r) => r.kind === 'stop-work-order')
    expect(swo?.status).toBe('sent')
    expect(sendTemplated).toHaveBeenCalledWith(
      expect.objectContaining({
        template: 'stop-work-order',
        to: expect.arrayContaining([
          'owner@example.com',
          'contractor@example.com',
          'sco@example.com',
        ]),
      }),
    )
  })

  it('distributes VoC decision to submitter', async () => {
    process.env.DISTRIBUTION_VOC_SUBMITTER_EMAIL = 'submitter@example.com'
    vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(
      baseInspection({
        status: 'IN_PROGRESS',
        finalizedAt: null,
        deficiencies: [
          {
            id: 'def-voc',
            description: 'Guardrail',
            status: 'CLOSED',
            isStopWork: false,
            dueDate: null,
            vocNotes: 'Approved',
            verificationOfCompliance: {
              id: 'voc-1',
              status: 'ACCEPTED',
              comments: 'Looks good',
            },
          },
        ],
      }) as never,
    )

    const batch = await service.distributeForInspection('insp-1', 'user-1', 'sync', true)
    const voc = batch.results.find((r) => r.kind === 'voc-decision')
    expect(voc?.status).toBe('sent')
    expect(sendTemplated).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'submitter@example.com',
        template: 'voc-decision',
      }),
    )
  })

  it('skips when audit log shows prior distribution', async () => {
    listForEntity.mockResolvedValue([
      {
        action: 'REPORT_DISTRIBUTED',
        metadata: { kind: 'deficiency-notice' },
      },
    ] as never)

    vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(
      baseInspection({
        status: 'IN_PROGRESS',
        finalizedAt: null,
        deficiencies: [
          {
            id: 'def-1',
            description: 'Missing guard',
            status: 'OPEN',
            isStopWork: false,
            dueDate: null,
            verificationOfCompliance: null,
          },
        ],
      }) as never,
    )

    const batch = await service.distributeForInspection('insp-1', 'user-1', 'sync')
    const notice = batch.results.find((r) => r.kind === 'deficiency-notice')
    expect(notice?.status).toBe('skipped')
    expect(notice?.reason).toBe('Already distributed')
  })

  it('fails inspection report distribution when PDF send fails', async () => {
    vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(baseInspection() as never)
    sendTemplated.mockRejectedValue(new Error('SMTP error'))

    const batch = await service.distributeForInspection('insp-1', 'user-1', 'sync', true)
    const reportResult = batch.results.find((r) => r.kind === 'inspection-report')
    expect(reportResult?.status).toBe('failed')
    expect(reportResult?.error).toContain('SMTP error')
  })

  it('resolveContacts falls back to OWNER role user', async () => {
    delete process.env.DISTRIBUTION_OWNER_EMAIL
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ email: 'owner-user@example.com' } as never)

    const contacts = await service.resolveContacts(baseInspection() as never)
    expect(contacts.ownerEmail).toBe('owner-user@example.com')
  })

  it('resolveContacts throws when owner email is missing', async () => {
    delete process.env.DISTRIBUTION_OWNER_EMAIL
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

    await expect(service.resolveContacts(baseInspection() as never)).rejects.toThrow(
      /Owner email not configured/,
    )
  })

  it('onSyncPushComplete deduplicates inspection ids', async () => {
    vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(
      baseInspection({ status: 'IN_PROGRESS', finalizedAt: null }) as never,
    )

    const batches = await service.onSyncPushComplete(['insp-1', 'insp-1'], 'user-1')
    expect(batches).toHaveLength(1)
  })

  it('throws when inspection is missing', async () => {
    vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(null)
    await expect(service.distributeForInspection('missing', 'user-1', 'sync')).rejects.toThrow(
      /not found/,
    )
  })
})
