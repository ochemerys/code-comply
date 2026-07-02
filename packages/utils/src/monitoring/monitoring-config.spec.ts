import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ACCEPTANCE_CRITERIA,
  ALERT_THRESHOLDS,
  MONITORING_ARTIFACT_PATHS,
  MONITORING_STORY_ID,
  MONITORING_TOOLS,
  coversAllAcceptanceCriteria,
  coversAllAlertThresholds,
  validateApiMonitoring,
  validateHealthForUptime,
  validateMonitoringChecklist,
} from './monitoring-config'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..')

function readRepoFile(rel: string): string {
  const full = join(ROOT, rel)
  expect(existsSync(full), `${rel} should exist`).toBe(true)
  return readFileSync(full, 'utf8')
}

describe('monitoring-config (M11-S20)', () => {
  it('declares story id, tools, and alert thresholds', () => {
    expect(MONITORING_STORY_ID).toBe('M11-S20')
    expect(MONITORING_TOOLS.errorTracking).toBe('Sentry')
    expect(MONITORING_TOOLS.uptime).toBe('UptimeRobot')
    expect(ALERT_THRESHOLDS).toHaveLength(4)
  })

  it('covers acceptance criteria helpers', () => {
    expect(coversAllAcceptanceCriteria([...ACCEPTANCE_CRITERIA])).toBe(true)
    expect(coversAllAlertThresholds([...ALERT_THRESHOLDS])).toBe(true)
    expect(coversAllAcceptanceCriteria(['error-tracking-sentry'])).toBe(false)
  })

  it('validates API Sentry and request-timing modules', () => {
    const sentry = readRepoFile(MONITORING_ARTIFACT_PATHS.apiSentry)
    const timing = readRepoFile(MONITORING_ARTIFACT_PATHS.apiRequestTiming)
    const result = validateApiMonitoring(sentry, timing)
    expect(result.missingMarkers, result.missingMarkers.join(', ')).toEqual([])
  })

  it('validates health route supports uptime checks', () => {
    const health = readRepoFile(MONITORING_ARTIFACT_PATHS.healthRoute)
    const result = validateHealthForUptime(health)
    expect(result.ok).toBe(true)
  })

  it('validates monitoring checklist documents ops setup', () => {
    const checklist = readRepoFile(MONITORING_ARTIFACT_PATHS.checklist)
    const result = validateMonitoringChecklist(checklist)
    expect(result.missingMarkers, result.missingMarkers.join(', ')).toEqual([])
  })
})
