/**
 * M5-S5: Checklist & codes HTTP routes — uses Hono app.request + real JWT auth.
 */
import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import * as bcrypt from 'bcrypt'
import type { PrismaClient } from '@prisma/client'
import { prisma as prismaBase } from '@codecomply/db'
import { app } from '../../../../apps/api/src/app.js'
import { authService } from '../../../../apps/api/src/services/auth.service.js'

/** When generated `PrismaClient` omits `photo`, cleanup can still call `photo.deleteMany`. */
type PrismaClientWithPhoto = PrismaClient & {
  photo: { deleteMany: (args?: object) => Promise<unknown> }
}

const prisma = prismaBase as PrismaClientWithPhoto

const testPassword = 'E2eChecklistApi#1'
let testEmail: string
let templateId: string
let inspectionId: string
let executionId: string | undefined
let firstItemId: string
let lastStatus: number
let lastJson: unknown

async function authHeaders(): Promise<Record<string, string>> {
  const pair = await authService.login({ email: testEmail, password: testPassword })
  return { Authorization: `Bearer ${pair.accessToken}` }
}

Given('checklist API route test data is prepared', async function () {
  await prisma.checklistExecution.deleteMany()
  await prisma.checklistTemplate.deleteMany()
  await prisma.codeLibrary.deleteMany()
  await prisma.inspectionSchedule.deleteMany()
  await prisma.photo.deleteMany()
  await prisma.deficiency.deleteMany()
  await prisma.permitInspection.deleteMany()
  await prisma.permit.deleteMany()
  await prisma.user.deleteMany({ where: { email: { endsWith: '@checklist-api-routes.e2e' } } })

  testEmail = `inspector-${Date.now()}@checklist-api-routes.e2e`
  const passwordHash = await bcrypt.hash(testPassword, 10)

  await prisma.user.create({
    data: {
      email: testEmail,
      name: 'E2E Checklist API',
      role: 'SCO',
      passwordHash,
    },
  })
  const permit = await prisma.permit.create({
    data: {
      permitNumber: `E2E-CHK-${Date.now()}`,
      address: 'Checklist API route test',
      scope: 'E2E',
    },
  })

  const inspection = await prisma.permitInspection.create({
    data: {
      permitId: permit.id,
      scheduledDate: new Date('2026-08-01'),
      status: 'IN_PROGRESS',
    },
  })
  inspectionId = inspection.id

  firstItemId = 'e2e-api-item-1'
  const versionHash = `sha256:e2e-api-${Date.now()}`
  const template = await prisma.checklistTemplate.create({
    data: {
      name: 'E2E API template',
      discipline: 'Building',
      version: 1,
      versionHash,
      items: [{ id: firstItemId, order: 1, text: 'Verify item', isRequired: true }],
      isActive: true,
    },
  })
  templateId = template.id

  await prisma.codeLibrary.createMany({
    data: [
      {
        code: 'NBC',
        section: '9.10.1',
        title: 'Fire separation',
        description: null,
      },
      {
        code: 'NBC',
        section: '9.23.1',
        title: 'Wood framing',
        description: null,
      },
    ],
  })

  executionId = undefined
  lastStatus = 0
  lastJson = undefined
})

Given('I am logged in to the API as the test inspector', async function () {
  const pair = await authService.login({ email: testEmail, password: testPassword })
  expect(pair.accessToken.length).toBeGreaterThan(10)
})

When('I request GET {string}', async function (path: string) {
  const headers = await authHeaders()
  const res = await app.request(path, { headers })
  lastStatus = res.status
  lastJson = await res.json()
})

When('I request POST checklist execution for test data', async function () {
  const headers = await authHeaders()
  const res = await app.request('/api/checklists/executions', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inspectionId, templateId }),
  })
  lastStatus = res.status
  lastJson = await res.json()
  const body = lastJson as { id?: string }
  if (body.id) executionId = body.id
})

When('I request PATCH test execution responses with PASS for the first item', async function () {
  if (!executionId) throw new Error('No execution id — run POST execution first')
  const headers = await authHeaders()
  const res = await app.request(`/api/checklists/executions/${executionId}/responses`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      itemId: firstItemId,
      result: 'PASS',
      timestamp: '2026-08-01T12:00:00.000Z',
    }),
  })
  lastStatus = res.status
  lastJson = await res.json()
})

Then('the API response status should be {int}', function (expected: number) {
  expect(lastStatus).toBe(expected)
})

Then('the API response JSON should include template id from test data', function () {
  const list = lastJson as { id?: string }[]
  expect(Array.isArray(list)).toBe(true)
  expect(list.some((t) => t.id === templateId)).toBe(true)
})

Then('the API response should have numeric progress {int}', function (expected: number) {
  const body = lastJson as { progress?: number }
  expect(body.progress).toBe(expected)
})

Then(
  'the API response should have property {string} with value {string}',
  function (key: string, value: string) {
    const body = lastJson as Record<string, unknown>
    expect(String(body[key])).toBe(value)
  },
)
