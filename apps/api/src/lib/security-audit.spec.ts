import { describe, it, expect, afterEach } from 'vitest'
import {
  runOwaspTop10Audit,
  runSecurityAudit,
  PENETRATION_PROBE_PAYLOADS,
} from './security-audit.js'
import { DEFAULT_SECURITY_HEADERS } from '../middleware/security-headers.js'

describe('security audit (M11-S7)', () => {
  const envSnapshot = { ...process.env }

  afterEach(() => {
    process.env = { ...envSnapshot }
  })

  it('runs OWASP Top 10 checklist with all categories', () => {
    const checks = runOwaspTop10Audit()
    expect(checks).toHaveLength(10)
    const ids = checks.map((c) => c.id)
    expect(ids).toContain('A01')
    expect(ids).toContain('A10')
  })

  it('passes static OWASP controls when security stack is configured', () => {
    const checks = runOwaspTop10Audit()
    const failed = checks.filter((c) => !c.passed)
    expect(failed, failed.map((f) => `${f.id}: ${f.details}`).join('; ')).toEqual([])
  })

  it('runSecurityAudit passes with mock dependency scan', async () => {
    const { parsePnpmAuditOutput } = await import('./dependency-audit.js')
    const report = await runSecurityAudit({
      includeDependencyScan: true,
      dependencyAuditRunner: async () =>
        parsePnpmAuditOutput(
          JSON.stringify({
            metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 0 } },
            advisories: {},
          }),
        ),
    })
    expect(report.passed).toBe(true)
    expect(report.dependencyAudit?.passed).toBe(true)
    expect(report.owasp.find((c) => c.id === 'A06')?.passed).toBe(true)
  })

  it('runSecurityAudit fails when dependency scan finds critical issues', async () => {
    const { parsePnpmAuditOutput } = await import('./dependency-audit.js')
    const report = await runSecurityAudit({
      includeDependencyScan: true,
      dependencyAuditRunner: async () =>
        parsePnpmAuditOutput(
          JSON.stringify({
            metadata: { vulnerabilities: { critical: 1, high: 0, moderate: 0 } },
            advisories: { '1': { module_name: 'bad-pkg', severity: 'critical', title: 'RCE' } },
          }),
        ),
    })
    expect(report.passed).toBe(false)
    expect(report.owasp.find((c) => c.id === 'A06')?.passed).toBe(false)
  })

  it('verifies security headers from response', async () => {
    const headers = new Headers(Object.entries(DEFAULT_SECURITY_HEADERS))
    const report = await runSecurityAudit({ responseHeaders: headers })
    expect(report.securityHeaders.every((h) => h.passed)).toBe(true)
    expect(report.passed).toBe(true)
  })

  it('fails A05 when response headers are incomplete', async () => {
    const headers = new Headers({ 'X-Frame-Options': 'DENY' })
    const report = await runSecurityAudit({ responseHeaders: headers })
    expect(report.passed).toBe(false)
    expect(report.owasp.find((c) => c.id === 'A05')?.passed).toBe(false)
  })

  it('fails A08 when insecure dev overrides are enabled in production', () => {
    process.env.NODE_ENV = 'production'
    process.env.ALLOW_INSECURE_DEV = 'true'
    const checks = runOwaspTop10Audit()
    expect(checks.find((c) => c.id === 'A08')?.passed).toBe(false)
  })

  it('reports A06 failure when dependency scan errors', async () => {
    const report = await runSecurityAudit({
      includeDependencyScan: true,
      dependencyAuditRunner: async () => ({
        passed: false,
        scannedAt: new Date().toISOString(),
        criticalCount: 0,
        highCount: 0,
        moderateCount: 0,
        vulnerabilities: [],
        error: 'scan unavailable',
      }),
    })
    expect(report.owasp.find((c) => c.id === 'A06')?.passed).toBe(false)
  })

  it('exposes penetration probe payloads for integration tests', () => {
    expect(PENETRATION_PROBE_PAYLOADS.sqlInjection).toContain('DROP')
    expect(PENETRATION_PROBE_PAYLOADS.xss).toContain('<script>')
    expect(PENETRATION_PROBE_PAYLOADS.ssrfInternal).toContain('127.0.0.1')
  })
})
