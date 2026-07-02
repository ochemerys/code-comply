import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { integrationDb as db } from '../../src/test-utils/integration-db.js'
import { DistributionService } from '../../src/services/distribution.service.js'
import { EmailService } from '../../src/lib/email/email-service.js'
import { ReportService } from '../../src/services/report.service.js'
import type { ObjectStorageClient } from '../../src/lib/storage/storage-client.js'

describe.sequential('DistributionService integration (M10-S12)', () => {
  let inspectionId: string
  let inspectorId: string
  let adminId: string
  let ownerId: string
  let permitId: string
  let deficiencyId: string

  const sentSubjects: string[] = []
  const putObjectMock = vi.fn(
    async (_kind: 'photos' | 'documents', _key: string, _body: Buffer, _ct?: string) => {},
  )
  const getObjectBytesMock = vi.fn(
    async (_kind: 'photos' | 'documents', _key: string) => new Uint8Array([37, 80, 68, 70]),
  )

  let service: DistributionService

  beforeAll(async () => {
    const ts = Date.now()
    process.env.DISTRIBUTION_OWNER_EMAIL = `owner-dist-${ts}@example.com`
    process.env.DISTRIBUTION_CONTRACTOR_EMAIL = `contractor-dist-${ts}@example.com`

    inspectorId = `m10-s12-insp-${ts}`
    adminId = `m10-s12-admin-${ts}`
    ownerId = `m10-s12-owner-${ts}`

    await db.user.createMany({
      data: [
        {
          id: inspectorId,
          email: `m10-s12-sco-${ts}@example.com`,
          name: 'M10 S12 Inspector',
          role: 'SCO',
        },
        {
          id: adminId,
          email: `m10-s12-admin-${ts}@example.com`,
          name: 'M10 S12 Admin',
          role: 'ADMIN',
        },
        {
          id: ownerId,
          email: process.env.DISTRIBUTION_OWNER_EMAIL,
          name: 'Permit Owner',
          role: 'OWNER',
        },
      ],
    })

    const permit = await db.permit.create({
      data: {
        permitNumber: `M10-S12-${Date.now()}`,
        address: '12 Distribution Way',
        scope: 'Residential',
        status: 'ACTIVE',
      },
    })
    permitId = permit.id

    const inspection = await db.permitInspection.create({
      data: {
        permitId,
        scheduledDate: new Date('2026-12-01'),
        status: 'PASSED',
        finalizedAt: new Date('2026-12-01T12:00:00.000Z'),
        completedDate: new Date('2026-12-01T12:00:00.000Z'),
        inspectorId,
        notes: 'M10-S12 distribution integration',
      },
    })
    inspectionId = inspection.id

    await db.inspectionSchedule.create({
      data: { inspectionId, assignedToId: inspectorId },
    })

    const deficiency = await db.deficiency.create({
      data: {
        clientId: `m10-s12-def-${Date.now()}`,
        inspectionId,
        createdById: inspectorId,
        description: 'Missing guardrail',
        severity: 'MAJOR',
        status: 'OPEN',
      },
    })
    deficiencyId = deficiency.id

    const emailService = new EmailService(
      { apiKey: 'test', from: 'noreply@dist.test' },
      {
        send: async (message) => {
          sentSubjects.push(message.subject)
          return { messageId: `int-${sentSubjects.length}` }
        },
      },
    )

    const storage = {
      putObject: putObjectMock,
      getObjectBytes: getObjectBytesMock,
      getSignedGetUrl: async () => 'https://signed.example/report.pdf',
    } as unknown as ObjectStorageClient

    const reportService = new ReportService(storage)

    service = new DistributionService({
      reportService,
      emailService,
      storage,
      maxRetries: 2,
      retryDelayMs: 1,
    })
  })

  afterAll(async () => {
    await db.report.deleteMany({ where: { inspectionId } })
    await db.deficiency.deleteMany({ where: { inspectionId } })
    await db.inspectionSchedule.deleteMany({ where: { inspectionId } })
    await db.permitInspection.deleteMany({ where: { id: inspectionId } })
    await db.permit.deleteMany({ where: { id: permitId } })
    await db.user.deleteMany({ where: { id: { in: [inspectorId, adminId, ownerId] } } })
  })

  beforeEach(async () => {
    sentSubjects.length = 0
    putObjectMock.mockClear()
    getObjectBytesMock.mockClear()
    await db.report.deleteMany({ where: { inspectionId } })
  })

  it('automatic distribution generates report and emails owner on sync trigger', async () => {
    const batches = await service.onSyncPushComplete([inspectionId], inspectorId)

    expect(batches).toHaveLength(1)
    const sentReport = batches[0].results.find((r) => r.kind === 'inspection-report')
    expect(sentReport?.status).toBe('sent')
    expect(putObjectMock).toHaveBeenCalled()
    expect(sentSubjects.some((s) => s.includes('Inspection Report'))).toBe(true)

    const report = await db.report.findFirst({ where: { inspectionId, type: 'INSPECTION' } })
    expect(report?.distributedAt).not.toBeNull()
  })

  it('manual admin distribution sends deficiency notice', async () => {
    const batch = await service.distributeManually(inspectionId, adminId)
    const notice = batch.results.find((r) => r.kind === 'deficiency-notice')
    expect(notice?.status).toBe('sent')
    expect(sentSubjects.some((s) => s.includes('Deficiency Notice'))).toBe(true)
  })

  it('retries failed email sends before succeeding', async () => {
    let attempts = 0
    const storage = {
      putObject: async () => {},
      getObjectBytes: async () => new Uint8Array([37, 80, 68, 70]),
      getSignedGetUrl: async () => 'https://signed.example/report.pdf',
    } as unknown as ObjectStorageClient

    const flaky = new DistributionService({
      reportService: new ReportService(storage),
      emailService: new EmailService(
        { apiKey: 'test', from: 'noreply@dist.test' },
        {
          send: async (message) => {
            if (!message.subject.includes('Deficiency Notice')) {
              return { messageId: 'other' }
            }
            attempts += 1
            if (attempts < 2) throw new Error('transient')
            sentSubjects.push(message.subject)
            return { messageId: 'retry-ok' }
          },
        },
      ),
      storage,
      maxRetries: 3,
      retryDelayMs: 1,
    })

    const batch = await flaky.distributeForInspection(inspectionId, inspectorId, 'sync', true)
    const notice = batch.results.find((r) => r.kind === 'deficiency-notice')
    expect(notice?.status).toBe('sent')
    expect(attempts).toBe(2)
  })
})
