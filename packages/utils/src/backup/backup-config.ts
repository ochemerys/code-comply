/**
 * M11-S21 — Geo-redundant database backup acceptance criteria and validators.
 * See scripts/backup-audit.mjs and _docs/development/03-implementation/m11-s21-geo-redundant-backups-checklist.md.
 */

export const BACKUP_STORY_ID = 'M11-S21'

export const BACKUP_CONFIG = {
  frequency: 'Daily',
  retentionDays: 30,
  encryption: 'AES-256',
  storage: 'Geo-redundant object storage (secondary Cloudflare R2 bucket or cross-region copy)',
} as const

export const ACCEPTANCE_CRITERIA = [
  'daily-database-backups',
  'geo-redundant-storage',
  'retention-policy',
  'restore-documented',
  'restore-tested',
] as const

export type AcceptanceCriterion = (typeof ACCEPTANCE_CRITERIA)[number]

/** Repository paths that must exist for M11-S21 */
export const BACKUP_ARTIFACT_PATHS = {
  backupConfig: 'packages/utils/src/backup/backup-config.ts',
  backupConfigSpec: 'packages/utils/src/backup/backup-config.spec.ts',
  backupIntegrity: 'packages/utils/src/backup/backup-integrity.ts',
  backupIntegritySpec: 'packages/utils/src/backup/backup-integrity.spec.ts',
  integrationSpec: 'packages/utils/__tests__/integration/backup-scenarios.integration.spec.ts',
  backupScript: 'scripts/backup-database.mjs',
  restoreScript: 'scripts/restore-database.mjs',
  backupWorkflow: '.github/workflows/database-backup.yml',
  checklist: '_docs/development/03-implementation/m11-s21-geo-redundant-backups-checklist.md',
  e2eFeature: 'packages/e2e-tests/features/ci/backups.feature',
  e2eSteps: 'packages/e2e-tests/step-definitions/ci/backups.steps.ts',
} as const

export const BACKUP_SCRIPT_MARKERS = [
  'pg_dump',
  'BACKUP_RETENTION_DAYS',
  'R2_BACKUP_BUCKET',
  'AES256',
  'geo-redundant',
] as const

export const RESTORE_SCRIPT_MARKERS = [
  'psql',
  'restore',
  'data integrity',
  'R2_BACKUP_BUCKET',
] as const

export const BACKUP_WORKFLOW_MARKERS = [
  'schedule:',
  'cron:',
  'backup-database.mjs',
  'M11-S21',
] as const

export const CHECKLIST_MARKERS = [
  'Daily',
  '30 days',
  'AES-256',
  'geo-redundant',
  'restore',
  'Render',
  'R2',
] as const

export interface BackupValidationResult {
  ok: boolean
  missingMarkers: string[]
}

export function coversAllAcceptanceCriteria(found: readonly string[]): boolean {
  return ACCEPTANCE_CRITERIA.every((c) => found.includes(c))
}

export function validateFileMarkers(
  content: string,
  markers: readonly string[],
): BackupValidationResult {
  const missingMarkers = markers.filter((m) => !content.includes(m))
  return { ok: missingMarkers.length === 0, missingMarkers }
}

export function validateBackupScript(content: string): BackupValidationResult {
  return validateFileMarkers(content, BACKUP_SCRIPT_MARKERS)
}

export function validateRestoreScript(content: string): BackupValidationResult {
  return validateFileMarkers(content, RESTORE_SCRIPT_MARKERS)
}

export function validateBackupWorkflow(content: string): BackupValidationResult {
  return validateFileMarkers(content, BACKUP_WORKFLOW_MARKERS)
}

export function validateBackupChecklist(content: string): BackupValidationResult {
  return validateFileMarkers(content, CHECKLIST_MARKERS)
}
