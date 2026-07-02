#!/usr/bin/env node
/**
 * Verifies M11-S20 monitoring and alerting (Sentry modules, performance middleware, health, checklist).
 * Run after: pnpm --filter @codecomply/utils test monitoring-config
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const REQUIRED_PATHS = [
  'apps/api/src/lib/sentry.ts',
  'apps/api/src/lib/sentry.spec.ts',
  'apps/api/src/middleware/request-timing.ts',
  'apps/api/src/middleware/request-timing.spec.ts',
  'apps/inspector/src/lib/sentry.ts',
  'apps/admin/src/lib/sentry.ts',
  'packages/utils/src/monitoring/monitoring-config.ts',
  'packages/utils/src/monitoring/monitoring-config.spec.ts',
  'packages/utils/__tests__/integration/monitoring-scenarios.integration.spec.ts',
  'packages/e2e-tests/features/ci/monitoring.feature',
  'packages/e2e-tests/step-definitions/ci/monitoring.steps.ts',
  '_docs/development/03-implementation/m11-s20-monitoring-checklist.md',
  'apps/api/src/routes/health.ts',
]

const API_SENTRY_MARKERS = ['@sentry/node', 'SENTRY_DSN', 'tracesSampleRate', 'captureException']
const API_TIMING_MARKERS = ['REQUEST_TIMING_SLOW_MS', 'X-Response-Time', 'performance monitoring']
const VUE_SENTRY_MARKERS = ['@sentry/vue', 'VITE_SENTRY_DSN', 'initSentry']
const CHECKLIST_MARKERS = ['UptimeRobot', 'Render', 'Sentry', 'error rate', '500ms', '99.5%']

let failed = false

console.log('M11-S20 Monitoring and Alerting Audit\n')

console.log('| Artifact | Status |')
console.log('| --- | --- |')
for (const rel of REQUIRED_PATHS) {
  const ok = existsSync(join(ROOT, rel))
  if (!ok) failed = true
  console.log(`| ${rel} | ${ok ? 'PASS' : 'FAIL'} |`)
}

function checkMarkers(label, rel, markers) {
  const text = existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), 'utf8') : ''
  const missing = markers.filter((m) => !text.includes(m))
  const ok = missing.length === 0
  if (!ok) failed = true
  console.log(`| ${label} | ${ok ? 'PASS' : `FAIL (${missing.join(', ')})`} |`)
}

console.log('\n| Marker group | Status |')
console.log('| --- | --- |')
checkMarkers('API Sentry', 'apps/api/src/lib/sentry.ts', API_SENTRY_MARKERS)
checkMarkers('API request timing', 'apps/api/src/middleware/request-timing.ts', API_TIMING_MARKERS)
checkMarkers('Inspector Sentry', 'apps/inspector/src/lib/sentry.ts', VUE_SENTRY_MARKERS)
checkMarkers('Admin Sentry', 'apps/admin/src/lib/sentry.ts', VUE_SENTRY_MARKERS)
checkMarkers('Ops checklist', '_docs/development/03-implementation/m11-s20-monitoring-checklist.md', CHECKLIST_MARKERS)

const featurePath = join(ROOT, 'packages/e2e-tests/features/ci/monitoring.feature')
const featureText = existsSync(featurePath) ? readFileSync(featurePath, 'utf8') : ''
const tagOk = featureText.includes('@M11-S20')
if (!tagOk) failed = true
console.log(`| E2E @M11-S20 tag | ${tagOk ? 'PASS' : 'FAIL'} |`)

if (failed) {
  console.error('\nMonitoring audit FAILED')
  process.exit(1)
}

console.log('\nMonitoring audit PASSED')
