/**
 * M10-S5 — VerificationOfCompliance (BDD smoke).
 */
import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

let authorId = ''
let reviewerId = ''
let inspectionId = ''
let deficiencyId = ''
let vocId = ''

Given('M10-S5 VoC test data is prepared', async function () {
  await prisma.verificationOfCompliance.deleteMany({
    where: { deficiency: { inspection: { notes: 'M10-S5 e2e VoC' } } },
  })
  await prisma.deficiency.deleteMany({
    where: { inspection: { notes: 'M10-S5 e2e VoC' } },
  })
  await prisma.permitInspection.deleteMany({
    where: { notes: 'M10-S5 e2e VoC' },
  })

  const author = await prisma.user.create({
    data: {
      email: `voc-e2e-${Date.now()}@example.com`,
      name: 'VoC E2E',
      role: 'SCO',
    },
  })
  authorId = author.id

  const reviewer = await prisma.user.create({
    data: {
      email: `voc-e2e-rev-${Date.now()}@example.com`,
      name: 'VoC Reviewer E2E',
      role: 'ADMIN',
    },
  })
  reviewerId = reviewer.id

  const inspection = await prisma.permitInspection.create({
    data: {
      scheduledDate: new Date('2026-12-01'),
      status: 'IN_PROGRESS',
      notes: 'M10-S5 e2e VoC',
    },
  })
  inspectionId = inspection.id

  const deficiency = await prisma.deficiency.create({
    data: {
      clientId: `voc-e2e-${Date.now()}`,
      inspectionId,
      createdById: authorId,
      description: 'E2E deficiency',
      severity: 'MINOR',
    },
  })
  deficiencyId = deficiency.id
})

When('a VerificationOfCompliance record is created for the deficiency', async function () {
  const voc = await prisma.verificationOfCompliance.create({
    data: {
      deficiencyId,
      verificationDate: new Date('2026-12-02'),
      sectionTitle: 'Section 9',
      title: 'Repair complete',
      name: 'Contractor Co.',
      method: 'WRITTEN_ASSURANCE',
      submittedAt: new Date(),
      status: 'PENDING',
    },
  })
  vocId = voc.id
})

Then('the VoC should link to the deficiency with expected fields', async function () {
  const row = await prisma.verificationOfCompliance.findUniqueOrThrow({
    where: { id: vocId },
  })
  expect(row.deficiencyId).toBe(deficiencyId)
  expect(row.method).toBe('WRITTEN_ASSURANCE')
  expect(row.status).toBe('PENDING')
})

When('the VoC is accepted by a reviewer', async function () {
  await prisma.verificationOfCompliance.update({
    where: { id: vocId },
    data: {
      status: 'ACCEPTED',
      reviewedAt: new Date(),
      reviewedById: reviewerId,
    },
  })
})

Then('the VoC status should be ACCEPTED with reviewer set', async function () {
  const row = await prisma.verificationOfCompliance.findUniqueOrThrow({
    where: { id: vocId },
  })
  expect(row.status).toBe('ACCEPTED')
  expect(row.reviewedById).toBe(reviewerId)

  await prisma.verificationOfCompliance.deleteMany({ where: { id: vocId } })
  await prisma.deficiency.deleteMany({ where: { id: deficiencyId } })
  await prisma.permitInspection.deleteMany({ where: { id: inspectionId } })
  await prisma.user.deleteMany({ where: { id: { in: [authorId, reviewerId] } } })
})
