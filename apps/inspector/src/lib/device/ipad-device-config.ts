/**
 * M11-S17 — Physical iPad test matrix and acceptance criteria.
 * CI validates constants and automated WebKit proxy tests; field QA uses the checklist.
 */

export type IPadDeviceId = 'ipad-pro-12-9' | 'ipad-air' | 'ipad-mini'

export interface IPadDeviceProfile {
  id: IPadDeviceId
  label: string
  portrait: { width: number; height: number }
  landscape: { width: number; height: number }
  userAgentHint: string
  priority: 'critical' | 'high'
}

/** Viewports aligned with mobile-first-design-guide.md tablet breakpoints. */
export const IPAD_DEVICE_PROFILES: readonly IPadDeviceProfile[] = [
  {
    id: 'ipad-pro-12-9',
    label: 'iPad Pro 12.9"',
    portrait: { width: 1024, height: 1366 },
    landscape: { width: 1366, height: 1024 },
    userAgentHint: 'iPad; CPU OS',
    priority: 'critical',
  },
  {
    id: 'ipad-air',
    label: 'iPad Air',
    portrait: { width: 820, height: 1180 },
    landscape: { width: 1180, height: 820 },
    userAgentHint: 'iPad; CPU OS',
    priority: 'high',
  },
  {
    id: 'ipad-mini',
    label: 'iPad mini',
    portrait: { width: 768, height: 1024 },
    landscape: { width: 1024, height: 768 },
    userAgentHint: 'iPad; CPU OS',
    priority: 'high',
  },
] as const

export const IPAD_TEST_SCENARIOS = [
  'install-pwa',
  'complete-inspection',
  'capture-photos',
  'work-offline',
  'sync-data',
] as const

export type IPadTestScenario = (typeof IPAD_TEST_SCENARIOS)[number]

export const IPAD_ACCEPTANCE_CRITERIA = [
  'pwa-install',
  'camera',
  'gps',
  'offline-mode',
  'touch-interactions',
  'performance',
] as const

export type IPadAcceptanceCriterion = (typeof IPAD_ACCEPTANCE_CRITERIA)[number]

/** Max inspector shell load time on iPad-class viewports (ms) — NFR-M-02. */
export const IPAD_PERFORMANCE_LOAD_MS = 3000

/** Minimum touch target size (px) — mobile-first-design-guide.md. */
export const IPAD_MIN_TOUCH_TARGET_PX = 44

export function getIPadProfile(id: IPadDeviceId): IPadDeviceProfile {
  const profile = IPAD_DEVICE_PROFILES.find((p) => p.id === id)
  if (!profile) {
    throw new Error(`Unknown iPad profile "${id}"`)
  }
  return profile
}

export function listIPadProfiles(): IPadDeviceProfile[] {
  return [...IPAD_DEVICE_PROFILES]
}

export function coversAllAcceptanceCriteria(covered: readonly string[]): boolean {
  return IPAD_ACCEPTANCE_CRITERIA.every((c) => covered.includes(c))
}

export function coversAllTestScenarios(covered: readonly string[]): boolean {
  return IPAD_TEST_SCENARIOS.every((s) => covered.includes(s))
}
