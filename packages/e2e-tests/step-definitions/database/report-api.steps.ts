/**
 * M10-S9 — Report generation, listing, and signed download (BDD smoke).
 */
import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { prisma } from '@codecomply/db'
import {
  ReportService,
  REPORT_SIGNED_URL_TTL_SECONDS,
} from '../../../../apps/api/src/services/report.service.js'
import type { ObjectStorageClient } from '../../../../apps/api/src/lib/storage/storage-client.js'

const putObject = async () => {}
const getSignedGetUrl = async (_kind: 'photos' | 'documents', key: string) =>
  `https://e2e.example/${key}?ttl=${REPORT_SIGNED_URL_TTL_SECONDS}`

const storage = {
  putObject,
  getSignedGetUrl,
  getObjectBytes: async () => new Uint8Array(),
} as unknown as ObjectStorageClient

const service = new ReportService(storage)

let inspectorId = ''
let inspectionId = ''
let permitId = ''
let reportId = ''

Given('M10-S9 report API test data is prepared', async function () {
  await prisma.report.deleteMany({
    where: { inspection: { notes: 'M10-S9 e2e report API' } },
  })
  await prisma.inspectionSchedule.deleteMany({
    where: { inspection: { notes: 'M10-S9 e2e report API' } },
  })
  await prisma.permitInspection.deleteMany({
    where: { notes: 'M10-S9 e2e report API' },
  })

  const inspector = await prisma.user.create({
    data: {
      email: `m10-s9-e2e-${Date.now()}@example.com`,
      name: 'M10 S9 E2E',
      role: 'SCO',
    },
  })
  inspectorId = inspector.id

  const permit = await prisma.permit.create({
    data: {
      permitNumber: `M10-S9-E2E-${Date.now()}`,
      address: '9 Report Way',
      scope: 'Residential',
      status: 'ACTIVE',
    },
  })
  permitId = permit.id

  const inspection = await prisma.permitInspection.create({
    data: {
      permitId,
      scheduledDate: new Date('2026-12-20T09:00:00.000Z'),
      status: 'PASSED',
      completedDate: new Date('2026-12-20T11:00:00.000Z'),
      inspectorId,
      notes: 'M10-S9 e2e report API',
    },
  })
  inspectionId = inspection.id

  await prisma.inspectionSchedule.create({
    data: {
      inspectionId,
      assignedToId: inspectorId,
    },
  })
})

When('an inspection report is generated and stored', async function () {
  const row = await service.generateAndStore({ inspectionId, type: 'INSPECTION' })
  reportId = row.id
  expect(row.hash).toMatch(/^[a-f0-9]{64}$/)
})

Then('the report should appear in the inspection report list', async function () {
  const rows = await service.listForInspection(inspectionId)
  expect(rows.some((r) => r.id === reportId)).toBe(true)
})

Then('a signed download URL should be available for that report', async function () {
  const url = await service.getSignedDownloadUrl(reportId)
  expect(url).toContain('https://e2e.example/')

  await prisma.report.deleteMany({ where: { inspectionId } })
  await prisma.inspectionSchedule.deleteMany({ where: { inspectionId } })
  await prisma.permitInspection.deleteMany({ where: { id: inspectionId } })
  await prisma.permit.deleteMany({ where: { id: permitId } })
  await prisma.user.deleteMany({ where: { id: inspectorId } })
})
