import { describe, it, expect } from 'vitest'
import { hashCertificationSnapshot } from './certification-snapshot-hash'

describe('hashCertificationSnapshot', () => {
  it('returns stable SHA-256 hex for JSON snapshot', () => {
    const snapshot = { finalizedAt: '2026-01-01T00:00:00.000Z', certifications: [] }
    const a = hashCertificationSnapshot(snapshot)
    const b = hashCertificationSnapshot(snapshot)
    expect(a).toBe(b)
    expect(a).toMatch(/^[a-f0-9]{64}$/)
  })

  it('returns null for null snapshot', () => {
    expect(hashCertificationSnapshot(null)).toBeNull()
  })
})
