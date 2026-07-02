#!/usr/bin/env node
/**
 * Verifies M11-S17 iPad device testing coverage (config, capabilities, E2E, checklist).
 * Run after: TEST_TAGS='@M11-S17' pnpm test:e2e:quick
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const REQUIRED_PATHS = [
  'apps/inspector/src/lib/device/ipad-device-config.ts',
  'apps/inspector/src/lib/device/ipad-device-config.spec.ts',
  'apps/inspector/src/lib/device/device-capabilities.ts',
  'apps/inspector/src/lib/device/device-capabilities.spec.ts',
  'apps/inspector/__tests__/integration/ipad-device-scenarios.integration.spec.ts',
  'packages/e2e-tests/features/inspector/ipad-device-testing.feature',
  'packages/e2e-tests/step-definitions/inspector/ipad-device-testing.steps.ts',
  '_docs/development/03-implementation/m11-s17-ipad-device-test-checklist.md',
]

const REQUIRED_DEVICES = ['ipad-pro-12-9', 'ipad-air', 'ipad-mini']
const REQUIRED_SCENARIOS = [
  'install-pwa',
  'complete-inspection',
  'capture-photos',
  'work-offline',
  'sync-data',
]
const REQUIRED_CRITERIA = [
  'pwa-install',
  'camera',
  'gps',
  'offline-mode',
  'touch-interactions',
  'performance',
]

let failed = false

console.log('M11-S17 iPad Device Audit\n')

console.log('| Artifact | Status |')
console.log('| --- | --- |')
for (const rel of REQUIRED_PATHS) {
  const ok = existsSync(join(ROOT, rel))
  if (!ok) failed = true
  console.log(`| ${rel} | ${ok ? 'PASS' : 'FAIL'} |`)
}

const configPath = join(ROOT, 'apps/inspector/src/lib/device/ipad-device-config.ts')
const featurePath = join(
  ROOT,
  'packages/e2e-tests/features/inspector/ipad-device-testing.feature',
)
const configText = existsSync(configPath) ? readFileSync(configPath, 'utf8') : ''
const featureText = existsSync(featurePath) ? readFileSync(featurePath, 'utf8') : ''

console.log('\n| iPad profile id | Present in config |')
console.log('| --- | --- |')
for (const id of REQUIRED_DEVICES) {
  const ok = configText.includes(id)
  if (!ok) failed = true
  console.log(`| ${id} | ${ok ? 'PASS' : 'FAIL'} |`)
}

console.log('\n| Test scenario | Present in config |')
console.log('| --- | --- |')
for (const scenario of REQUIRED_SCENARIOS) {
  const ok = configText.includes(`'${scenario}'`)
  if (!ok) failed = true
  console.log(`| ${scenario} | ${ok ? 'PASS' : 'FAIL'} |`)
}

console.log('\n| Acceptance criterion | Present in config |')
console.log('| --- | --- |')
for (const criterion of REQUIRED_CRITERIA) {
  const ok = configText.includes(`'${criterion}'`)
  if (!ok) failed = true
  console.log(`| ${criterion} | ${ok ? 'PASS' : 'FAIL'} |`)
}

console.log('\n| E2E feature tag | Present |')
console.log('| --- | --- |')
const tagOk = featureText.includes('@M11-S17')
if (!tagOk) failed = true
console.log(`| @M11-S17 | ${tagOk ? 'PASS' : 'FAIL'} |`)

const checklistPath = join(
  ROOT,
  '_docs/development/03-implementation/m11-s17-ipad-device-test-checklist.md',
)
const checklistText = existsSync(checklistPath) ? readFileSync(checklistPath, 'utf8') : ''
const manualDevices = ['iPad Pro 12.9"', 'iPad Air', 'iPad mini']
console.log('\n| Manual checklist device | Present |')
console.log('| --- | --- |')
for (const device of manualDevices) {
  const ok = checklistText.includes(device)
  if (!ok) failed = true
  console.log(`| ${device} | ${ok ? 'PASS' : 'FAIL'} |`)
}

if (failed) {
  console.error('\niPad device audit FAILED')
  process.exit(1)
}

console.log('\niPad device audit PASSED')
