import { Before, Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { Hono } from 'hono'
import { securityMiddleware } from '../../../../apps/api/src/middleware/security.js'
import { securityHeadersMiddleware } from '../../../../apps/api/src/middleware/security-headers.js'
import { runOwaspTop10Audit } from '../../../../apps/api/src/lib/security-audit.js'
import {
  parsePnpmAuditOutput,
  runDependencyAudit,
} from '../../../../apps/api/src/lib/dependency-audit.js'

let lastResponse: Response
let owaspChecks: ReturnType<typeof runOwaspTop10Audit> = []
let dependencyPassed = false
let mockAuditJson = ''

function auditApp() {
  const app = new Hono()
  app.use('*', securityMiddleware())
  app.use('*', securityHeadersMiddleware())
  app.get('/health', (c) => c.json({ status: 'ok' }))
  return app
}

Before({ tags: '@M11-S7' }, function () {
  mockAuditJson = JSON.stringify({
    metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 0 } },
    advisories: {},
  })
  owaspChecks = []
  dependencyPassed = false
})

When('I request the API health endpoint for security audit', async function () {
  lastResponse = await auditApp().request('/health')
})

Then('the response should include X-Frame-Options DENY', function () {
  expect(lastResponse.headers.get('X-Frame-Options')).toBe('DENY')
})

Then('the response should include X-Content-Type-Options nosniff', function () {
  expect(lastResponse.headers.get('X-Content-Type-Options')).toBe('nosniff')
})

Then('the response should include Referrer-Policy no-referrer', function () {
  expect(lastResponse.headers.get('Referrer-Policy')).toBe('no-referrer')
})

When('I run the OWASP Top 10 security audit', function () {
  owaspChecks = runOwaspTop10Audit()
})

Then('all OWASP audit checks should pass', function () {
  const failed = owaspChecks.filter((c) => !c.passed)
  expect(failed, failed.map((f) => `${f.id}: ${f.details}`).join('; ')).toEqual([])
})

Given('a clean dependency audit result', function () {
  mockAuditJson = JSON.stringify({
    metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 0 } },
    advisories: {},
  })
})

When('I run the dependency vulnerability scan', async function () {
  const result = await runDependencyAudit({
    runAudit: async () => mockAuditJson,
  })
  dependencyPassed = result.passed
})

Then('the dependency audit should pass', function () {
  expect(dependencyPassed).toBe(true)
  const parsed = parsePnpmAuditOutput(mockAuditJson)
  expect(parsed.criticalCount).toBe(0)
  expect(parsed.highCount).toBe(0)
})
