import { describe, it, expect } from 'vitest'
import {
  ACCESSIBILITY_ACCEPTANCE_CRITERIA,
  ACCESSIBILITY_AUDIT_ROUTES,
  ACCESSIBILITY_TESTS,
  ACCESSIBILITY_TOOLS,
  AXE_WCAG21_AA_TAGS,
  WCAG_AA_CONTRAST_RATIO_LARGE,
  WCAG_AA_CONTRAST_RATIO_NORMAL,
  WCAG_PRINCIPLES,
  coversAllAcceptanceCriteria,
  coversAllAuditRoutes,
  coversAllWcagPrinciples,
} from './accessibility-audit-config'

describe('accessibility-audit-config (M11-S18)', () => {
  it('defines WCAG 2.1 AA contrast ratios from governance guides', () => {
    expect(WCAG_AA_CONTRAST_RATIO_NORMAL).toBe(4.5)
    expect(WCAG_AA_CONTRAST_RATIO_LARGE).toBe(3)
  })

  it('lists all four WCAG principles from the story', () => {
    expect(WCAG_PRINCIPLES).toEqual(['perceivable', 'operable', 'understandable', 'robust'])
    expect(coversAllWcagPrinciples([...WCAG_PRINCIPLES])).toBe(true)
  })

  it('lists audit tools from technical_details', () => {
    expect(ACCESSIBILITY_TOOLS).toEqual(['axe-core', 'lighthouse', 'voiceover'])
  })

  it('covers all five M11-S18 acceptance criteria', () => {
    expect(ACCESSIBILITY_ACCEPTANCE_CRITERIA).toHaveLength(5)
    expect(coversAllAcceptanceCriteria([...ACCESSIBILITY_ACCEPTANCE_CRITERIA])).toBe(true)
    expect(coversAllAcceptanceCriteria(['wcag-aa'])).toBe(false)
  })

  it('defines inspector and admin audit routes', () => {
    expect(ACCESSIBILITY_AUDIT_ROUTES).toContain('inspector-login')
    expect(ACCESSIBILITY_AUDIT_ROUTES).toContain('admin-login')
    expect(coversAllAuditRoutes([...ACCESSIBILITY_AUDIT_ROUTES])).toBe(true)
  })

  it('exposes axe WCAG 2.1 AA tag set for automated scans', () => {
    expect(AXE_WCAG21_AA_TAGS).toContain('wcag21aa')
    expect(AXE_WCAG21_AA_TAGS).toHaveLength(4)
  })

  it('maps testing_requirements accessibility_tests', () => {
    expect(ACCESSIBILITY_TESTS).toEqual([
      'run-axe-core',
      'test-screen-reader',
      'test-keyboard-navigation',
    ])
  })
})
