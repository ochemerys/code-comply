/**
 * M10-S6 — VoCService BDD steps (real DB + domain service).
 */
import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { VoCService } from '../../../../apps/api/src/services/voc.service.js'

const prisma = new PrismaClient()
const service = new VoCService()

let inspectorId = ''
let adminId = ''
let inspectionId = ''
let deficiencyId = ''
let vocId = ''

const submitDto = {
  verificationDate: '2026-11-02T12:00:00.000Z',
  sectionTitle: 'Division B — Safety',
  title: 'Guardrail corrected',
  name: 'Building Owner LLC',
  method: 'SITE_VISIT' as const,
  comments: 'E2E VoC submission.',
}

Given('M10-S6 VoC service test data is prepared', async function () {
  await prisma.verificationOfCompliance.deleteMany({
    where: { deficiency: { inspection: { notes: 'M10-S6 e2e VoC service' } } },
  })
  await prisma.deficiency.deleteMany({
    where: { inspection: { notes: 'M10-S6 e2e VoC service' } },
  })
  await prisma.permitInspection.deleteMany({
    where: { notes: 'M10-S6 e2e VoC service' },
  })

  const inspector = await prisma.user.create({
    data: {
      email: `m10-s6-voc-e2e-${Date.now()}@example.com`,
      name: 'M10 S6 Inspector E2E',
      role: 'SCO',
    },
  })
  inspectorId = inspector.id

  const admin = await prisma.user.create({
    data: {
      email: `m10-s6-voc-e2e-admin-${Date.now()}@example.com`,
      name: 'M10 S6 Admin E2E',
      role: 'ADMIN',
    },
  })
  adminId = admin.id

  const inspection = await prisma.permitInspection.create({
    data: {
      scheduledDate: new Date('2026-12-01'),
      status: 'IN_PROGRESS',
      notes: 'M10-S6 e2e VoC service',
    },
  })
  inspectionId = inspection.id

  const deficiency = await prisma.deficiency.create({
    data: {
      clientId: `m10-s6-voc-e2e-${Date.now()}`,
      inspectionId,
      createdById: inspectorId,
      description: 'E2E deficiency for VoC service',
      severity: 'MAJOR',
      status: 'OPEN',
    },
  })
  deficiencyId = deficiency.id
})

When('the inspector submits VoC for the deficiency', async function () {
  const voc = await service.submit(deficiencyId, submitDto)
  vocId = voc.id
})

Then('the VoC should be pending for that deficiency', async function () {
  const row = await service.getByDeficiency(deficiencyId)
  expect(row?.id).toBe(vocId)
  expect(row?.status).toBe('PENDING')

  const deficiency = await prisma.deficiency.findUniqueOrThrow({ where: { id: deficiencyId } })
  expect(deficiency.status).toBe('VOC_SUBMITTED')
})

When('an admin accepts the VoC submission', async function () {
  await service.review(vocId, 'ACCEPTED', adminId)
})

Then('the deficiency should be closed after VoC acceptance', async function () {
  const voc = await prisma.verificationOfCompliance.findUniqueOrThrow({ where: { id: vocId } })
  expect(voc.status).toBe('ACCEPTED')
  expect(voc.reviewedById).toBe(adminId)

  const deficiency = await prisma.deficiency.findUniqueOrThrow({ where: { id: deficiencyId } })
  expect(deficiency.status).toBe('CLOSED')

  await prisma.verificationOfCompliance.deleteMany({ where: { id: vocId } })
  await prisma.deficiency.deleteMany({ where: { id: deficiencyId } })
  await prisma.permitInspection.deleteMany({ where: { id: inspectionId } })
  await prisma.user.deleteMany({ where: { id: { in: [inspectorId, adminId] } } })
})
