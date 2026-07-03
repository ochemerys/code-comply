import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { runComplianceTests } from '../test/compliance-profile'
import {
  ACCEPTANCE_CRITERIA,
  CI_PIPELINE_STORY_ID,
  CI_TRIGGER_BRANCHES,
  PIPELINE_STAGES,
  WORKFLOW_PATHS,
  coversAllAcceptanceCriteria,
  coversAllPipelineStages,
  validateCiWorkflow,
  validateDeployWorkflow,
  validateRollbackSupport,
} from './ci-pipeline-config'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..')

function readRepoFile(rel: string): string {
  const full = join(ROOT, rel)
  expect(existsSync(full), `${rel} should exist`).toBe(true)
  return readFileSync(full, 'utf8')
}

describe('ci-pipeline-config (M11-S19)', () => {
  it('declares story id and pipeline stages', () => {
    expect(CI_PIPELINE_STORY_ID).toBe('M11-S19')
    expect(PIPELINE_STAGES).toHaveLength(8)
    expect(CI_TRIGGER_BRANCHES).toEqual(['develop', 'main'])
  })

  it('covers all acceptance criteria helpers', () => {
    expect(coversAllPipelineStages([...PIPELINE_STAGES])).toBe(true)
    expect(coversAllAcceptanceCriteria([...ACCEPTANCE_CRITERIA])).toBe(true)
    expect(coversAllPipelineStages(['lint'])).toBe(false)
  })

  describe.runIf(runComplianceTests)('repository artifacts', () => {
    it('validates ci.yml contains every pipeline stage job', () => {
      const ci = readRepoFile(WORKFLOW_PATHS.ci)
      const result = validateCiWorkflow(ci)
      expect(result.missingStages, result.missingStages.join(', ')).toEqual([])
      expect(result.missingTriggers, result.missingTriggers.join(', ')).toEqual([])
    })

    it('validates manual deploy / rollback workflows', () => {
      const staging = readRepoFile(WORKFLOW_PATHS.deployStaging)
      const production = readRepoFile(WORKFLOW_PATHS.deployProduction)
      expect(validateDeployWorkflow(staging, 'staging').ok).toBe(true)
      expect(validateDeployWorkflow(production, 'production').ok).toBe(true)
      expect(validateRollbackSupport(staging, production)).toBe(true)
    })
  })
})
