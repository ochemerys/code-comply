/**
 * M11-S20 — Production monitoring, logging, and alerting acceptance criteria and validators.
 * See scripts/monitoring-audit.mjs and _docs/development/03-implementation/m11-s20-monitoring-checklist.md.
 */

export const MONITORING_STORY_ID = 'M11-S20'

export const MONITORING_TOOLS = {
  errorTracking: 'Sentry',
  uptime: 'UptimeRobot',
  logs: 'Render logs',
  metrics: 'Render metrics',
} as const

export const ALERT_THRESHOLDS = [
  'error-rate-above-1-percent',
  'response-time-above-500ms',
  'uptime-below-99-5-percent',
  'disk-usage-above-80-percent',
] as const

export type AlertThreshold = (typeof ALERT_THRESHOLDS)[number]

export const ACCEPTANCE_CRITERIA = [
  'error-tracking-sentry',
  'performance-monitoring',
  'uptime-monitoring',
  'log-aggregation',
  'alerts-configured',
] as const

export type AcceptanceCriterion = (typeof ACCEPTANCE_CRITERIA)[number]

/** Repository paths that must exist for M11-S20 */
export const MONITORING_ARTIFACT_PATHS = {
  apiSentry: 'apps/api/src/lib/sentry.ts',
  apiSentrySpec: 'apps/api/src/lib/sentry.spec.ts',
  apiRequestTiming: 'apps/api/src/middleware/request-timing.ts',
  apiRequestTimingSpec: 'apps/api/src/middleware/request-timing.spec.ts',
  inspectorSentry: 'apps/inspector/src/lib/sentry.ts',
  adminSentry: 'apps/admin/src/lib/sentry.ts',
  monitoringConfig: 'packages/utils/src/monitoring/monitoring-config.ts',
  monitoringConfigSpec: 'packages/utils/src/monitoring/monitoring-config.spec.ts',
  integrationSpec: 'packages/utils/__tests__/integration/monitoring-scenarios.integration.spec.ts',
  e2eFeature: 'packages/e2e-tests/features/ci/monitoring.feature',
  e2eSteps: 'packages/e2e-tests/step-definitions/ci/monitoring.steps.ts',
  checklist: '_docs/development/03-implementation/m11-s20-monitoring-checklist.md',
  healthRoute: 'apps/api/src/routes/health.ts',
} as const

/** Substrings required in implementation files (audit + unit validators) */
export const API_SENTRY_MARKERS = [
  '@sentry/node',
  'SENTRY_DSN',
  'tracesSampleRate',
  'captureException',
] as const

export const API_TIMING_MARKERS = [
  'REQUEST_TIMING_SLOW_MS',
  'X-Response-Time',
  'performance monitoring',
] as const

export const VUE_SENTRY_MARKERS = ['@sentry/vue', 'VITE_SENTRY_DSN', 'initSentry'] as const

export const HEALTH_UPTIME_MARKERS = ['Health check', 'status', 'database', 'connected'] as const

export const CHECKLIST_MARKERS = [
  'UptimeRobot',
  'Render',
  'Sentry',
  'error rate',
  '500ms',
  '99.5%',
] as const

export interface MonitoringValidationResult {
  ok: boolean
  missingMarkers: string[]
}

export function coversAllAcceptanceCriteria(found: readonly string[]): boolean {
  return ACCEPTANCE_CRITERIA.every((c) => found.includes(c))
}

export function coversAllAlertThresholds(found: readonly string[]): boolean {
  return ALERT_THRESHOLDS.every((t) => found.includes(t))
}

export function validateFileMarkers(
  content: string,
  markers: readonly string[],
): MonitoringValidationResult {
  const missingMarkers = markers.filter((m) => !content.includes(m))
  return { ok: missingMarkers.length === 0, missingMarkers }
}

export function validateApiMonitoring(
  apiSentry: string,
  requestTiming: string,
): MonitoringValidationResult {
  const sentry = validateFileMarkers(apiSentry, API_SENTRY_MARKERS)
  const timing = validateFileMarkers(requestTiming, API_TIMING_MARKERS)
  const missingMarkers = [...sentry.missingMarkers, ...timing.missingMarkers]
  return { ok: missingMarkers.length === 0, missingMarkers }
}

export function validateHealthForUptime(healthContent: string): MonitoringValidationResult {
  return validateFileMarkers(healthContent, HEALTH_UPTIME_MARKERS)
}

export function validateMonitoringChecklist(content: string): MonitoringValidationResult {
  return validateFileMarkers(content, CHECKLIST_MARKERS)
}
