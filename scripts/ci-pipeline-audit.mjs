#!/usr/bin/env node
/**
 * Verifies M11-S19 production CI/CD pipeline (workflows, stages, deploy hooks, rollback).
 * Run after: pnpm --filter @codecomply/utils test ci-pipeline-config
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const REQUIRED_PATHS = [
  '.github/workflows/ci.yml',
  '.github/workflows/deploy-staging.yml',
  '.github/workflows/deploy-production.yml',
  'packages/utils/src/ci/ci-pipeline-config.ts',
  'packages/utils/src/ci/ci-pipeline-config.spec.ts',
  'packages/utils/__tests__/integration/ci-pipeline-scenarios.integration.spec.ts',
  'packages/e2e-tests/features/ci/ci-pipeline.feature',
  'packages/e2e-tests/step-definitions/ci/ci-pipeline.steps.ts',
  '_docs/development/03-implementation/m11-s19-ci-pipeline-checklist.md',
]

const PIPELINE_STAGES = [
  'lint',
  'type-check',
  'unit-tests',
  'integration-tests',
  'build',
  'e2e-tests',
  'deploy-staging',
  'deploy-production',
]

const CI_JOB_MARKERS = {
  lint: ['name: Lint', 'pnpm lint'],
  'type-check': ['name: Type Check', 'pnpm typecheck'],
  'unit-tests': ['name: Unit Tests', 'pnpm test:unit'],
  'integration-tests': ['name: Integration Tests', 'pnpm test:integration'],
  build: ['name: Build All Packages', 'pnpm build'],
  'e2e-tests': ['name: E2E Tests', 'Dockerfile.e2e'],
  'deploy-staging': ['name: Deploy to Staging', 'RENDER_API_STAGING_HOOK'],
  'deploy-production': ['name: Deploy to Production', 'environment: production'],
}

let failed = false

console.log('M11-S19 CI/CD Pipeline Audit\n')

console.log('| Artifact | Status |')
console.log('| --- | --- |')
for (const rel of REQUIRED_PATHS) {
  const ok = existsSync(join(ROOT, rel))
  if (!ok) failed = true
  console.log(`| ${rel} | ${ok ? 'PASS' : 'FAIL'} |`)
}

const ciPath = join(ROOT, '.github/workflows/ci.yml')
const ciText = existsSync(ciPath) ? readFileSync(ciPath, 'utf8') : ''

console.log('\n| Pipeline stage | Present in ci.yml |')
console.log('| --- | --- |')
for (const stage of PIPELINE_STAGES) {
  const markers = CI_JOB_MARKERS[stage] ?? []
  const ok = markers.every((m) => ciText.includes(m))
  if (!ok) failed = true
  console.log(`| ${stage} | ${ok ? 'PASS' : 'FAIL'} |`)
}

const triggerChecks = [
  ['pull_request on develop/main', ciText.includes('pull_request:') && ciText.includes('branches: [develop, main]')],
  ['staging on develop push', ciText.includes("github.ref == 'refs/heads/develop'")],
  ['production on main push', ciText.includes("github.ref == 'refs/heads/main'")],
  ['production environment gate', ciText.includes('environment: production')],
]

console.log('\n| Acceptance criterion | Status |')
console.log('| --- | --- |')
for (const [label, ok] of triggerChecks) {
  if (!ok) failed = true
  console.log(`| ${label} | ${ok ? 'PASS' : 'FAIL'} |`)
}

for (const rel of ['.github/workflows/deploy-staging.yml', '.github/workflows/deploy-production.yml']) {
  const text = existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), 'utf8') : ''
  const ok = text.includes('workflow_dispatch:')
  if (!ok) failed = true
  console.log(`| rollback workflow_dispatch (${rel}) | ${ok ? 'PASS' : 'FAIL'} |`)
}

const featurePath = join(ROOT, 'packages/e2e-tests/features/ci/ci-pipeline.feature')
const featureText = existsSync(featurePath) ? readFileSync(featurePath, 'utf8') : ''
const tagOk = featureText.includes('@M11-S19')
if (!tagOk) failed = true
console.log(`| E2E @M11-S19 tag | ${tagOk ? 'PASS' : 'FAIL'} |`)

if (failed) {
  console.error('\nCI/CD pipeline audit FAILED')
  process.exit(1)
}

console.log('\nCI/CD pipeline audit PASSED')
