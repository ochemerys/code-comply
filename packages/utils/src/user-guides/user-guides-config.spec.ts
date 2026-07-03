import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { runComplianceTests } from '../test/compliance-profile'
import {
  ACCEPTANCE_CRITERIA,
  ADMIN_SCREENSHOT_PATHS,
  GUIDE_SECTIONS,
  INSPECTOR_SCREENSHOT_PATHS,
  USER_GUIDES_ARTIFACT_PATHS,
  USER_GUIDES_STORY_ID,
  coversAllAcceptanceCriteria,
  countNumberedSteps,
  validateAdminGuide,
  validateChecklist,
  validateInspectorGuide,
  validateScreenshotReferences,
  validateStepByStepInstructions,
} from './user-guides-config'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..')

function readRepoFile(rel: string): string {
  const full = join(ROOT, rel)
  expect(existsSync(full), `${rel} should exist`).toBe(true)
  return readFileSync(full, 'utf8')
}

describe('user-guides-config (M11-S23)', () => {
  it('declares story id and guide sections', () => {
    expect(USER_GUIDES_STORY_ID).toBe('M11-S23')
    expect(GUIDE_SECTIONS).toHaveLength(5)
    expect(GUIDE_SECTIONS).toContain('Getting Started')
    expect(GUIDE_SECTIONS).toContain('Troubleshooting')
  })

  it('covers acceptance criteria helpers', () => {
    expect(coversAllAcceptanceCriteria([...ACCEPTANCE_CRITERIA])).toBe(true)
    expect(coversAllAcceptanceCriteria(['inspector-guide-complete'])).toBe(false)
    expect(ACCEPTANCE_CRITERIA).toHaveLength(5)
  })

  it('validates inspector and admin guide markers', () => {
    const inspector = readRepoFile(USER_GUIDES_ARTIFACT_PATHS.inspectorGuide)
    const admin = readRepoFile(USER_GUIDES_ARTIFACT_PATHS.adminGuide)
    expect(validateInspectorGuide(inspector).missingMarkers).toEqual([])
    expect(validateAdminGuide(admin).missingMarkers).toEqual([])
  })

  describe.runIf(runComplianceTests)('internal repository artifacts', () => {
    it('validates implementation checklist markers', () => {
      const checklist = readRepoFile(USER_GUIDES_ARTIFACT_PATHS.checklist)
      expect(validateChecklist(checklist).missingMarkers).toEqual([])
    })
  })

  it('validates step-by-step instructions and screenshot references', () => {
    const inspector = readRepoFile(USER_GUIDES_ARTIFACT_PATHS.inspectorGuide)
    const admin = readRepoFile(USER_GUIDES_ARTIFACT_PATHS.adminGuide)
    expect(validateStepByStepInstructions(inspector).ok).toBe(true)
    expect(validateStepByStepInstructions(admin).ok).toBe(true)
    expect(countNumberedSteps(inspector)).toBeGreaterThanOrEqual(5)
    expect(countNumberedSteps(admin)).toBeGreaterThanOrEqual(5)
    expect(validateScreenshotReferences(inspector, INSPECTOR_SCREENSHOT_PATHS).ok).toBe(true)
    expect(validateScreenshotReferences(admin, ADMIN_SCREENSHOT_PATHS).ok).toBe(true)
    for (const rel of [...INSPECTOR_SCREENSHOT_PATHS, ...ADMIN_SCREENSHOT_PATHS]) {
      expect(existsSync(join(ROOT, rel)), rel).toBe(true)
    }
  })
})
