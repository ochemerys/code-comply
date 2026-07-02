/**
 * M11-S20 — Integration coverage linking monitoring acceptance criteria to on-disk artifacts.
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ACCEPTANCE_CRITERIA,
  MONITORING_ARTIFACT_PATHS,
  validateApiMonitoring,
  validateHealthForUptime,
  validateMonitoringChecklist,
} from '../../src/monitoring/monitoring-config'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..')

describe('Monitoring scenarios integration (M11-S20)', () => {
  it('maps acceptance criteria to monitoring artifacts on disk', () => {
    for (const rel of Object.values(MONITORING_ARTIFACT_PATHS)) {
      expect(existsSync(join(ROOT, rel)), rel).toBe(true)
    }
    expect(ACCEPTANCE_CRITERIA).toContain('error-tracking-sentry')
    expect(ACCEPTANCE_CRITERIA).toContain('alerts-configured')
  })

  it('validates Sentry and performance monitoring in the API layer', () => {
    const sentry = readFileSync(join(ROOT, MONITORING_ARTIFACT_PATHS.apiSentry), 'utf8')
    const timing = readFileSync(join(ROOT, MONITORING_ARTIFACT_PATHS.apiRequestTiming), 'utf8')
    expect(validateApiMonitoring(sentry, timing).ok).toBe(true)
  })

  it('validates health endpoint and ops checklist for uptime and alerts', () => {
    const health = readFileSync(join(ROOT, MONITORING_ARTIFACT_PATHS.healthRoute), 'utf8')
    const checklist = readFileSync(join(ROOT, MONITORING_ARTIFACT_PATHS.checklist), 'utf8')
    expect(validateHealthForUptime(health).ok).toBe(true)
    expect(validateMonitoringChecklist(checklist).ok).toBe(true)
  })
})
