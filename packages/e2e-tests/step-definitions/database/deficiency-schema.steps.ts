/**
 * Step definitions: Deficiency database schema E2E (M6-S1)
 */

import { Given, When, Then, Before } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { PrismaClient, DeficiencySeverity } from '@prisma/client'

/** When generated `PrismaClient` omits `photo`, cleanup can still call `photo.deleteMany`. */
type PrismaClientWithPhoto = PrismaClient & {
  photo: { deleteMany: (args?: { where?: object }) => Promise<unknown> }
}

const prisma = new PrismaClient() as PrismaClientWithPhoto

interface DeficiencyWorld {
  userId?: string
  inspectionId?: string
  deficiencyId?: string
}

const w: DeficiencyWorld = {}

Before(function () {
  Object.keys(w).forEach((k) => delete w[k as keyof DeficiencyWorld])
})

Given('the deficiency schema test database is prepared', async function () {
  const existing = await prisma.permitInspection.findMany({
    where: { notes: 'M6-E2E deficiency schema' },
    select: { id: true },
  })
  const inspectionIds = existing.map((r) => r.id)
  if (inspectionIds.length > 0) {
    await prisma.photo.deleteMany({ where: { inspectionId: { in: inspectionIds } } })
    await prisma.deficiency.deleteMany({ where: { inspectionId: { in: inspectionIds } } })
    await prisma.inspectionSchedule.deleteMany({
      where: { inspectionId: { in: inspectionIds } },
    })
    await prisma.permitInspection.deleteMany({ where: { id: { in: inspectionIds } } })
  }
  await prisma.user.deleteMany({
    where: { email: { contains: 'm6-e2e-def-schema' } },
  })

  const user = await prisma.user.create({
    data: {
      email: `m6-e2e-def-schema-${Date.now()}@example.com`,
      name: 'M6 E2E Deficiency',
      role: 'SCO',
    },
  })
  w.userId = user.id
  const inspection = await prisma.permitInspection.create({
    data: {
      scheduledDate: new Date('2026-06-20'),
      status: 'IN_PROGRESS',
      notes: 'M6-E2E deficiency schema',
    },
  })
  w.inspectionId = inspection.id
})

When(
  'I create a deficiency with checklist item {string} and due date {string}',
  async function (checklistItemId: string, dueIsoDate: string) {
    const row = await prisma.deficiency.create({
      data: {
        clientId: `m6-e2e-cl-${Date.now()}`,
        inspectionId: w.inspectionId!,
        createdById: w.userId!,
        description: 'M6-E2E checklist due',
        severity: DeficiencySeverity.MAJOR,
        checklistItemId,
        dueDate: new Date(`${dueIsoDate}T12:00:00.000Z`),
      },
    })
    w.deficiencyId = row.id
  },
)

Then('the deficiency should have checklist item {string}', async function (expected: string) {
  const row = await prisma.deficiency.findUniqueOrThrow({ where: { id: w.deficiencyId! } })
  expect(row.checklistItemId).toBe(expected)
})

Then('the deficiency due date should be {string}', async function (dateStr: string) {
  const row = await prisma.deficiency.findUniqueOrThrow({ where: { id: w.deficiencyId! } })
  expect(row.dueDate?.toISOString().slice(0, 10)).toBe(dateStr)
})

When('I create a minimal deficiency for schema E2E', async function () {
  const row = await prisma.deficiency.create({
    data: {
      clientId: `m6-e2e-min-${Date.now()}`,
      inspectionId: w.inspectionId!,
      createdById: w.userId!,
      description: 'M6-E2E minimal',
      severity: DeficiencySeverity.MINOR,
    },
  })
  w.deficiencyId = row.id
})

Then('the deficiency isStopWork should be false', async function () {
  const row = await prisma.deficiency.findUniqueOrThrow({ where: { id: w.deficiencyId! } })
  expect(row.isStopWork).toBe(false)
})

Then('the deficiency isUnsafe should be false', async function () {
  const row = await prisma.deficiency.findUniqueOrThrow({ where: { id: w.deficiencyId! } })
  expect(row.isUnsafe).toBe(false)
})

When('I create a deficiency flagged Stop Work and unsafe', async function () {
  const row = await prisma.deficiency.create({
    data: {
      clientId: `m6-e2e-sw-${Date.now()}`,
      inspectionId: w.inspectionId!,
      createdById: w.userId!,
      description: 'M6-E2E stop work',
      severity: DeficiencySeverity.CRITICAL,
      isStopWork: true,
      isUnsafe: true,
    },
  })
  w.deficiencyId = row.id
})

Then('the deficiency isStopWork should be true', async function () {
  const row = await prisma.deficiency.findUniqueOrThrow({ where: { id: w.deficiencyId! } })
  expect(row.isStopWork).toBe(true)
})

Then('the deficiency isUnsafe should be true', async function () {
  const row = await prisma.deficiency.findUniqueOrThrow({ where: { id: w.deficiencyId! } })
  expect(row.isUnsafe).toBe(true)
})
