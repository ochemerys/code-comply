/**
 * M6-S4: Deficiency HTTP routes — Hono app.request + real JWT auth.
 */
import { Given, When, Then, Before } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import * as bcrypt from 'bcrypt'
import type { PrismaClient } from '@prisma/client'
import { prisma as prismaBase } from '@codecomply/db'
import { app } from '../../../../apps/api/src/app.js'
import { authService } from '../../../../apps/api/src/services/auth.service.js'
import { deficiencyNotificationHooks } from '../../../../apps/api/src/services/deficiency.service.js'

/** When generated `PrismaClient` omits `photo`, cleanup can still call `photo.deleteMany`. */
type PrismaClientWithPhoto = PrismaClient & {
  photo: { deleteMany: (args?: { where?: object }) => Promise<unknown> }
}

const prisma = prismaBase as PrismaClientWithPhoto

const testPassword = 'E2eDeficiencyApi#1'
let testEmail: string
let inspectionId: string
let lastStatus: number
let lastJson: unknown
let createdDeficiencyId: string | undefined
let notifyCalls = 0
let prevStopWorkHook: typeof deficiencyNotificationHooks.onStopWorkOrderIssued | undefined

async function authHeaders(): Promise<Record<string, string>> {
  const pair = await authService.login({ email: testEmail, password: testPassword })
  return { Authorization: `Bearer ${pair.accessToken}` }
}

Before(function () {
  lastStatus = 0
  lastJson = undefined
  createdDeficiencyId = undefined
  notifyCalls = 0
  if (prevStopWorkHook) {
    deficiencyNotificationHooks.onStopWorkOrderIssued = prevStopWorkHook
    prevStopWorkHook = undefined
  }
})

Given('deficiency API route test data is prepared', async function () {
  await prisma.photo.deleteMany({
    where: { inspection: { notes: 'M6-E2E deficiency HTTP routes' } },
  })
  await prisma.deficiency.deleteMany({
    where: { inspection: { notes: 'M6-E2E deficiency HTTP routes' } },
  })
  await prisma.inspectionSchedule.deleteMany({
    where: { inspection: { notes: 'M6-E2E deficiency HTTP routes' } },
  })
  await prisma.permitInspection.deleteMany({
    where: { notes: 'M6-E2E deficiency HTTP routes' },
  })
  await prisma.user.deleteMany({
    where: { email: { endsWith: '@deficiency-http-routes.e2e' } },
  })

  testEmail = `inspector-${Date.now()}@deficiency-http-routes.e2e`
  const passwordHash = await bcrypt.hash(testPassword, 10)

  await prisma.user.create({
    data: {
      email: testEmail,
      name: 'E2E Deficiency API',
      role: 'SCO',
      passwordHash,
    },
  })

  const inspection = await prisma.permitInspection.create({
    data: {
      scheduledDate: new Date('2026-08-01'),
      status: 'IN_PROGRESS',
      notes: 'M6-E2E deficiency HTTP routes',
    },
  })
  inspectionId = inspection.id

  const user = await prisma.user.findUniqueOrThrow({ where: { email: testEmail } })
  await prisma.inspectionSchedule.create({
    data: {
      inspectionId: inspection.id,
      assignedToId: user.id,
    },
  })
})

Given('I am logged in to the API as the deficiency route test inspector', async function () {
  const pair = await authService.login({ email: testEmail, password: testPassword })
  expect(pair.accessToken.length).toBeGreaterThan(10)
})

When('I request GET deficiency list for test inspection', async function () {
  const headers = await authHeaders()
  const res = await app.request(`/api/deficiencies?inspectionId=${inspectionId}`, { headers })
  lastStatus = res.status
  lastJson = await res.json()
})

When('I request POST create deficiency for test inspection', async function () {
  const headers = await authHeaders()
  const clientId = `e2e-def-api-${Date.now()}`
  const res = await app.request('/api/deficiencies', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId,
      inspectionId,
      description: 'E2E deficiency create at least ten chars',
      severity: 'MAJOR',
    }),
  })
  lastStatus = res.status
  lastJson = await res.json()
  const body = lastJson as { id?: string }
  if (body.id) createdDeficiencyId = body.id
})

When('I request POST create deficiency for stop work scenario', async function () {
  const headers = await authHeaders()
  const clientId = `e2e-def-sw-${Date.now()}`
  const res = await app.request('/api/deficiencies', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId,
      inspectionId,
      description: 'Stop work HTTP scenario ten chars',
      severity: 'MAJOR',
    }),
  })
  lastStatus = res.status
  lastJson = await res.json()
  const body = lastJson as { id?: string }
  if (body.id) createdDeficiencyId = body.id
})

When('I request POST stop-work for created deficiency', async function () {
  if (!createdDeficiencyId) throw new Error('No deficiency id')
  notifyCalls = 0
  prevStopWorkHook = deficiencyNotificationHooks.onStopWorkOrderIssued
  deficiencyNotificationHooks.onStopWorkOrderIssued = async () => {
    notifyCalls += 1
  }
  const headers = await authHeaders()
  const res = await app.request(`/api/deficiencies/${createdDeficiencyId}/stop-work`, {
    method: 'POST',
    headers,
  })
  lastStatus = res.status
  lastJson = await res.json()
})

Then('the deficiency HTTP response status should be {int}', function (expected: number) {
  expect(lastStatus).toBe(expected)
})

Then('the API response should include deficiency id', function () {
  const body = lastJson as { id?: string }
  expect(body.id).toBeDefined()
  expect(typeof body.id).toBe('string')
})

Then('the Stop Work notification hook should have been invoked for deficiency API', function () {
  expect(notifyCalls).toBeGreaterThanOrEqual(1)
})
