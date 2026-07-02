import { createHash } from 'node:crypto'

/** Returns true when content looks like a PostgreSQL plain SQL dump. */
export function isPostgresPlainDump(content: string): boolean {
  const trimmed = content.trimStart()
  return (
    trimmed.includes('PostgreSQL database dump') ||
    trimmed.includes('CREATE TABLE') ||
    trimmed.includes('CREATE SCHEMA')
  )
}

/** SHA-256 hex digest for backup integrity verification. */
export function computeDumpChecksum(data: string | Buffer): string {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data
  return createHash('sha256').update(buf).digest('hex')
}

/**
 * Verifies a restored dump matches the source checksum (restore tested / data integrity).
 */
export function verifyRestoreIntegrity(sourceDump: string, restoredDump: string): boolean {
  if (!isPostgresPlainDump(sourceDump) || !isPostgresPlainDump(restoredDump)) {
    return false
  }
  return computeDumpChecksum(sourceDump) === computeDumpChecksum(restoredDump)
}

/** Counts CREATE TABLE statements as a lightweight structural integrity signal. */
export function countCreateTableStatements(dump: string): number {
  const matches = dump.match(/CREATE TABLE/gi)
  return matches?.length ?? 0
}
