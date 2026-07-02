/**
 * M5-S3: ChecklistService BDD steps (uses real DB + domain service).
 */
import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { ChecklistService } from '../../../../apps/api/src/services/checklist.service.js'

/** When generated `PrismaClient` omits `photo`, cleanup can still call `photo.deleteMany`. */
type PrismaClientWithPhoto = PrismaClient & {
  photo: { deleteMany: (args?: object) => Promise<unknown> }
}

const prisma = new PrismaClient() as PrismaClientWithPhoto
const service = new ChecklistService()

interface Ctx {
  permitId?: string
  inspectionId?: string
  templateId?: string
  versionHash?: string
  executionId?: string
  lastError?: Error
  lastProgress?: number
}

const ctx: Ctx = {}

Given('checklist service E2E data is prepared', async function () {
  await prisma.checklistExecution.deleteMany()
  await prisma.checklistTemplate.deleteMany()
  await prisma.inspectionSchedule.deleteMany()
  await prisma.photo.deleteMany()
  await prisma.deficiency.deleteMany()
  await prisma.permitInspection.deleteMany()
  await prisma.permit.deleteMany()

  const permit = await prisma.permit.create({
    data: {
      permitNumber: `e2e-svc-${Date.now()}`,
      address: '1 Service Test Way',
      scope: 'E2E',
    },
  })
  ctx.permitId = permit.id

  const inspection = await prisma.permitInspection.create({
    data: {
      permitId: permit.id,
      scheduledDate: new Date('2026-07-01'),
      status: 'IN_PROGRESS',
    },
  })
  ctx.inspectionId = inspection.id

  ctx.versionHash = `sha256:e2e-svc-${Date.now()}`
  const template = await prisma.checklistTemplate.create({
    data: {
      name: 'E2E ChecklistService template',
      discipline: 'Building',
      version: 1,
      versionHash: ctx.versionHash,
      items: [
        { id: 'e2e-a', order: 1, text: 'First', isRequired: true },
        { id: 'e2e-b', order: 2, text: 'Second', isRequired: true },
      ],
      isActive: true,
    },
  })
  ctx.templateId = template.id
})

When('I load the checklist template by id via ChecklistService', async function () {
  const t = await service.getTemplate(ctx.templateId!)
  expect(t.id).toBe(ctx.templateId)
  expect(t.versionHash).toBe(ctx.versionHash)
})

Then('the template should have the expected version hash', function () {
  expect(ctx.versionHash).toBeDefined()
})

When('I start a checklist execution for the test inspection and template', async function () {
  const exec = await service.startExecution(ctx.inspectionId!, ctx.templateId!)
  ctx.executionId = exec.id
  expect(exec.versionHash).toBe(ctx.versionHash)
})

Then('the execution version hash should match the template', async function () {
  const row = await prisma.checklistExecution.findUnique({ where: { id: ctx.executionId! } })
  expect(row?.versionHash).toBe(ctx.versionHash)
})

Given('a checklist execution exists for the test inspection', async function () {
  const exec = await service.startExecution(ctx.inspectionId!, ctx.templateId!)
  ctx.executionId = exec.id
})

When('I attempt to record FAIL without code reference via ChecklistService', async function () {
  ctx.lastError = undefined
  try {
    await service.updateResponse(ctx.executionId!, 'e2e-a', {
      result: 'FAIL',
      timestamp: '2026-07-01T12:00:00.000Z',
    })
  } catch (e) {
    ctx.lastError = e as Error
  }
})

Then('ChecklistService should reject the update', function () {
  expect(ctx.lastError).toBeDefined()
  expect(ctx.lastError!.message).toMatch(/codeReference/i)
})

When('I pass the first checklist item via ChecklistService', async function () {
  await service.updateResponse(ctx.executionId!, 'e2e-a', {
    result: 'PASS',
    timestamp: '2026-07-01T12:00:00.000Z',
  })
  ctx.lastProgress = await service.getProgress(ctx.executionId!)
})

Then('checklist progress should be 50 percent', function () {
  expect(ctx.lastProgress).toBe(50)
})
