/**
 * M7-S19: Photo HTTP routes — Hono app.request + real JWT auth (skipped without R2 env).
 */
import { Given, When, Then, Before } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import * as bcrypt from 'bcrypt'
import type { PrismaClient } from '@prisma/client'
import { prisma as prismaBase } from '@codecomply/db'
import { app } from '../../../../apps/api/src/app.js'
import { authService } from '../../../../apps/api/src/services/auth.service.js'

type PrismaClientWithPhoto = PrismaClient & {
  photo: { deleteMany: (args?: { where?: object }) => Promise<unknown> }
}

const prisma = prismaBase as PrismaClientWithPhoto

const testPassword = 'E2ePhotoApi#1'
let testEmail: string
let inspectionId: string
let lastStatus: number
let lastCreatedPhotoId: string | undefined
let lastClientId: string | undefined

function r2Configured(): boolean {
  return !!(
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_ENDPOINT
  )
}

async function authHeaders(): Promise<Record<string, string>> {
  const pair = await authService.login({ email: testEmail, password: testPassword })
  return { Authorization: `Bearer ${pair.accessToken}` }
}

Before({ tags: '@photo-api' }, function () {
  lastStatus = 0
  lastCreatedPhotoId = undefined
  lastClientId = undefined
})

Given('photo API route E2E data is prepared', async function () {
  if (!r2Configured()) {
    return 'skipped'
  }

  await prisma.photo.deleteMany({
    where: { inspection: { notes: 'M7-E2E photo API routes' } },
  })
  await prisma.inspectionSchedule.deleteMany({
    where: { inspection: { notes: 'M7-E2E photo API routes' } },
  })
  await prisma.permitInspection.deleteMany({
    where: { notes: 'M7-E2E photo API routes' },
  })
  await prisma.user.deleteMany({
    where: { email: { endsWith: '@photo-api-routes.e2e' } },
  })

  testEmail = `inspector-${Date.now()}@photo-api-routes.e2e`
  const passwordHash = await bcrypt.hash(testPassword, 10)

  await prisma.user.create({
    data: {
      email: testEmail,
      name: 'E2E Photo API',
      role: 'SCO',
      passwordHash,
    },
  })

  const inspection = await prisma.permitInspection.create({
    data: {
      scheduledDate: new Date('2026-11-01'),
      status: 'IN_PROGRESS',
      notes: 'M7-E2E photo API routes',
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

When('I POST multipart photo upload for the test inspection', async function () {
  if (!r2Configured()) {
    return 'skipped'
  }
  const headers = await authHeaders()
  lastClientId = `e2e-photo-${Date.now()}`
  const form = new FormData()
  form.append('inspectionId', inspectionId)
  form.append('clientId', lastClientId)
  form.append('metadata', JSON.stringify({ e2e: true }))
  form.append(
    'file',
    new File([new TextEncoder().encode('e2e-photo-body')], 'site.jpg', {
      type: 'image/jpeg',
    }),
  )

  const res = await app.request('/api/photos', {
    method: 'POST',
    headers,
    body: form,
  })
  lastStatus = res.status
  if (res.status === 201 || res.status === 200) {
    const json = (await res.json()) as { id: string }
    lastCreatedPhotoId = json.id
  }
})

When(
  'I POST multipart photo upload for the test inspection twice with the same clientId',
  async function () {
    if (!r2Configured()) {
      return 'skipped'
    }
    const headers = await authHeaders()
    const clientId = `e2e-photo-dup-${Date.now()}`
    lastClientId = clientId

    const mkForm = () => {
      const form = new FormData()
      form.append('inspectionId', inspectionId)
      form.append('clientId', clientId)
      form.append('metadata', '{}')
      form.append('file', new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' }))
      return form
    }

    const first = await app.request('/api/photos', {
      method: 'POST',
      headers,
      body: mkForm(),
    })
    lastStatus = first.status
    if (first.status === 201) {
      const json = (await first.json()) as { id: string }
      lastCreatedPhotoId = json.id
    }

    const second = await app.request('/api/photos', {
      method: 'POST',
      headers,
      body: mkForm(),
    })
    lastStatus = second.status
  },
)

When('I DELETE the last created photo', async function () {
  if (!r2Configured() || !lastCreatedPhotoId) {
    return 'skipped'
  }
  const headers = await authHeaders()
  const q = lastClientId ? `?clientId=${encodeURIComponent(lastClientId)}` : ''
  const res = await app.request(`/api/photos/${encodeURIComponent(lastCreatedPhotoId)}${q}`, {
    method: 'DELETE',
    headers,
  })
  lastStatus = res.status
})

Then('the photo API response status should be {int}', function (expected: number) {
  if (!r2Configured()) {
    return 'skipped'
  }
  expect(lastStatus).toBe(expected)
})

Then('the second photo API response status should be {int}', function (expected: number) {
  if (!r2Configured()) {
    return 'skipped'
  }
  expect(lastStatus).toBe(expected)
})

Then('the created photo should belong to the test inspection', async function () {
  if (!r2Configured() || !lastCreatedPhotoId) {
    return 'skipped'
  }
  const row = await prisma.photo.findUniqueOrThrow({
    where: { id: lastCreatedPhotoId },
  })
  expect(row.inspectionId).toBe(inspectionId)
})

Then('there should be one photo row for that clientId', async function () {
  if (!r2Configured() || !lastClientId) {
    return 'skipped'
  }
  const rows = await prisma.photo.findMany({ where: { clientId: lastClientId } })
  expect(rows).toHaveLength(1)
})
