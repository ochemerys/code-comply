#!/usr/bin/env node
/**
 * Verifies M11-S22 API documentation artifacts (OpenAPI spec, README, validators, tests).
 * Run after: pnpm --filter @codecomply/api test openapi && node scripts/export-openapi.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const REQUIRED_PATHS = [
  'apps/api/openapi.yaml',
  '_docs/api/README.md',
  'packages/utils/src/api-docs/api-docs-config.ts',
  'packages/utils/src/api-docs/api-docs-config.spec.ts',
  'packages/utils/__tests__/integration/api-docs-scenarios.integration.spec.ts',
  'apps/api/__tests__/openapi.spec.ts',
  'apps/api/__tests__/export-openapi.spec.ts',
  'scripts/export-openapi.mjs',
  'scripts/openapi-audit.mjs',
  '_docs/development/03-implementation/m11-s22-api-documentation-checklist.md',
  'packages/e2e-tests/features/ci/api-documentation.feature',
  'packages/e2e-tests/step-definitions/ci/api-documentation.steps.ts',
]

const README_MARKERS = [
  'Authentication',
  'Bearer',
  'Inspections',
  'Deficiencies',
  'Documents',
  'Reports',
  'Admin',
  'Error',
  '401',
  'openapi.yaml',
  '/swagger',
]
const YAML_MARKERS = ['openapi:', '3.0', 'paths:', 'Authentication', 'bearerAuth']
const CHECKLIST_MARKERS = ['OpenAPI', 'Swagger', 'Authentication', 'Error', 'export-openapi', 'M11-S22']

let failed = false

console.log('M11-S22 Complete API Documentation Audit\n')

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
checkMarkers('API README', '_docs/api/README.md', README_MARKERS)
checkMarkers('openapi.yaml', 'apps/api/openapi.yaml', YAML_MARKERS)
checkMarkers('Checklist', '_docs/development/03-implementation/m11-s22-api-documentation-checklist.md', CHECKLIST_MARKERS)

console.log(failed ? '\nAudit FAILED' : '\nAudit PASSED')
process.exit(failed ? 1 : 0)
