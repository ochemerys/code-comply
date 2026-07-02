/**
 * M11-S18 — WCAG 2.1 AA accessibility audit matrix and acceptance criteria.
 * CI validates constants and automated probes; field QA uses the manual checklist.
 */

export type WcagPrinciple = 'perceivable' | 'operable' | 'understandable' | 'robust'

export type AccessibilityTool = 'axe-core' | 'lighthouse' | 'voiceover'

export type AccessibilityAcceptanceCriterion =
  | 'wcag-aa'
  | 'screen-reader'
  | 'keyboard-nav'
  | 'color-contrast'
  | 'focus-indicators'

export type AccessibilityAuditRoute = 'inspector-login' | 'inspector-user-manual' | 'admin-login'

/** WCAG 2.1 AA minimum contrast for normal text (component-design-specification-mobile-first-template.md). */
export const WCAG_AA_CONTRAST_RATIO_NORMAL = 4.5

/** WCAG 2.1 AA minimum contrast for large text (≥18pt or 14pt bold). */
export const WCAG_AA_CONTRAST_RATIO_LARGE = 3

export const WCAG_PRINCIPLES: readonly WcagPrinciple[] = [
  'perceivable',
  'operable',
  'understandable',
  'robust',
] as const

export const ACCESSIBILITY_TOOLS: readonly AccessibilityTool[] = [
  'axe-core',
  'lighthouse',
  'voiceover',
] as const

export const ACCESSIBILITY_ACCEPTANCE_CRITERIA: readonly AccessibilityAcceptanceCriterion[] = [
  'wcag-aa',
  'screen-reader',
  'keyboard-nav',
  'color-contrast',
  'focus-indicators',
] as const

/** Routes exercised by automated E2E and manual axe/Lighthouse/VoiceOver passes. */
export const ACCESSIBILITY_AUDIT_ROUTES: readonly AccessibilityAuditRoute[] = [
  'inspector-login',
  'inspector-user-manual',
  'admin-login',
] as const

/** axe-core tag set for WCAG 2.1 Level AA scans (M11-S18 technical_details). */
export const AXE_WCAG21_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const

export const ACCESSIBILITY_TESTS = [
  'run-axe-core',
  'test-screen-reader',
  'test-keyboard-navigation',
] as const

export type AccessibilityTest = (typeof ACCESSIBILITY_TESTS)[number]

export function coversAllAcceptanceCriteria(covered: readonly string[]): boolean {
  return ACCESSIBILITY_ACCEPTANCE_CRITERIA.every((c) => covered.includes(c))
}

export function coversAllWcagPrinciples(covered: readonly string[]): boolean {
  return WCAG_PRINCIPLES.every((p) => covered.includes(p))
}

export function coversAllAuditRoutes(covered: readonly string[]): boolean {
  return ACCESSIBILITY_AUDIT_ROUTES.every((r) => covered.includes(r))
}
