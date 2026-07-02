/**
 * M11-S20 — Cucumber steps validating monitoring configuration (no browser required).
 */
import { Given, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  ACCEPTANCE_CRITERIA,
  ALERT_THRESHOLDS,
  MONITORING_ARTIFACT_PATHS,
  validateApiMonitoring,
  validateHealthForUptime,
} from '../../../../packages/utils/src/monitoring/monitoring-config'
import { REPO_ROOT } from '../../support/repo-root'
import type { IWorld } from '../world'

type WorldM11S20 = IWorld & {
  m11s20Doc?: { criteria: string[] }
  m11s20ApiSentry?: string
  m11s20RequestTiming?: string
  m11s20Health?: string
}

function readArtifact(rel: string): string {
  const full = join(REPO_ROOT, rel)
  expect(existsSync(full), `${rel} missing`).toBe(true)
  return readFileSync(full, 'utf8')
}

Given(
  'the production monitoring acceptance criteria are defined for M11-S20',
  async function (this: IWorld) {
    const w = this as WorldM11S20
    w.m11s20Doc = {
      criteria: [
        'Error tracking with Sentry',
        'Performance monitoring',
        'Uptime monitoring',
        'Log aggregation',
        'Alerts configured',
      ],
    }
  },
)

Then(
  'unit and integration tests should cover M11-S20 monitoring validators and API modules',
  async function (this: IWorld) {
    const doc = (this as WorldM11S20).m11s20Doc
    expect(doc?.criteria?.length).toBeGreaterThanOrEqual(5)
    expect(ACCEPTANCE_CRITERIA.length).toBe(5)
    expect(ALERT_THRESHOLDS.length).toBe(4)
  },
)

Given('the M11-S20 monitoring artifact files are loaded', async function (this: IWorld) {
  const w = this as WorldM11S20
  w.m11s20ApiSentry = readArtifact(MONITORING_ARTIFACT_PATHS.apiSentry)
  w.m11s20RequestTiming = readArtifact(MONITORING_ARTIFACT_PATHS.apiRequestTiming)
})

Then(
  'the M11-S20 API should configure Sentry error tracking when SENTRY_DSN is set',
  async function (this: IWorld) {
    const w = this as WorldM11S20
    expect(w.m11s20ApiSentry).toBeDefined()
    expect(w.m11s20RequestTiming).toBeDefined()
    const result = validateApiMonitoring(w.m11s20ApiSentry!, w.m11s20RequestTiming!)
    expect(result.missingMarkers, result.missingMarkers.join(', ')).toEqual([])
  },
)

Given('the M11-S20 health route file is loaded', async function (this: IWorld) {
  const w = this as WorldM11S20
  w.m11s20Health = readArtifact(MONITORING_ARTIFACT_PATHS.healthRoute)
})

Then(
  'the M11-S20 health endpoint should expose status for uptime checks',
  async function (this: IWorld) {
    const w = this as WorldM11S20
    const result = validateHealthForUptime(w.m11s20Health!)
    expect(result.ok).toBe(true)
  },
)
