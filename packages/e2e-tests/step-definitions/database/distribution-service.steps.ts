/**
 * M10-S12 — Distribution service BDD smoke.
 */
import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { EmailService } from '../../../../apps/api/src/lib/email/email-service.js'
import { ReportService } from '../../../../apps/api/src/services/report.service.js'
import { DistributionService } from '../../../../apps/api/src/services/distribution.service.js'
import { prisma } from '@codecomply/db'

let inspectionId = ''
let inspectorId = ''
let permitId = ''
let messageIds: string[] = []

Given('M10-S12 distribution test harness is ready', async function () {
  process.env.DISTRIBUTION_OWNER_EMAIL = `owner-m10-s12-${Date.now()}@example.com`
  process.env.DISTRIBUTION_CONTRACTOR_EMAIL = `contractor-m10-s12-${Date.now()}@example.com`

  await prisma.report.deleteMany({
    where: { inspection: { notes: 'M10-S12 e2e distribution' } },
  })
  await prisma.inspectionSchedule.deleteMany({
    where: { inspection: { notes: 'M10-S12 e2e distribution' } },
  })
  await prisma.permitInspection.deleteMany({
    where: { notes: 'M10-S12 e2e distribution' },
  })

  const inspector = await prisma.user.create({
    data: {
      email: `m10-s12-e2e-insp-${Date.now()}@example.com`,
      name: 'M10 S12 E2E',
      role: 'SCO',
    },
  })
  inspectorId = inspector.id

  const permit = await prisma.permit.create({
    data: {
      permitNumber: `M10-S12-E2E-${Date.now()}`,
      address: '12 E2E Lane',
      scope: 'Residential',
      status: 'ACTIVE',
    },
  })
  permitId = permit.id

  const inspection = await prisma.permitInspection.create({
    data: {
      permitId,
      scheduledDate: new Date('2026-12-10'),
      status: 'PASSED',
      finalizedAt: new Date('2026-12-10T12:00:00.000Z'),
      completedDate: new Date('2026-12-10T12:00:00.000Z'),
      inspectorId,
      notes: 'M10-S12 e2e distribution',
    },
  })
  inspectionId = inspection.id

  await prisma.inspectionSchedule.create({
    data: { inspectionId, assignedToId: inspectorId },
  })

  messageIds = []
})

When('distribution runs after inspection sync', async function () {
  const emailService = new EmailService(
    { apiKey: 'e2e', from: 'noreply@e2e.test' },
    {
      send: async () => {
        const id = `e2e-msg-${messageIds.length + 1}`
        messageIds.push(id)
        return { messageId: id }
      },
    },
  )

  const storage = {
    putObject: async () => {},
    getObjectBytes: async () => new Uint8Array([37, 80, 68, 70]),
    getSignedGetUrl: async () => 'https://e2e.example/report.pdf',
  }

  const service = new DistributionService({
    reportService: new ReportService(storage as never),
    emailService,
    storage: storage as never,
  })

  const batches = await service.onSyncPushComplete([inspectionId], inspectorId)
  expect(
    batches[0].results.some((r) => r.kind === 'inspection-report' && r.status === 'sent'),
  ).toBe(true)
})

Then('inspection report delivery should be logged', async function () {
  const report = await prisma.report.findFirst({
    where: { inspectionId, type: 'INSPECTION' },
  })
  expect(report?.distributedAt).not.toBeNull()
  expect(messageIds.length).toBeGreaterThan(0)

  await prisma.report.deleteMany({ where: { inspectionId } })
  await prisma.inspectionSchedule.deleteMany({ where: { inspectionId } })
  await prisma.permitInspection.deleteMany({ where: { id: inspectionId } })
  await prisma.permit.deleteMany({ where: { id: permitId } })
  await prisma.user.deleteMany({ where: { id: inspectorId } })
})
