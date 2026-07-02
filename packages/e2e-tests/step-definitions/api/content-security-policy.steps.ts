import { Before, Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { Hono } from 'hono'
import { contentSecurityPolicy } from '../../../../apps/api/src/middleware/security.js'

let lastResponse: Response
let reportOnlyEnabled = false

function testApp() {
  const app = new Hono()
  app.use('*', contentSecurityPolicy({ reportOnly: reportOnlyEnabled }))
  app.get('/health', (c) => c.json({ status: 'ok' }))
  return app
}

Before({ tags: '@M11-S1' }, function () {
  reportOnlyEnabled = false
})

Given('CSP report-only mode is enabled for the API', function () {
  reportOnlyEnabled = true
})

When('I request the API health endpoint', async function () {
  lastResponse = await testApp().request('/health')
})

Then('the response should include a Content Security Policy header', function () {
  const csp =
    lastResponse.headers.get('Content-Security-Policy') ??
    lastResponse.headers.get('Content-Security-Policy-Report-Only')
  expect(csp, 'CSP header missing').toBeTruthy()
  expect(typeof csp).toBe('string')
  expect((csp as string).length).toBeGreaterThan(0)
})

Then('the CSP should restrict script sources to self', function () {
  const csp =
    lastResponse.headers.get('Content-Security-Policy') ??
    lastResponse.headers.get('Content-Security-Policy-Report-Only') ??
    ''
  const scriptSrc = csp.match(/script-src[^;]+/)?.[0] ?? ''
  expect(scriptSrc).toContain("script-src 'self'")
  expect(scriptSrc).not.toContain('unsafe-inline')
  expect(scriptSrc).not.toContain('unsafe-eval')
})

Then('the CSP should restrict style sources', function () {
  const csp =
    lastResponse.headers.get('Content-Security-Policy') ??
    lastResponse.headers.get('Content-Security-Policy-Report-Only') ??
    ''
  expect(csp).toContain("style-src 'self'")
})

Then('the CSP should restrict image sources', function () {
  const csp =
    lastResponse.headers.get('Content-Security-Policy') ??
    lastResponse.headers.get('Content-Security-Policy-Report-Only') ??
    ''
  expect(csp).toContain("img-src 'self'")
})

Then('the CSP should deny frame embedding', function () {
  const csp =
    lastResponse.headers.get('Content-Security-Policy') ??
    lastResponse.headers.get('Content-Security-Policy-Report-Only') ??
    ''
  expect(csp).toContain("frame-ancestors 'none'")
})

Then('the response should include a Content-Security-Policy-Report-Only header', function () {
  expect(lastResponse.headers.get('Content-Security-Policy-Report-Only')).toBeTruthy()
})

Then('the response should not include an enforcing Content-Security-Policy header', function () {
  expect(lastResponse.headers.get('Content-Security-Policy')).toBeNull()
})
