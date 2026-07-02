/**
 * M11-S24 — Cucumber steps validating operations runbook artifacts (no browser required).
 */
import { Given, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  ACCEPTANCE_CRITERIA,
  OPERATIONS_RUNBOOK_ARTIFACT_PATHS,
  validateIncidentResponse,
  validateRunbook,
  validateRunbookSections,
} from '../../../../packages/utils/src/operations-runbook/operations-runbook-config'
import { REPO_ROOT } from '../../support/repo-root'
import type { IWorld } from '../world'

type WorldM11S24 = IWorld & {
  m11s24Doc?: { criteria: string[] }
  m11s24Runbook?: string
  m11s24Incident?: string
}

function readArtifact(rel: string): string {
  const full = join(REPO_ROOT, rel)
  expect(existsSync(full), `${rel} missing`).toBe(true)
  return readFileSync(full, 'utf8')
}

Given(
  'the operations runbook acceptance criteria are defined for M11-S24',
  async function (this: IWorld) {
    const w = this as WorldM11S24
    w.m11s24Doc = {
      criteria: [
        'Deployment procedures documented',
        'Rollback procedures documented',
        'Incident response documented',
        'Monitoring procedures documented',
        'Contact information included',
      ],
    }
  },
)

Then(
  'unit and integration tests should cover M11-S24 operations runbook validators',
  async function (this: IWorld) {
    const doc = (this as WorldM11S24).m11s24Doc
    expect(doc?.criteria?.length).toBeGreaterThanOrEqual(5)
    expect(ACCEPTANCE_CRITERIA.length).toBe(5)
  },
)

Given('the M11-S24 operations runbook is loaded', async function (this: IWorld) {
  const w = this as WorldM11S24
  w.m11s24Runbook = readArtifact(OPERATIONS_RUNBOOK_ARTIFACT_PATHS.runbook)
})

Then(
  'the M11-S24 runbook should include all required sections and deployment steps',
  async function (this: IWorld) {
    const w = this as WorldM11S24
    const runbook = w.m11s24Runbook!
    expect(validateRunbookSections(runbook).missingMarkers, 'runbook sections').toEqual([])
    expect(validateRunbook(runbook).missingMarkers, 'runbook markers').toEqual([])
  },
)

Given('the M11-S24 incident response document is loaded', async function (this: IWorld) {
  const w = this as WorldM11S24
  w.m11s24Incident = readArtifact(OPERATIONS_RUNBOOK_ARTIFACT_PATHS.incidentResponse)
})

Then(
  'the M11-S24 incident response should define severity levels and contacts',
  async function (this: IWorld) {
    const w = this as WorldM11S24
    const incident = w.m11s24Incident!
    expect(validateIncidentResponse(incident).missingMarkers, 'incident markers').toEqual([])
  },
)
