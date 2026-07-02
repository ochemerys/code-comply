/**
 * M7-S9: Document HTTP routes — Hono app.request + real JWT auth (skipped without R2 env).
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

const testPassword = 'E2eDocumentApi#1'
let testEmail: string
let inspectionId: string
let lastStatus: number
let lastCreatedDocumentId: string | undefined

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

Before({ tags: '@document-api' }, function () {
  lastStatus = 0
  lastCreatedDocumentId = undefined
})

Given('document API route E2E data is prepared', async function () {
  if (!r2Configured()) {
    return 'skipped'
  }

  await prisma.inspectionDocument.deleteMany({
    where: { inspection: { notes: 'M7-E2E document API routes' } },
  })
  await prisma.inspectionSchedule.deleteMany({
    where: { inspection: { notes: 'M7-E2E document API routes' } },
  })
  await prisma.permitInspection.deleteMany({
    where: { notes: 'M7-E2E document API routes' },
  })
  await prisma.user.deleteMany({
    where: { email: { endsWith: '@document-api-routes.e2e' } },
  })

  testEmail = `inspector-${Date.now()}@document-api-routes.e2e`
  const passwordHash = await bcrypt.hash(testPassword, 10)

  await prisma.user.create({
    data: {
      email: testEmail,
      name: 'E2E Document API',
      role: 'SCO',
      passwordHash,
    },
  })

  const inspection = await prisma.permitInspection.create({
    data: {
      scheduledDate: new Date('2026-11-01'),
      status: 'IN_PROGRESS',
      notes: 'M7-E2E document API routes',
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

When('I POST multipart document upload for the test inspection', async function () {
  if (!r2Configured()) {
    return 'skipped'
  }
  const headers = await authHeaders()
  const form = new FormData()
  form.append('inspectionId', inspectionId)
  form.append('title', 'E2E upload')
  form.append(
    'file',
    new File([new TextEncoder().encode('e2e-document-body')], 'notice.pdf', {
      type: 'application/pdf',
    }),
  )

  const res = await app.request('/api/documents', {
    method: 'POST',
    headers,
    body: form,
  })
  lastStatus = res.status
  if (res.status === 201) {
    const json = (await res.json()) as { id: string }
    lastCreatedDocumentId = json.id
  }
})

When('I GET signed URL for the last created document', async function () {
  if (!r2Configured() || !lastCreatedDocumentId) {
    return 'skipped'
  }
  const headers = await authHeaders()
  const res = await app.request(`/api/documents/${lastCreatedDocumentId}/url`, { headers })
  lastStatus = res.status
  ;(this as { lastJson?: unknown }).lastJson = await res.json().catch(() => undefined)
})

When('I GET documents list for the test inspection', async function () {
  if (!r2Configured()) {
    return 'skipped'
  }
  const headers = await authHeaders()
  const res = await app.request(`/api/inspections/${inspectionId}/documents`, { headers })
  lastStatus = res.status
  ;(this as { lastJson?: unknown }).lastJson = await res.json().catch(() => undefined)
})

When('I DELETE the last created document', async function () {
  if (!r2Configured() || !lastCreatedDocumentId) {
    return 'skipped'
  }
  const headers = await authHeaders()
  const res = await app.request(`/api/documents/${lastCreatedDocumentId}`, {
    method: 'DELETE',
    headers,
  })
  lastStatus = res.status
})

Then('the document API response status should be {int}', function (expected: number) {
  if (!r2Configured()) {
    return 'skipped'
  }
  expect(lastStatus).toBe(expected)
})

Then('the created document should belong to the test inspection', async function () {
  if (!r2Configured() || !lastCreatedDocumentId) {
    return 'skipped'
  }
  const row = await prisma.inspectionDocument.findUniqueOrThrow({
    where: { id: lastCreatedDocumentId },
  })
  expect(row.inspectionId).toBe(inspectionId)
})

Then('the signed URL response should include url and expiresIn', function () {
  if (!r2Configured()) {
    return 'skipped'
  }
  const json = (this as { lastJson?: { url?: string; expiresIn?: number } }).lastJson
  expect(json?.url).toBeTruthy()
  expect(typeof json?.expiresIn).toBe('number')
  expect(json!.expiresIn).toBeGreaterThan(0)
})

Then('the documents list should include the last created document', function () {
  if (!r2Configured() || !lastCreatedDocumentId) {
    return 'skipped'
  }
  const json = (this as { lastJson?: { id: string }[] }).lastJson
  expect(Array.isArray(json)).toBe(true)
  expect(json!.some((d) => d.id === lastCreatedDocumentId)).toBe(true)
})
