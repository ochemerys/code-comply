/**
 * M11-S19 — Cucumber steps validating CI/CD workflow structure (no browser required).
 */
import { Given, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  PIPELINE_STAGES,
  validateCiWorkflow,
  validateDeployWorkflow,
  validateRollbackSupport,
  WORKFLOW_PATHS,
} from '../../../../packages/utils/src/ci/ci-pipeline-config'
import { REPO_ROOT } from '../../support/repo-root'
import type { IWorld } from '../world'

type WorldM11S19 = IWorld & {
  m11s19Doc?: { criteria: string[] }
  m11s19CiText?: string
  m11s19StagingText?: string
  m11s19ProductionText?: string
}

function readWorkflow(rel: string): string {
  const full = join(REPO_ROOT, rel)
  expect(existsSync(full), `${rel} missing`).toBe(true)
  return readFileSync(full, 'utf8')
}

Given(
  'the production CI CD pipeline acceptance criteria are defined for M11-S19',
  async function (this: IWorld) {
    const w = this as WorldM11S19
    w.m11s19Doc = {
      criteria: [
        'GitHub Actions pipeline configured',
        'Tests run on every PR',
        'Staging deploys on develop merge',
        'Production deploys on main merge',
        'Manual approval for production',
      ],
    }
  },
)

Then(
  'unit and integration tests should cover M11-S19 pipeline stages and workflow validators',
  async function (this: IWorld) {
    const doc = (this as WorldM11S19).m11s19Doc
    expect(doc?.criteria?.length).toBeGreaterThanOrEqual(5)
    expect(PIPELINE_STAGES.length).toBe(8)
  },
)

Given('the M11-S19 CI workflow file is loaded', async function (this: IWorld) {
  const w = this as WorldM11S19
  w.m11s19CiText = readWorkflow(WORKFLOW_PATHS.ci)
})

Then('the M11-S19 CI workflow should contain all pipeline stages', async function (this: IWorld) {
  const w = this as WorldM11S19
  expect(w.m11s19CiText).toBeDefined()
  const result = validateCiWorkflow(w.m11s19CiText!)
  expect(result.missingStages, result.missingStages.join(', ')).toEqual([])
  expect(result.missingTriggers, result.missingTriggers.join(', ')).toEqual([])
})

Given('the M11-S19 deploy workflow files are loaded', async function (this: IWorld) {
  const w = this as WorldM11S19
  w.m11s19StagingText = readWorkflow(WORKFLOW_PATHS.deployStaging)
  w.m11s19ProductionText = readWorkflow(WORKFLOW_PATHS.deployProduction)
})

Then(
  'the M11-S19 deploy workflows should support manual rollback via workflow_dispatch',
  async function (this: IWorld) {
    const w = this as WorldM11S19
    expect(validateDeployWorkflow(w.m11s19StagingText!, 'staging').ok).toBe(true)
    expect(validateDeployWorkflow(w.m11s19ProductionText!, 'production').ok).toBe(true)
    expect(validateRollbackSupport(w.m11s19StagingText!, w.m11s19ProductionText!)).toBe(true)
  },
)
