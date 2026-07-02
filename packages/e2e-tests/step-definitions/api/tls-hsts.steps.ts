import { Before, Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { Hono } from 'hono'
import {
  DEFAULT_HSTS_HEADER,
  MIN_TLS_VERSION,
  nodeTlsServerOptions,
  requireTls,
  securityMiddleware,
} from '../../../../apps/api/src/middleware/security.js'

let lastResponse: Response
let tlsEnforcementEnabled = false

function testApp() {
  const app = new Hono()
  app.use(
    '*',
    securityMiddleware({
      tls: {
        enableHsts: true,
        enforceTls: tlsEnforcementEnabled,
      },
    }),
  )
  app.get('/health', (c) => c.json({ status: 'ok' }))
  return app
}

Before({ tags: '@M11-S2' }, function () {
  tlsEnforcementEnabled = false
})

Given('TLS enforcement is enabled for the API', function () {
  tlsEnforcementEnabled = true
})

When('I request the API health endpoint over HTTPS', async function () {
  lastResponse = await testApp().request('/health', {
    headers: { 'X-Forwarded-Proto': 'https' },
  })
})

When('I request the API health endpoint over plain HTTP', async function () {
  lastResponse = await testApp().request('/health')
})

Then('the response should include the HSTS header', function () {
  expect(lastResponse.headers.get('Strict-Transport-Security')).toBeTruthy()
})

Then('the HSTS header should include a one-year max-age', function () {
  const hsts = lastResponse.headers.get('Strict-Transport-Security') ?? ''
  expect(hsts).toContain('max-age=31536000')
  expect(hsts).toContain('includeSubDomains')
  expect(hsts).toContain('preload')
  expect(hsts).toBe(DEFAULT_HSTS_HEADER)
})

Then('the response status should be 403', function () {
  expect(lastResponse.status).toBe(403)
})

Then('the response should indicate TLS is required', async function () {
  const body = (await lastResponse.json()) as { code: string; error: string }
  expect(body.code).toBe('TLS_REQUIRED')
  expect(body.error).toContain('HTTPS')
})

Then('the API TLS configuration should require TLS 1.2 minimum', function () {
  expect(nodeTlsServerOptions().minVersion).toBe(MIN_TLS_VERSION)
  expect(nodeTlsServerOptions().minVersion).toBe('TLSv1.2')
})
