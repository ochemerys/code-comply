import crypto from 'node:crypto'

/** Stable SHA-256 hex digest for audit display of a certification snapshot. */
export function hashCertificationSnapshot(snapshot: unknown): string | null {
  if (snapshot == null) return null
  try {
    const canonical = JSON.stringify(snapshot)
    return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex')
  } catch {
    return null
  }
}
