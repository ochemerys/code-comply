/**
 * LSC-A-06: Admin document email/sign API routes.
 */
import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import * as bcrypt from 'bcrypt'
import { prisma } from '@codecomply/db'
import { app } from '../../../../apps/api/src/app.js'
import { authService } from '../../../../apps/api/src/services/auth.service.js'

const testPassword = 'E2eAdminDoc#1'
let adminEmail: string
let adminToken: string
let lastStatus = 0

function r2Configured(): boolean {
  return !!(
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_ENDPOINT
  )
}

async function adminAuthHeaders(): Promise<Record<string, string>> {
  const pair = await authService.login({ email: adminEmail, password: testPassword })
  adminToken = pair.accessToken
  return { Authorization: `Bearer ${adminToken}` }
}

Given('an admin user exists for document workflow E2E', async function () {
  if (!r2Configured()) {
    return 'skipped'
  }
  adminEmail = `admin-doc-${Date.now()}@document-api-routes.e2e`
  const passwordHash = await bcrypt.hash(testPassword, 10)
  await prisma.user.create({
    data: {
      email: adminEmail,
      name: 'E2E Admin Documents',
      role: 'ADMIN',
      passwordHash,
    },
  })
})

When('I POST admin email for the last created document to {string}', async function (to: string) {
  if (!r2Configured() || !process.env.SENDGRID_API_KEY) {
    return 'skipped'
  }
  const docId = (this as { lastCreatedDocumentId?: string }).lastCreatedDocumentId
  if (!docId) throw new Error('No document created')
  const headers = await adminAuthHeaders()
  const res = await app.request(`/api/admin/documents/${docId}/email`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: [to] }),
  })
  lastStatus = res.status
  ;(this as { lastJson?: unknown }).lastJson = await res.json().catch(() => undefined)
})

When('I POST admin sign for the last created document', async function () {
  if (!r2Configured()) {
    return 'skipped'
  }
  const docId = (this as { lastCreatedDocumentId?: string }).lastCreatedDocumentId
  if (!docId) throw new Error('No document created')
  const headers = await adminAuthHeaders()
  const res = await app.request(`/api/admin/documents/${docId}/sign`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signatureDataUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      signedByName: 'E2E Admin',
    }),
  })
  lastStatus = res.status
  ;(this as { lastJson?: unknown }).lastJson = await res.json().catch(() => undefined)
})

Then('the document email result status should be sent', function () {
  if (!r2Configured() || !process.env.SENDGRID_API_KEY) {
    return 'skipped'
  }
  const json = (this as { lastJson?: { status?: string } }).lastJson
  expect(json?.status).toBe('sent')
})

Then('the signed document metadata should include signedAt', function () {
  if (!r2Configured()) {
    return 'skipped'
  }
  const json = (this as { lastJson?: { metadata?: Record<string, unknown> } }).lastJson
  expect(json?.metadata?.signedAt).toBeTruthy()
})
