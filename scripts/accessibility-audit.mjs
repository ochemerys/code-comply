#!/usr/bin/env node
/**
 * Verifies M11-S18 accessibility audit coverage (config, probes, E2E, checklist).
 * Run after: TEST_TAGS='@M11-S18' pnpm test:e2e:quick
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const REQUIRED_PATHS = [
  'apps/inspector/src/lib/accessibility/accessibility-audit-config.ts',
  'apps/inspector/src/lib/accessibility/accessibility-audit-config.spec.ts',
  'apps/inspector/src/lib/accessibility/accessibility-probes.ts',
  'apps/inspector/src/lib/accessibility/accessibility-probes.spec.ts',
  'apps/inspector/__tests__/integration/accessibility-audit-scenarios.integration.spec.ts',
  'packages/e2e-tests/features/inspector/accessibility-audit.feature',
  'packages/e2e-tests/step-definitions/inspector/accessibility-audit.steps.ts',
  '_docs/development/03-implementation/m11-s18-accessibility-audit-checklist.md',
]

const REQUIRED_CRITERIA = [
  'wcag-aa',
  'screen-reader',
  'keyboard-nav',
  'color-contrast',
  'focus-indicators',
]

const REQUIRED_PRINCIPLES = ['perceivable', 'operable', 'understandable', 'robust']

const REQUIRED_TOOLS = ['axe-core', 'lighthouse', 'voiceover']

let failed = false

console.log('M11-S18 Accessibility Audit\n')

console.log('| Artifact | Status |')
console.log('| --- | --- |')
for (const rel of REQUIRED_PATHS) {
  const ok = existsSync(join(ROOT, rel))
  if (!ok) failed = true
  console.log(`| ${rel} | ${ok ? 'PASS' : 'FAIL'} |`)
}

const configPath = join(ROOT, 'apps/inspector/src/lib/accessibility/accessibility-audit-config.ts')
const featurePath = join(
  ROOT,
  'packages/e2e-tests/features/inspector/accessibility-audit.feature',
)
const configText = existsSync(configPath) ? readFileSync(configPath, 'utf8') : ''
const featureText = existsSync(featurePath) ? readFileSync(featurePath, 'utf8') : ''

console.log('\n| Acceptance criterion | Present in config |')
console.log('| --- | --- |')
for (const criterion of REQUIRED_CRITERIA) {
  const ok = configText.includes(`'${criterion}'`)
  if (!ok) failed = true
  console.log(`| ${criterion} | ${ok ? 'PASS' : 'FAIL'} |`)
}

console.log('\n| WCAG principle | Present in config |')
console.log('| --- | --- |')
for (const principle of REQUIRED_PRINCIPLES) {
  const ok = configText.includes(`'${principle}'`)
  if (!ok) failed = true
  console.log(`| ${principle} | ${ok ? 'PASS' : 'FAIL'} |`)
}

console.log('\n| Audit tool | Present in config |')
console.log('| --- | --- |')
for (const tool of REQUIRED_TOOLS) {
  const ok = configText.includes(`'${tool}'`)
  if (!ok) failed = true
  console.log(`| ${tool} | ${ok ? 'PASS' : 'FAIL'} |`)
}

console.log('\n| E2E feature tag | Present |')
console.log('| --- | --- |')
const tagOk = featureText.includes('@M11-S18')
if (!tagOk) failed = true
console.log(`| @M11-S18 | ${tagOk ? 'PASS' : 'FAIL'} |`)

const checklistPath = join(
  ROOT,
  '_docs/development/03-implementation/m11-s18-accessibility-audit-checklist.md',
)
const checklistText = existsSync(checklistPath) ? readFileSync(checklistPath, 'utf8') : ''
const manualTools = ['axe-core', 'Lighthouse', 'VoiceOver']
console.log('\n| Manual checklist tool | Present |')
console.log('| --- | --- |')
for (const tool of manualTools) {
  const ok = checklistText.toLowerCase().includes(tool.toLowerCase())
  if (!ok) failed = true
  console.log(`| ${tool} | ${ok ? 'PASS' : 'FAIL'} |`)
}

if (failed) {
  console.error('\nAccessibility audit FAILED')
  process.exit(1)
}

console.log('\nAccessibility audit PASSED')
