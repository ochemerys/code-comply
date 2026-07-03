/**
 * M11-S21 — Integration coverage linking backup acceptance criteria to on-disk artifacts.
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { runComplianceTests } from '../../src/test/compliance-profile'
import {
  ACCEPTANCE_CRITERIA,
  BACKUP_ARTIFACT_PATHS,
  validateBackupChecklist,
  validateBackupScript,
  validateBackupWorkflow,
  validateRestoreScript,
} from '../../src/backup/backup-config'
import { verifyRestoreIntegrity } from '../../src/backup/backup-integrity'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..')

const SAMPLE_DUMP = `-- PostgreSQL database dump
CREATE TABLE "Permit" (id text PRIMARY KEY);
`

describe.runIf(runComplianceTests)('Backup scenarios integration (M11-S21)', () => {
  it('maps acceptance criteria to backup artifacts on disk', () => {
    for (const rel of Object.values(BACKUP_ARTIFACT_PATHS)) {
      expect(existsSync(join(ROOT, rel)), rel).toBe(true)
    }
    expect(ACCEPTANCE_CRITERIA).toContain('geo-redundant-storage')
    expect(ACCEPTANCE_CRITERIA).toContain('restore-tested')
  })

  it('validates backup script, restore script, and daily workflow', () => {
    const backup = readFileSync(join(ROOT, BACKUP_ARTIFACT_PATHS.backupScript), 'utf8')
    const restore = readFileSync(join(ROOT, BACKUP_ARTIFACT_PATHS.restoreScript), 'utf8')
    const workflow = readFileSync(join(ROOT, BACKUP_ARTIFACT_PATHS.backupWorkflow), 'utf8')
    expect(validateBackupScript(backup).ok).toBe(true)
    expect(validateRestoreScript(restore).ok).toBe(true)
    expect(validateBackupWorkflow(workflow).ok).toBe(true)
  })

  it('validates restore process and data integrity helpers', () => {
    const checklist = readFileSync(join(ROOT, BACKUP_ARTIFACT_PATHS.checklist), 'utf8')
    expect(validateBackupChecklist(checklist).ok).toBe(true)
    expect(verifyRestoreIntegrity(SAMPLE_DUMP, SAMPLE_DUMP)).toBe(true)
  })
})
