#!/usr/bin/env node
/**
 * Verifies M11-S16 Playwright E2E coverage for critical user journeys.
 * Run after: TEST_TAGS='@M11-S16' pnpm test:e2e:quick (or local e2e with servers)
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const REQUIRED_PATHS = [
  'packages/e2e-tests/features/workflows/critical-user-journeys.feature',
  'packages/e2e-tests/step-definitions/workflows/critical-user-journeys.steps.ts',
]

const REQUIRED_JOURNEY_TAGS = [
  '@journey-inspector',
  '@journey-admin',
  '@journey-report',
  '@journey-offline',
]

const REQUIRED_VIEWPORTS = ['desktop', 'tablet', 'mobile']
const REQUIRED_BROWSERS = ['chromium', 'webkit']

let failed = false

console.log('M11-S16 E2E Journey Audit\n')

console.log('| Artifact | Status |')
console.log('| --- | --- |')
for (const rel of REQUIRED_PATHS) {
  const ok = existsSync(join(ROOT, rel))
  if (!ok) failed = true
  console.log(`| ${rel} | ${ok ? 'PASS' : 'FAIL'} |`)
}

const featurePath = join(ROOT, 'packages/e2e-tests/features/workflows/critical-user-journeys.feature')
const worldPath = join(ROOT, 'packages/e2e-tests/step-definitions/world.ts')
const featureText = existsSync(featurePath) ? readFileSync(featurePath, 'utf8') : ''
const worldText = existsSync(worldPath) ? readFileSync(worldPath, 'utf8') : ''

console.log('\n| Journey tag | Present |')
console.log('| --- | --- |')
for (const tag of REQUIRED_JOURNEY_TAGS) {
  const ok = featureText.includes(tag)
  if (!ok) failed = true
  console.log(`| ${tag} | ${ok ? 'PASS' : 'FAIL'} |`)
}

console.log('\n| Viewport (Examples) | Present |')
console.log('| --- | --- |')
for (const vp of REQUIRED_VIEWPORTS) {
  const ok = featureText.includes(`| ${vp} `) || featureText.includes(`"${vp}"`)
  if (!ok) failed = true
  console.log(`| ${vp} | ${ok ? 'PASS' : 'FAIL'} |`)
}

console.log('\n| Browser (world.ts E2E_BROWSER) | Present |')
console.log('| --- | --- |')
for (const browser of REQUIRED_BROWSERS) {
  const ok = worldText.includes(browser)
  if (!ok) failed = true
  console.log(`| ${browser} | ${ok ? 'PASS' : 'FAIL'} |`)
}

const reportsDir = join(ROOT, 'packages/e2e-tests/reports')
const reportConfigOk =
  existsSync(join(ROOT, 'packages/e2e-tests/cucumber.cjs')) &&
  readFileSync(join(ROOT, 'packages/e2e-tests/cucumber.cjs'), 'utf8').includes('reports/cucumber-report')
if (!reportConfigOk) failed = true
console.log(`\n| Cucumber HTML/JSON reports configured | ${reportConfigOk ? 'PASS' : 'FAIL'} |`)
console.log(`| reports/ directory | ${existsSync(reportsDir) ? 'PASS' : 'FAIL'} |`)

if (failed) {
  console.error('\nE2E journey audit FAILED')
  process.exit(1)
}

console.log('\nE2E journey audit PASSED')
