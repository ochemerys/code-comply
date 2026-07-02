import { describe, expect, it } from 'vitest'
import {
  computeDumpChecksum,
  countCreateTableStatements,
  isPostgresPlainDump,
  verifyRestoreIntegrity,
} from './backup-integrity'

const SAMPLE_DUMP = `-- PostgreSQL database dump
CREATE TABLE "User" (id text PRIMARY KEY);
CREATE TABLE "Inspection" (id text PRIMARY KEY);
`

describe('backup-integrity (M11-S21)', () => {
  it('detects PostgreSQL plain dumps', () => {
    expect(isPostgresPlainDump(SAMPLE_DUMP)).toBe(true)
    expect(isPostgresPlainDump('not a dump')).toBe(false)
  })

  it('computes stable checksums for data integrity', () => {
    const a = computeDumpChecksum(SAMPLE_DUMP)
    const b = computeDumpChecksum(SAMPLE_DUMP)
    expect(a).toBe(b)
    expect(a).toHaveLength(64)
    expect(computeDumpChecksum('other')).not.toBe(a)
  })

  it('verifies restore integrity when dumps match', () => {
    expect(verifyRestoreIntegrity(SAMPLE_DUMP, SAMPLE_DUMP)).toBe(true)
    expect(verifyRestoreIntegrity(SAMPLE_DUMP, 'invalid')).toBe(false)
  })

  it('counts CREATE TABLE statements in a dump', () => {
    expect(countCreateTableStatements(SAMPLE_DUMP)).toBe(2)
    expect(countCreateTableStatements('')).toBe(0)
  })
})
