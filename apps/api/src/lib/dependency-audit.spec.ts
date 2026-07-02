import { describe, it, expect } from 'vitest'
import { parsePnpmAuditOutput, runDependencyAudit } from './dependency-audit.js'

describe('dependency audit (M11-S7)', () => {
  it('parses clean audit output as passed', () => {
    const stdout = JSON.stringify({
      metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 1, low: 0, info: 0 } },
      advisories: {},
    })
    const result = parsePnpmAuditOutput(stdout)
    expect(result.passed).toBe(true)
    expect(result.criticalCount).toBe(0)
    expect(result.highCount).toBe(0)
    expect(result.moderateCount).toBe(1)
  })

  it('normalizes low and unknown advisory severities', () => {
    const stdout = JSON.stringify({
      metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 1 } },
      advisories: {
        '1': { module_name: 'pkg-a', severity: 'low', title: 'Low issue' },
        '2': { severity: 'unknown', title: 'Unclassified' },
      },
    })
    const result = parsePnpmAuditOutput(stdout)
    expect(result.passed).toBe(true)
    expect(result.vulnerabilities[0]?.severity).toBe('low')
    expect(result.vulnerabilities[1]?.severity).toBe('info')
    expect(result.vulnerabilities[1]?.name).toBe('unknown')
  })

  it('fails when critical or high vulnerabilities are present', () => {
    const stdout = JSON.stringify({
      metadata: { vulnerabilities: { critical: 1, high: 2, moderate: 0 } },
      advisories: {
        '1': {
          module_name: 'vulnerable-pkg',
          severity: 'critical',
          title: 'Remote code execution',
          url: 'https://example.com/advisory/1',
        },
      },
    })
    const result = parsePnpmAuditOutput(stdout)
    expect(result.passed).toBe(false)
    expect(result.criticalCount).toBe(1)
    expect(result.highCount).toBe(2)
    expect(result.vulnerabilities[0]?.name).toBe('vulnerable-pkg')
  })

  it('handles invalid JSON gracefully', () => {
    const result = parsePnpmAuditOutput('not-json')
    expect(result.passed).toBe(false)
    expect(result.error).toContain('parse')
  })

  it('runDependencyAudit uses injectable runner', async () => {
    const result = await runDependencyAudit({
      runAudit: async () =>
        JSON.stringify({
          metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 0 } },
          advisories: {},
        }),
    })
    expect(result.passed).toBe(true)
  })

  it('runDependencyAudit returns stdout when runner throws with stdout payload', async () => {
    const result = await runDependencyAudit({
      runAudit: async () => {
        const error = new Error('audit exited non-zero') as Error & { stdout: string }
        error.stdout = JSON.stringify({
          metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 0 } },
          advisories: {},
        })
        throw error
      },
    })
    expect(result.passed).toBe(true)
  })

  it('runDependencyAudit captures runner errors', async () => {
    const result = await runDependencyAudit({
      runAudit: async () => {
        throw new Error('pnpm not available')
      },
    })
    expect(result.passed).toBe(false)
    expect(result.error).toContain('pnpm not available')
  })
})
