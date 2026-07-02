#!/usr/bin/env node
/**
 * Verifies M11-S24 operations runbook artifacts (runbook, incident response, validators, tests).
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const REQUIRED_PATHS = [
  '_docs/operations/runbook.md',
  '_docs/operations/incident-response.md',
  'packages/utils/src/operations-runbook/operations-runbook-config.ts',
  'packages/utils/src/operations-runbook/operations-runbook-config.spec.ts',
  'packages/utils/__tests__/integration/operations-runbook-scenarios.integration.spec.ts',
  'scripts/operations-runbook-audit.mjs',
  '_docs/development/03-implementation/m11-s24-operations-runbook-checklist.md',
  'packages/e2e-tests/features/ci/operations-runbook.feature',
  'packages/e2e-tests/step-definitions/ci/operations-runbook.steps.ts',
]

const RUNBOOK_MARKERS = [
  'Deployment',
  'Rollback',
  'Database Operations',
  'Incident Response',
  'Monitoring',
  'Contacts',
  'Manual Production Deploy',
  '/health',
  'oncall@example.com',
  'M11-S24',
]
const INCIDENT_MARKERS = [
  'SEV-1',
  'SEV-2',
  'Incident Commander',
  'Post-incident review',
  'oncall@example.com',
  'M11-S24',
]
const CHECKLIST_MARKERS = [
  'Deployment',
  'Rollback',
  'Incident Response',
  'Monitoring',
  'Contacts',
  'operations-runbook-audit',
  'M11-S24',
]

let failed = false

console.log('M11-S24 Create Operations Runbook Audit\n')

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
checkMarkers('Runbook', '_docs/operations/runbook.md', RUNBOOK_MARKERS)
checkMarkers('Incident response', '_docs/operations/incident-response.md', INCIDENT_MARKERS)
checkMarkers(
  'Checklist',
  '_docs/development/03-implementation/m11-s24-operations-runbook-checklist.md',
  CHECKLIST_MARKERS,
)

console.log(failed ? '\nAudit FAILED' : '\nAudit PASSED')
process.exit(failed ? 1 : 0)
