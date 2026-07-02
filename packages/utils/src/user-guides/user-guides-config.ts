/**
 * M11-S23 — Create user guides acceptance criteria and validators.
 * See scripts/user-guides-audit.mjs and _docs/development/03-implementation/m11-s23-user-guides-checklist.md.
 */

export const USER_GUIDES_STORY_ID = 'M11-S23'

export const GUIDE_SECTIONS = [
  'Getting Started',
  'Daily Workflow',
  'Offline Usage',
  'Troubleshooting',
  'FAQ',
] as const

export type GuideSection = (typeof GUIDE_SECTIONS)[number]

export const ACCEPTANCE_CRITERIA = [
  'inspector-guide-complete',
  'admin-guide-complete',
  'screenshots-included',
  'step-by-step-instructions',
  'troubleshooting-section',
] as const

export type AcceptanceCriterion = (typeof ACCEPTANCE_CRITERIA)[number]

/** Repository paths that must exist for M11-S23 */
export const USER_GUIDES_ARTIFACT_PATHS = {
  inspectorGuide: '_docs/user-guides/inspector-guide.md',
  adminGuide: '_docs/user-guides/admin-guide.md',
  userGuidesConfig: 'packages/utils/src/user-guides/user-guides-config.ts',
  userGuidesConfigSpec: 'packages/utils/src/user-guides/user-guides-config.spec.ts',
  integrationSpec: 'packages/utils/__tests__/integration/user-guides-scenarios.integration.spec.ts',
  auditScript: 'scripts/user-guides-audit.mjs',
  checklist: '_docs/development/03-implementation/m11-s23-user-guides-checklist.md',
  e2eFeature: 'packages/e2e-tests/features/ci/user-guides.feature',
  e2eSteps: 'packages/e2e-tests/step-definitions/ci/user-guides.steps.ts',
} as const

/** Screenshot paths referenced by the inspector guide */
export const INSPECTOR_SCREENSHOT_PATHS = [
  '_docs/user-guides/screenshots/inspector/01-login.png',
  '_docs/user-guides/screenshots/inspector/02-home.png',
  '_docs/user-guides/screenshots/inspector/03-permits.png',
  '_docs/user-guides/screenshots/inspector/04-checklist.png',
  '_docs/user-guides/screenshots/inspector/05-sync.png',
] as const

/** Screenshot paths referenced by the admin guide */
export const ADMIN_SCREENSHOT_PATHS = [
  '_docs/user-guides/screenshots/admin/01-login.png',
  '_docs/user-guides/screenshots/admin/02-dashboard.png',
  '_docs/user-guides/screenshots/admin/03-assignments.png',
  '_docs/user-guides/screenshots/admin/04-inspection-monitor.png',
  '_docs/user-guides/screenshots/admin/05-reports.png',
] as const

export const INSPECTOR_GUIDE_MARKERS = [
  'Getting Started',
  'Daily Workflow',
  'Offline Usage',
  'Troubleshooting',
  'FAQ',
  'Step',
  'screenshots/inspector',
  'Sign in',
  'Sync now',
] as const

export const ADMIN_GUIDE_MARKERS = [
  'Getting Started',
  'Daily Workflow',
  'Offline Usage',
  'Troubleshooting',
  'FAQ',
  'Step',
  'screenshots/admin',
  'Sign in',
  'Dashboard',
  'Assignment',
] as const

export const CHECKLIST_MARKERS = [
  'Inspector guide',
  'Admin guide',
  'Troubleshooting',
  'user-guides-audit',
  'M11-S23',
] as const

/** Minimum numbered step-by-step blocks per guide */
export const MIN_STEP_BLOCKS = 5

export interface UserGuidesValidationResult {
  ok: boolean
  missingMarkers: string[]
}

export function coversAllAcceptanceCriteria(found: readonly string[]): boolean {
  return ACCEPTANCE_CRITERIA.every((c) => found.includes(c))
}

export function validateFileMarkers(
  content: string,
  markers: readonly string[],
): UserGuidesValidationResult {
  const missingMarkers = markers.filter((m) => !content.includes(m))
  return { ok: missingMarkers.length === 0, missingMarkers }
}

export function validateInspectorGuide(content: string): UserGuidesValidationResult {
  return validateFileMarkers(content, INSPECTOR_GUIDE_MARKERS)
}

export function validateAdminGuide(content: string): UserGuidesValidationResult {
  return validateFileMarkers(content, ADMIN_GUIDE_MARKERS)
}

export function validateChecklist(content: string): UserGuidesValidationResult {
  return validateFileMarkers(content, CHECKLIST_MARKERS)
}

/** Count markdown ordered-list step lines (e.g. "1. ...") */
export function countNumberedSteps(content: string): number {
  const matches = content.match(/^\d+\.\s+/gm)
  return matches?.length ?? 0
}

export function validateStepByStepInstructions(content: string): UserGuidesValidationResult {
  const count = countNumberedSteps(content)
  const ok = count >= MIN_STEP_BLOCKS
  return {
    ok,
    missingMarkers: ok ? [] : [`need at least ${MIN_STEP_BLOCKS} numbered steps (found ${count})`],
  }
}

/** Validate that screenshot markdown references appear in guide content */
export function validateScreenshotReferences(
  content: string,
  screenshotPaths: readonly string[],
): UserGuidesValidationResult {
  const missingMarkers = screenshotPaths.filter((p) => {
    const fileName = p.split('/').pop() ?? p
    return !content.includes(fileName) && !content.includes(p)
  })
  return { ok: missingMarkers.length === 0, missingMarkers }
}
