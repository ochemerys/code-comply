import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { runComplianceTests } from '../test/compliance-profile'
import {
  ACCEPTANCE_CRITERIA,
  BACKUP_ARTIFACT_PATHS,
  BACKUP_CONFIG,
  BACKUP_STORY_ID,
  coversAllAcceptanceCriteria,
  validateBackupChecklist,
  validateBackupScript,
  validateBackupWorkflow,
  validateRestoreScript,
} from './backup-config'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..')

function readRepoFile(rel: string): string {
  const full = join(ROOT, rel)
  expect(existsSync(full), `${rel} should exist`).toBe(true)
  return readFileSync(full, 'utf8')
}

describe('backup-config (M11-S21)', () => {
  it('declares story id and backup policy', () => {
    expect(BACKUP_STORY_ID).toBe('M11-S21')
    expect(BACKUP_CONFIG.frequency).toBe('Daily')
    expect(BACKUP_CONFIG.retentionDays).toBe(30)
    expect(BACKUP_CONFIG.encryption).toBe('AES-256')
  })

  it('covers acceptance criteria helpers', () => {
    expect(coversAllAcceptanceCriteria([...ACCEPTANCE_CRITERIA])).toBe(true)
    expect(coversAllAcceptanceCriteria(['daily-database-backups'])).toBe(false)
    expect(ACCEPTANCE_CRITERIA).toHaveLength(5)
  })

  describe.runIf(runComplianceTests)('repository artifacts', () => {
    it('validates backup and restore scripts', () => {
      const backup = readRepoFile(BACKUP_ARTIFACT_PATHS.backupScript)
      const restore = readRepoFile(BACKUP_ARTIFACT_PATHS.restoreScript)
      expect(validateBackupScript(backup).missingMarkers).toEqual([])
      expect(validateRestoreScript(restore).missingMarkers).toEqual([])
    })

    it('validates scheduled backup workflow and ops checklist', () => {
      const workflow = readRepoFile(BACKUP_ARTIFACT_PATHS.backupWorkflow)
      const checklist = readRepoFile(BACKUP_ARTIFACT_PATHS.checklist)
      expect(validateBackupWorkflow(workflow).ok).toBe(true)
      expect(validateBackupChecklist(checklist).ok).toBe(true)
    })
  })
})
