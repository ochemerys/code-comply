/**
 * M11-S24 — Integration coverage linking operations runbook acceptance criteria to on-disk artifacts.
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { runComplianceTests } from '../../src/test/compliance-profile'
import {
  ACCEPTANCE_CRITERIA,
  OPERATIONS_RUNBOOK_ARTIFACT_PATHS,
  validateChecklist,
  validateIncidentResponse,
  validateRunbook,
  validateRunbookSections,
} from '../../src/operations-runbook/operations-runbook-config'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..')

describe.runIf(runComplianceTests)('Operations runbook scenarios integration (M11-S24)', () => {
  it('maps acceptance criteria to operations runbook artifacts on disk', () => {
    for (const rel of Object.values(OPERATIONS_RUNBOOK_ARTIFACT_PATHS)) {
      expect(existsSync(join(ROOT, rel)), rel).toBe(true)
    }
    expect(ACCEPTANCE_CRITERIA).toContain('deployment-procedures-documented')
    expect(ACCEPTANCE_CRITERIA).toContain('contact-information-included')
  })

  it('validates runbook, incident response, checklist, and audit script', () => {
    const runbook = readFileSync(join(ROOT, OPERATIONS_RUNBOOK_ARTIFACT_PATHS.runbook), 'utf8')
    const incident = readFileSync(
      join(ROOT, OPERATIONS_RUNBOOK_ARTIFACT_PATHS.incidentResponse),
      'utf8',
    )
    const checklist = readFileSync(join(ROOT, OPERATIONS_RUNBOOK_ARTIFACT_PATHS.checklist), 'utf8')
    const auditScript = readFileSync(
      join(ROOT, OPERATIONS_RUNBOOK_ARTIFACT_PATHS.auditScript),
      'utf8',
    )
    expect(validateRunbook(runbook).ok).toBe(true)
    expect(validateRunbookSections(runbook).ok).toBe(true)
    expect(validateIncidentResponse(incident).ok).toBe(true)
    expect(validateChecklist(checklist).ok).toBe(true)
    expect(auditScript).toContain('operations-runbook-audit')
    expect(auditScript).toContain('M11-S24')
  })
})
