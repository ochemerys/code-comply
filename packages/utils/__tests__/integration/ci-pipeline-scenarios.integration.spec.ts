/**
 * M11-S19 — Integration coverage linking CI/CD acceptance criteria to workflow files.
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { runComplianceTests } from '../../src/test/compliance-profile'
import {
  ACCEPTANCE_CRITERIA,
  PIPELINE_STAGES,
  WORKFLOW_PATHS,
  validateCiWorkflow,
  validateDeployWorkflow,
  validateRollbackSupport,
} from '../../src/ci/ci-pipeline-config'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..')

describe.runIf(runComplianceTests)('CI/CD pipeline scenarios integration (M11-S19)', () => {
  it('maps acceptance criteria to on-disk workflow artifacts', () => {
    for (const rel of Object.values(WORKFLOW_PATHS)) {
      expect(existsSync(join(ROOT, rel)), rel).toBe(true)
    }
    expect(ACCEPTANCE_CRITERIA).toContain('tests-on-pr')
    expect(ACCEPTANCE_CRITERIA).toContain('manual-production-approval')
  })

  it('validates production pipeline runs lint through deploy-production', () => {
    const ci = readFileSync(join(ROOT, WORKFLOW_PATHS.ci), 'utf8')
    const validation = validateCiWorkflow(ci)
    expect(validation.ok).toBe(true)
    for (const stage of PIPELINE_STAGES) {
      expect(validation.missingStages).not.toContain(stage)
    }
  })

  it('validates staging and production manual rollback workflows', () => {
    const staging = readFileSync(join(ROOT, WORKFLOW_PATHS.deployStaging), 'utf8')
    const production = readFileSync(join(ROOT, WORKFLOW_PATHS.deployProduction), 'utf8')
    expect(validateDeployWorkflow(staging, 'staging').ok).toBe(true)
    expect(validateDeployWorkflow(production, 'production').ok).toBe(true)
    expect(validateRollbackSupport(staging, production)).toBe(true)
  })
})
