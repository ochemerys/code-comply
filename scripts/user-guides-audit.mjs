#!/usr/bin/env node
/**
 * Verifies M11-S23 user guide artifacts (inspector/admin guides, validators, tests).
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const REQUIRED_PATHS = [
  '_docs/user-guides/inspector-guide.md',
  '_docs/user-guides/admin-guide.md',
  'packages/utils/src/user-guides/user-guides-config.ts',
  'packages/utils/src/user-guides/user-guides-config.spec.ts',
  'packages/utils/__tests__/integration/user-guides-scenarios.integration.spec.ts',
  'scripts/user-guides-audit.mjs',
  '_docs/development/03-implementation/m11-s23-user-guides-checklist.md',
  'packages/e2e-tests/features/ci/user-guides.feature',
  'packages/e2e-tests/step-definitions/ci/user-guides.steps.ts',
  '_docs/user-guides/screenshots/inspector/01-login.png',
  '_docs/user-guides/screenshots/inspector/02-home.png',
  '_docs/user-guides/screenshots/inspector/03-permits.png',
  '_docs/user-guides/screenshots/inspector/04-checklist.png',
  '_docs/user-guides/screenshots/inspector/05-sync.png',
  '_docs/user-guides/screenshots/admin/01-login.png',
  '_docs/user-guides/screenshots/admin/02-dashboard.png',
  '_docs/user-guides/screenshots/admin/03-assignments.png',
  '_docs/user-guides/screenshots/admin/04-inspection-monitor.png',
  '_docs/user-guides/screenshots/admin/05-reports.png',
]

const INSPECTOR_MARKERS = [
  'Getting Started',
  'Daily Workflow',
  'Offline Usage',
  'Troubleshooting',
  'FAQ',
  'screenshots/inspector',
  'Sign in',
  'Sync now',
]
const ADMIN_MARKERS = [
  'Getting Started',
  'Daily Workflow',
  'Offline Usage',
  'Troubleshooting',
  'FAQ',
  'screenshots/admin',
  'Sign in',
  'Dashboard',
  'Assignment',
]
const CHECKLIST_MARKERS = [
  'Inspector guide',
  'Admin guide',
  'Troubleshooting',
  'user-guides-audit',
  'M11-S23',
]

let failed = false

console.log('M11-S23 Create User Guides Audit\n')

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
checkMarkers('Inspector guide', '_docs/user-guides/inspector-guide.md', INSPECTOR_MARKERS)
checkMarkers('Admin guide', '_docs/user-guides/admin-guide.md', ADMIN_MARKERS)
checkMarkers('Checklist', '_docs/development/03-implementation/m11-s23-user-guides-checklist.md', CHECKLIST_MARKERS)

console.log(failed ? '\nAudit FAILED' : '\nAudit PASSED')
process.exit(failed ? 1 : 0)
