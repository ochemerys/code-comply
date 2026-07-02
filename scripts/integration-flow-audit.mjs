#!/usr/bin/env node
/**
 * Verifies M11-S15 integration test coverage for required user flows.
 * Run after: pnpm test:integration && pnpm test (inspector/admin integration specs)
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** @type {Record<string, string[]>} */
const REQUIRED_FLOW_SPECS = {
  'complete-inspection': [
    'apps/api/__tests__/integration/complete-user-flows.integration.spec.ts',
    'apps/api/__tests__/integration/inspection-finalization-routes.integration.spec.ts',
    'apps/inspector/__tests__/integration/checklist-item-workflow.spec.ts',
    'apps/inspector/__tests__/integration/finalization-flow.spec.ts',
  ],
  'deficiency-management': [
    'apps/api/__tests__/integration/deficiency-routes.integration.spec.ts',
    'apps/api/__tests__/integration/complete-user-flows.integration.spec.ts',
    'apps/inspector/__tests__/integration/use-deficiency-mutation.spec.ts',
    'apps/inspector/__tests__/integration/user-flows-offline.integration.spec.ts',
  ],
  'photo-capture-sync': [
    'apps/api/__tests__/integration/photos-routes.integration.spec.ts',
    'apps/api/__tests__/integration/complete-user-flows.integration.spec.ts',
    'apps/inspector/__tests__/integration/offline-photos-storage.spec.ts',
    'apps/inspector/__tests__/integration/user-flows-offline.integration.spec.ts',
  ],
  'voc-submission-review': [
    'apps/api/__tests__/integration/voc-api.integration.spec.ts',
    'apps/api/__tests__/integration/complete-user-flows.integration.spec.ts',
    'apps/inspector/__tests__/integration/voc-submission-view.spec.ts',
    'apps/admin/__tests__/integration/voc-review-admin-navigation.spec.ts',
    'apps/admin/__tests__/integration/user-flows-admin.integration.spec.ts',
  ],
  'report-generation': [
    'apps/api/__tests__/integration/report-service.integration.spec.ts',
    'apps/api/__tests__/integration/complete-user-flows.integration.spec.ts',
    'apps/admin/__tests__/integration/report-generation-routing.spec.ts',
    'apps/admin/__tests__/integration/user-flows-admin.integration.spec.ts',
  ],
}

let failed = false

console.log('M11-S15 Integration Flow Audit\n')
console.log('| Flow | Specs present | Status |')
console.log('| --- | --- | --- |')

for (const [flow, specs] of Object.entries(REQUIRED_FLOW_SPECS)) {
  const missing = specs.filter((rel) => !existsSync(join(ROOT, rel)))
  const ok = missing.length === 0
  if (!ok) failed = true
  const status = ok ? 'PASS' : `FAIL (missing: ${missing.join(', ')})`
  console.log(`| ${flow} | ${specs.length} | ${status} |`)
}

if (failed) {
  console.error('\nIntegration flow audit FAILED')
  process.exit(1)
}

console.log('\nIntegration flow audit PASSED')
