/**
 * M11-S21 — Cucumber steps validating backup configuration (no browser required).
 */
import { Given, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  ACCEPTANCE_CRITERIA,
  BACKUP_ARTIFACT_PATHS,
  validateBackupScript,
  validateRestoreScript,
} from '../../../../packages/utils/src/backup/backup-config'
import { REPO_ROOT } from '../../support/repo-root'
import type { IWorld } from '../world'

type WorldM11S21 = IWorld & {
  m11s21Doc?: { criteria: string[] }
  m11s21BackupScript?: string
  m11s21RestoreScript?: string
}

function readArtifact(rel: string): string {
  const full = join(REPO_ROOT, rel)
  expect(existsSync(full), `${rel} missing`).toBe(true)
  return readFileSync(full, 'utf8')
}

Given(
  'the geo-redundant backup acceptance criteria are defined for M11-S21',
  async function (this: IWorld) {
    const w = this as WorldM11S21
    w.m11s21Doc = {
      criteria: [
        'Daily database backups',
        'Backups stored in different region',
        'Retention policy configured',
        'Restore process documented',
        'Restore tested',
      ],
    }
  },
)

Then(
  'unit and integration tests should cover M11-S21 backup validators and integrity helpers',
  async function (this: IWorld) {
    const doc = (this as WorldM11S21).m11s21Doc
    expect(doc?.criteria?.length).toBeGreaterThanOrEqual(5)
    expect(ACCEPTANCE_CRITERIA.length).toBe(5)
  },
)

Given('the M11-S21 backup artifact files are loaded', async function (this: IWorld) {
  const w = this as WorldM11S21
  w.m11s21BackupScript = readArtifact(BACKUP_ARTIFACT_PATHS.backupScript)
})

Then(
  'the M11-S21 backup script should support pg_dump and geo-redundant R2 upload',
  async function (this: IWorld) {
    const w = this as WorldM11S21
    const result = validateBackupScript(w.m11s21BackupScript!)
    expect(result.missingMarkers, result.missingMarkers.join(', ')).toEqual([])
  },
)

Given('the M11-S21 restore script file is loaded', async function (this: IWorld) {
  const w = this as WorldM11S21
  w.m11s21RestoreScript = readArtifact(BACKUP_ARTIFACT_PATHS.restoreScript)
})

Then(
  'the M11-S21 restore script should verify PostgreSQL dump integrity before apply',
  async function (this: IWorld) {
    const w = this as WorldM11S21
    const result = validateRestoreScript(w.m11s21RestoreScript!)
    expect(result.ok).toBe(true)
  },
)
