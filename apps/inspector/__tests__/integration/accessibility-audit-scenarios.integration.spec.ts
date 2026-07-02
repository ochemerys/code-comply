/**
 * M11-S18 — Integration coverage linking WCAG criteria to accessibility probes.
 */
import { describe, it, expect } from 'vitest'
import {
  ACCESSIBILITY_ACCEPTANCE_CRITERIA,
  ACCESSIBILITY_AUDIT_ROUTES,
  ACCESSIBILITY_TOOLS,
  WCAG_PRINCIPLES,
  coversAllAcceptanceCriteria,
  coversAllAuditRoutes,
} from '@/lib/accessibility/accessibility-audit-config'
import {
  contrastRatio,
  meetsWcagAaContrast,
  meetsAccessibilityAcceptance,
  snapshotToAcceptanceCriteria,
} from '@/lib/accessibility/accessibility-probes'

describe('Accessibility audit scenarios integration (M11-S18)', () => {
  it('maps WCAG principles and tools from story technical_details', () => {
    expect(WCAG_PRINCIPLES).toHaveLength(4)
    expect(ACCESSIBILITY_TOOLS).toContain('axe-core')
    expect(ACCESSIBILITY_TOOLS).toContain('voiceover')
  })

  it('acceptance criteria mapping covers all five story requirements when probes pass', () => {
    const snapshot = {
      wcagAa: true,
      screenReader: true,
      keyboardNav: true,
      colorContrast: true,
      focusIndicators: true,
    }
    const mapped = snapshotToAcceptanceCriteria(snapshot)
    expect(coversAllAcceptanceCriteria(mapped)).toBe(true)
    expect(mapped).toEqual([...ACCESSIBILITY_ACCEPTANCE_CRITERIA])
    expect(meetsAccessibilityAcceptance(snapshot)).toBe(true)
  })

  it('audit routes include inspector and admin entry points', () => {
    expect(coversAllAuditRoutes([...ACCESSIBILITY_AUDIT_ROUTES])).toBe(true)
    expect(ACCESSIBILITY_AUDIT_ROUTES).toContain('inspector-user-manual')
  })

  it('login palette gray-900 on gray-50 meets WCAG AA for normal text', () => {
    const ratio = contrastRatio({ r: 17, g: 24, b: 39 }, { r: 249, g: 250, b: 251 })
    expect(meetsWcagAaContrast(ratio)).toBe(true)
  })
})
