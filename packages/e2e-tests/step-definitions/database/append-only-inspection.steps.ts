/**
 * M10-S8 — Append-only finalized inspections (BDD smoke).
 */
import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { prisma, addendumDelegateOf } from '@codecomply/db'
import { InspectionService } from '../../../../apps/api/src/services/inspection.service.js'
import { ImmutableInspectionError } from '../../../../apps/api/src/middleware/immutable.js'

const addendum = addendumDelegateOf(prisma)
const service = new InspectionService()

let inspectorId = ''
let inspectionId = ''

Given('M10-S8 append-only test data is prepared', async function () {
  await addendum.deleteMany({
    where: { inspection: { notes: 'M10-S8 e2e append-only' } },
  })
  await prisma.inspectionSchedule.deleteMany({
    where: { inspection: { notes: 'M10-S8 e2e append-only' } },
  })
  await prisma.permitInspection.deleteMany({
    where: { notes: 'M10-S8 e2e append-only' },
  })

  const inspector = await prisma.user.create({
    data: {
      email: `m10-s8-e2e-${Date.now()}@example.com`,
      name: 'M10 S8 E2E',
      role: 'SCO',
    },
  })
  inspectorId = inspector.id

  const inspection = await prisma.permitInspection.create({
    data: {
      scheduledDate: new Date('2026-12-15T09:00:00.000Z'),
      status: 'PASSED',
      finalizedAt: new Date('2026-12-15T11:00:00.000Z'),
      completedDate: new Date('2026-12-15T11:00:00.000Z'),
      inspectorId,
      notes: 'M10-S8 e2e append-only',
      documentHash: 'e'.repeat(64),
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

When('an unauthorized update is attempted on the finalized inspection', async function () {
  try {
    await service.update(inspectionId, inspectorId, { notes: 'tamper attempt' })
    throw new Error('Expected ImmutableInspectionError')
  } catch (err) {
    expect(err).toBeInstanceOf(ImmutableInspectionError)
  }
})

Then('the update should be rejected as immutable', async function () {
  const row = await prisma.permitInspection.findUniqueOrThrow({ where: { id: inspectionId } })
  expect(row.notes).toBe('M10-S8 e2e append-only')
})

When('an addendum is added to the finalized inspection', async function () {
  await service.createAddendum(inspectionId, inspectorId, {
    reason: 'Correct legal land description',
    content: 'Quarter section updated per permit amendment.',
  })
})

Then('the addendum should be stored for that inspection', async function () {
  const addendums = await addendum.findMany({ where: { inspectionId } })
  expect(addendums.length).toBe(1)
  expect(addendums[0].reason).toContain('legal land')

  await addendum.deleteMany({ where: { inspectionId } })
  await prisma.inspectionSchedule.deleteMany({ where: { inspectionId } })
  await prisma.permitInspection.deleteMany({ where: { id: inspectionId } })
  await prisma.user.deleteMany({ where: { id: inspectorId } })
})
