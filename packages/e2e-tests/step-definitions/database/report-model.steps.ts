/**
 * M10-S4 — Report Prisma model (BDD smoke).
 */
import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

let inspectionId = ''
let reportId = ''

Given('M10-S4 report test data is prepared', async function () {
  await prisma.report.deleteMany({
    where: { inspection: { notes: 'M10-S4 e2e report model' } },
  })
  await prisma.permitInspection.deleteMany({
    where: { notes: 'M10-S4 e2e report model' },
  })

  const inspection = await prisma.permitInspection.create({
    data: {
      scheduledDate: new Date('2026-10-20T15:00:00.000Z'),
      status: 'IN_PROGRESS',
      notes: 'M10-S4 e2e report model',
    },
  })
  inspectionId = inspection.id
})

When('I save a report row for that inspection', async function () {
  const report = await prisma.report.create({
    data: {
      inspectionId,
      type: 'NO_ENTRY',
      filename: 'no-entry-letter.pdf',
      storageKey: `documents/reports/e2e/${inspectionId}/no-entry.pdf`,
      hash: 'c'.repeat(64),
    },
  })
  reportId = report.id
})

Then('the report should include storage key and hash', async function () {
  const row = await prisma.report.findUniqueOrThrow({ where: { id: reportId } })
  expect(row.storageKey).toContain(inspectionId)
  expect(row.hash).toHaveLength(64)
  expect(row.type).toBe('NO_ENTRY')
})

Then('the report should list under the inspection', async function () {
  const inspection = await prisma.permitInspection.findUniqueOrThrow({
    where: { id: inspectionId },
    include: { reports: true },
  })
  expect(inspection.reports.some((r) => r.id === reportId)).toBe(true)

  await prisma.report.deleteMany({ where: { id: reportId } })
  await prisma.permitInspection.deleteMany({ where: { id: inspectionId } })
})
