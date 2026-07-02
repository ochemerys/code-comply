/**
 * M10-S7 — Addendum Prisma model (BDD smoke).
 */
import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

let authorId = ''
let inspectionId = ''
let addendumId = ''

Given('M10-S7 addendum test data is prepared', async function () {
  await prisma.addendum.deleteMany({
    where: { inspection: { notes: 'M10-S7 e2e addendum model' } },
  })
  await prisma.permitInspection.deleteMany({
    where: { notes: 'M10-S7 e2e addendum model' },
  })

  const author = await prisma.user.create({
    data: {
      email: `m10-s7-addendum-e2e-${Date.now()}@example.com`,
      name: 'M10 S7 Addendum E2E',
      role: 'SCO',
    },
  })
  authorId = author.id

  const inspection = await prisma.permitInspection.create({
    data: {
      scheduledDate: new Date('2026-12-10T10:00:00.000Z'),
      status: 'PASSED',
      finalizedAt: new Date('2026-12-10T12:00:00.000Z'),
      notes: 'M10-S7 e2e addendum model',
    },
  })
  inspectionId = inspection.id
})

When('an addendum is created for the inspection', async function () {
  const addendum = await prisma.addendum.create({
    data: {
      inspectionId,
      reason: 'Clarify site address spelling',
      content: 'Legal land description listed NE 1/4; correct quarter is NW 1/4 per permit file.',
      createdById: authorId,
      signature: 'data:image/png;base64,e2e-signature',
    },
  })
  addendumId = addendum.id
})

Then('the addendum should reference the inspection with reason and content', async function () {
  const row = await prisma.addendum.findUniqueOrThrow({
    where: { id: addendumId },
    include: { inspection: true },
  })
  expect(row.inspectionId).toBe(inspectionId)
  expect(row.reason).toContain('address')
  expect(row.content).toContain('NW 1/4')
  expect(row.inspection.notes).toBe('M10-S7 e2e addendum model')
})

Then('the addendum should store an optional signature and created timestamp', async function () {
  const row = await prisma.addendum.findUniqueOrThrow({ where: { id: addendumId } })
  expect(row.signature).toContain('base64')
  expect(row.createdAt).toBeInstanceOf(Date)

  await prisma.addendum.deleteMany({ where: { id: addendumId } })
  await prisma.permitInspection.deleteMany({ where: { id: inspectionId } })
  await prisma.user.deleteMany({ where: { id: authorId } })
})
