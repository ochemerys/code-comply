/**
 * Step definitions: Checklist database schema E2E (M5-S1)
 */

import { Given, When, Then, Before } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

/** When generated `PrismaClient` omits `photo`, cleanup can still call `photo.deleteMany`. */
type PrismaClientWithPhoto = PrismaClient & {
  photo: { deleteMany: (args?: object) => Promise<unknown> }
}

const prisma = new PrismaClient() as PrismaClientWithPhoto

interface ChecklistWorld {
  template?: { id: string; versionHash: string }
  error?: { code?: string }
  inspectionId?: string
  templateId?: string
  execution?: { id: string; versionHash: string }
  foundTemplates?: { id: string; name: string }[]
}

const cw: ChecklistWorld = {}

Before(function () {
  Object.keys(cw).forEach((k) => delete cw[k as keyof ChecklistWorld])
})

Given('the checklist database is clean', async function () {
  await prisma.checklistExecution.deleteMany()
  await prisma.checklistTemplate.deleteMany()
  await prisma.codeLibrary.deleteMany()
  await prisma.inspectionSchedule.deleteMany()
  await prisma.photo.deleteMany()
  await prisma.deficiency.deleteMany()
  await prisma.permitInspection.deleteMany()
  await prisma.permit.deleteMany()
})

When('I create a checklist template:', async function (dataTable: any) {
  const row = dataTable.rowsHash()
  const items = JSON.parse(row.items)
  cw.template = await prisma.checklistTemplate.create({
    data: {
      name: row.name,
      discipline: row.discipline,
      versionHash: row.versionHash,
      items,
    },
  })
})

Then('the checklist template should be persisted', function () {
  expect(cw.template?.id).toBeDefined()
})

Then('the template versionHash should be unique in the database', async function () {
  const count = await prisma.checklistTemplate.count({
    where: { versionHash: cw.template!.versionHash },
  })
  expect(count).toBe(1)
})

Given(
  'a checklist template exists with versionHash {string}',
  async function (versionHash: string) {
    const t = await prisma.checklistTemplate.create({
      data: {
        name: 'Seed template',
        discipline: 'Building',
        versionHash,
        items: [],
      },
    })
    cw.templateId = t.id
    cw.template = { id: t.id, versionHash }
  },
)

When('I attempt another template with versionHash {string}', async function (versionHash: string) {
  try {
    await prisma.checklistTemplate.create({
      data: {
        name: 'Duplicate hash',
        discipline: 'Building',
        versionHash,
        items: [],
      },
    })
  } catch (e: any) {
    cw.error = e
  }
})

Then('the checklist template create should fail with unique constraint', function () {
  expect(cw.error).toBeDefined()
  expect(cw.error?.code).toBe('P2002')
})

When(
  'I insert code library row with code {string} section {string} and title {string}',
  async function (code: string, section: string, title: string) {
    await prisma.codeLibrary.create({
      data: { code, section, title },
    })
  },
)

Then('code library should have {int} rows for NBC', async function (n: number) {
  const count = await prisma.codeLibrary.count({ where: { code: 'NBC' } })
  expect(count).toBe(n)
})

When(
  'I attempt duplicate code library with code {string} and section {string}',
  async function (code: string, section: string) {
    try {
      await prisma.codeLibrary.create({
        data: { code, section, title: 'dup' },
      })
    } catch (e: any) {
      cw.error = e
    }
  },
)

Then('the code library create should fail with unique constraint', function () {
  expect(cw.error).toBeDefined()
  expect(cw.error?.code).toBe('P2002')
})

Given('a permit and inspection exist for checklist E2E', async function () {
  const permit = await prisma.permit.create({
    data: {
      permitNumber: 'M5-E2E-PERM-001',
      address: 'E2E Checklist Lane',
      scope: 'Test',
    },
  })
  const inspection = await prisma.permitInspection.create({
    data: {
      permitId: permit.id,
      scheduledDate: new Date('2026-06-01'),
      status: 'IN_PROGRESS',
    },
  })
  cw.inspectionId = inspection.id
})

When('I create a checklist execution for that inspection', async function () {
  const template = await prisma.checklistTemplate.findFirst({
    where: { id: cw.templateId! },
  })
  cw.execution = await prisma.checklistExecution.create({
    data: {
      inspectionId: cw.inspectionId!,
      templateId: cw.templateId!,
      versionHash: template!.versionHash,
      responses: {},
      progress: 0,
    },
  })
})

Then('the execution should reference the template versionHash', function () {
  expect(cw.execution?.versionHash).toBe('sha256:e2e-exec')
})

Then('the execution should link to the inspection and template', async function () {
  const row = await prisma.checklistExecution.findUnique({
    where: { id: cw.execution!.id },
    include: { inspection: true, template: true },
  })
  expect(row?.inspectionId).toBe(cw.inspectionId)
  expect(row?.templateId).toBe(cw.templateId)
  expect(row?.template.versionHash).toBe('sha256:e2e-exec')
})

Given('an active Building template and inactive Plumbing template exist', async function () {
  await prisma.checklistTemplate.createMany({
    data: [
      {
        name: 'Building active',
        discipline: 'Building',
        versionHash: 'sha256:e2e-building-on',
        items: [],
        isActive: true,
      },
      {
        name: 'Plumbing inactive',
        discipline: 'Plumbing',
        versionHash: 'sha256:e2e-plumbing-off',
        items: [],
        isActive: false,
      },
    ],
  })
})

When('I query active Building templates', async function () {
  cw.foundTemplates = await prisma.checklistTemplate.findMany({
    where: { discipline: 'Building', isActive: true },
    select: { id: true, name: true },
  })
})

Then('I should get only the Building active template', function () {
  expect(cw.foundTemplates).toHaveLength(1)
  expect(cw.foundTemplates![0].name).toBe('Building active')
})
