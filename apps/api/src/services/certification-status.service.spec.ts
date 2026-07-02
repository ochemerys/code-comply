import { describe, it, expect } from 'vitest'
import type { User } from '@codecomply/db'
import { CertificationStatusService } from './certification-status.service.js'

function baseUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'sco@example.com',
    name: 'SCO',
    role: 'SCO',
    passwordHash: 'hash',
    certifications: [],
    disciplines: [],
    designationId: null,
    lastLoginAt: null,
    certificationExpiry: null,
    authorities: [],
    isActive: true,
    deactivatedAt: null,
    remoteWipeRequestedAt: null,
    remoteWipeConfirmedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User
}

describe('CertificationStatusService', () => {
  const service = new CertificationStatusService()

  it('returns not revoked for active user with valid certifications', () => {
    const status = service.getStatus(
      baseUser({
        certifications: [
          {
            id: 'c1',
            discipline: 'Building',
            authority: 'AB',
            issuedDate: '2024-01-01T00:00:00.000Z',
            status: 'ACTIVE',
          },
        ],
      }),
    )
    expect(status).toEqual({ revoked: false })
  })

  it('returns revoked when user is deactivated', () => {
    const deactivatedAt = new Date('2026-05-01T12:00:00.000Z')
    const status = service.getStatus(
      baseUser({
        isActive: false,
        deactivatedAt,
      }),
    )
    expect(status).toEqual({
      revoked: true,
      revokedAt: deactivatedAt.toISOString(),
      reasonCode: 'USER_DEACTIVATED',
    })
  })

  it('returns revoked when any certification has REVOKED status', () => {
    const status = service.getStatus(
      baseUser({
        certifications: [
          {
            id: 'c1',
            discipline: 'Building',
            authority: 'AB',
            issuedDate: '2024-01-01T00:00:00.000Z',
            expiryDate: '2026-04-01T00:00:00.000Z',
            status: 'REVOKED',
          },
        ],
      }),
    )
    expect(status.revoked).toBe(true)
    expect(status.reasonCode).toBe('CERTIFICATION_REVOKED')
    expect(status.revokedAt).toBe('2026-04-01T00:00:00.000Z')
  })
})
