/**
 * M11-S23 — Integration coverage linking user guide acceptance criteria to on-disk artifacts.
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { runComplianceTests } from '../../src/test/compliance-profile'
import {
  ACCEPTANCE_CRITERIA,
  ADMIN_SCREENSHOT_PATHS,
  INSPECTOR_SCREENSHOT_PATHS,
  USER_GUIDES_ARTIFACT_PATHS,
  validateAdminGuide,
  validateChecklist,
  validateInspectorGuide,
  validateStepByStepInstructions,
} from '../../src/user-guides/user-guides-config'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..')

describe.runIf(runComplianceTests)('User guides scenarios integration (M11-S23)', () => {
  it('maps acceptance criteria to user guide artifacts on disk', () => {
    for (const rel of Object.values(USER_GUIDES_ARTIFACT_PATHS)) {
      expect(existsSync(join(ROOT, rel)), rel).toBe(true)
    }
    expect(ACCEPTANCE_CRITERIA).toContain('inspector-guide-complete')
    expect(ACCEPTANCE_CRITERIA).toContain('troubleshooting-section')
  })

  it('validates guides, checklist, and audit script', () => {
    const inspector = readFileSync(join(ROOT, USER_GUIDES_ARTIFACT_PATHS.inspectorGuide), 'utf8')
    const admin = readFileSync(join(ROOT, USER_GUIDES_ARTIFACT_PATHS.adminGuide), 'utf8')
    const checklist = readFileSync(join(ROOT, USER_GUIDES_ARTIFACT_PATHS.checklist), 'utf8')
    const auditScript = readFileSync(join(ROOT, USER_GUIDES_ARTIFACT_PATHS.auditScript), 'utf8')
    expect(validateInspectorGuide(inspector).ok).toBe(true)
    expect(validateAdminGuide(admin).ok).toBe(true)
    expect(validateChecklist(checklist).ok).toBe(true)
    expect(validateStepByStepInstructions(inspector).ok).toBe(true)
    expect(validateStepByStepInstructions(admin).ok).toBe(true)
    expect(auditScript).toContain('user-guides-audit')
    expect(auditScript).toContain('M11-S23')
  })

  it('validates screenshot assets exist on disk', () => {
    for (const rel of [...INSPECTOR_SCREENSHOT_PATHS, ...ADMIN_SCREENSHOT_PATHS]) {
      expect(existsSync(join(ROOT, rel)), rel).toBe(true)
    }
  })
})
