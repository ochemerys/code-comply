#!/usr/bin/env node
/**
 * Verifies M11-S21 geo-redundant backup artifacts (scripts, workflow, checklist, validators).
 * Run after: pnpm --filter @codecomply/utils test backup
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const REQUIRED_PATHS = [
  'packages/utils/src/backup/backup-config.ts',
  'packages/utils/src/backup/backup-config.spec.ts',
  'packages/utils/src/backup/backup-integrity.ts',
  'packages/utils/src/backup/backup-integrity.spec.ts',
  'packages/utils/__tests__/integration/backup-scenarios.integration.spec.ts',
  'scripts/backup-database.mjs',
  'scripts/restore-database.mjs',
  '.github/workflows/database-backup.yml',
  '_docs/development/03-implementation/m11-s21-geo-redundant-backups-checklist.md',
  'packages/e2e-tests/features/ci/backups.feature',
  'packages/e2e-tests/step-definitions/ci/backups.steps.ts',
]

const BACKUP_SCRIPT_MARKERS = [
  'pg_dump',
  'BACKUP_RETENTION_DAYS',
  'R2_BACKUP_BUCKET',
  'AES256',
  'geo-redundant',
]
const RESTORE_SCRIPT_MARKERS = ['psql', 'restore', 'data integrity', 'R2_BACKUP_BUCKET']
const WORKFLOW_MARKERS = ['schedule:', 'cron:', 'backup-database.mjs', 'M11-S21']
const CHECKLIST_MARKERS = ['Daily', '30 days', 'AES-256', 'geo-redundant', 'restore', 'Render', 'R2']

let failed = false

console.log('M11-S21 Geo-Redundant Backups Audit\n')

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
checkMarkers('Backup script', 'scripts/backup-database.mjs', BACKUP_SCRIPT_MARKERS)
checkMarkers('Restore script', 'scripts/restore-database.mjs', RESTORE_SCRIPT_MARKERS)
checkMarkers('Daily workflow', '.github/workflows/database-backup.yml', WORKFLOW_MARKERS)
checkMarkers(
  'Ops checklist',
  '_docs/development/03-implementation/m11-s21-geo-redundant-backups-checklist.md',
  CHECKLIST_MARKERS,
)

const featurePath = join(ROOT, 'packages/e2e-tests/features/ci/backups.feature')
const featureText = existsSync(featurePath) ? readFileSync(featurePath, 'utf8') : ''
const tagOk = featureText.includes('@M11-S21')
if (!tagOk) failed = true
console.log(`| E2E @M11-S21 tag | ${tagOk ? 'PASS' : 'FAIL'} |`)

if (failed) {
  console.error('\nBackup audit FAILED')
  process.exit(1)
}

console.log('\nBackup audit PASSED')
