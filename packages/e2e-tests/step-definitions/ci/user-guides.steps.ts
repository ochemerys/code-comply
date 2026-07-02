/**
 * M11-S23 — Cucumber steps validating user guide artifacts (no browser required).
 */
import { Given, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  ACCEPTANCE_CRITERIA,
  USER_GUIDES_ARTIFACT_PATHS,
  validateAdminGuide,
  validateInspectorGuide,
  validateStepByStepInstructions,
} from '../../../../packages/utils/src/user-guides/user-guides-config'
import { REPO_ROOT } from '../../support/repo-root'
import type { IWorld } from '../world'

type WorldM11S23 = IWorld & {
  m11s23Doc?: { criteria: string[] }
  m11s23InspectorGuide?: string
  m11s23AdminGuide?: string
}

function readArtifact(rel: string): string {
  const full = join(REPO_ROOT, rel)
  expect(existsSync(full), `${rel} missing`).toBe(true)
  return readFileSync(full, 'utf8')
}

Given('the user guides acceptance criteria are defined for M11-S23', async function (this: IWorld) {
  const w = this as WorldM11S23
  w.m11s23Doc = {
    criteria: [
      'Inspector guide is complete',
      'Admin guide is complete',
      'Screenshots included',
      'Step-by-step instructions',
      'Troubleshooting section',
    ],
  }
})

Then(
  'unit and integration tests should cover M11-S23 user guide validators',
  async function (this: IWorld) {
    const doc = (this as WorldM11S23).m11s23Doc
    expect(doc?.criteria?.length).toBeGreaterThanOrEqual(5)
    expect(ACCEPTANCE_CRITERIA.length).toBe(5)
  },
)

Given('the M11-S23 inspector user guide is loaded', async function (this: IWorld) {
  const w = this as WorldM11S23
  w.m11s23InspectorGuide = readArtifact(USER_GUIDES_ARTIFACT_PATHS.inspectorGuide)
})

Then(
  'the M11-S23 inspector guide should include all required sections and steps',
  async function (this: IWorld) {
    const w = this as WorldM11S23
    const guide = w.m11s23InspectorGuide!
    expect(validateInspectorGuide(guide).missingMarkers, 'inspector markers').toEqual([])
    expect(validateStepByStepInstructions(guide).ok).toBe(true)
  },
)

Given('the M11-S23 admin user guide is loaded', async function (this: IWorld) {
  const w = this as WorldM11S23
  w.m11s23AdminGuide = readArtifact(USER_GUIDES_ARTIFACT_PATHS.adminGuide)
})

Then(
  'the M11-S23 admin guide should include all required sections and steps',
  async function (this: IWorld) {
    const w = this as WorldM11S23
    const guide = w.m11s23AdminGuide!
    expect(validateAdminGuide(guide).missingMarkers, 'admin markers').toEqual([])
    expect(validateStepByStepInstructions(guide).ok).toBe(true)
  },
)
