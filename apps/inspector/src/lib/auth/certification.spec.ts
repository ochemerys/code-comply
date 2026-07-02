import { describe, it, expect } from 'vitest'
import type { UserDTO } from '@codecomply/validators'
import { hasValidCertification } from './certification'

const baseUser = (certifications: UserDTO['certifications']): UserDTO => ({
  id: 'u1',
  email: 'sco@example.com',
  name: 'SCO',
  role: 'SCO',
  disciplines: [],
  certifications,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
})

describe('hasValidCertification', () => {
  const now = new Date('2026-05-23T12:00:00.000Z').getTime()

  it('returns false when user has no certifications', () => {
    expect(hasValidCertification(baseUser([]), now)).toBe(false)
    expect(hasValidCertification(baseUser(undefined), now)).toBe(false)
  })

  it('returns false when all certifications are expired', () => {
    expect(
      hasValidCertification(
        baseUser([
          {
            id: 'c1',
            discipline: 'Building',
            authority: 'AB',
            issuedDate: '2020-01-01T00:00:00.000Z',
            expiryDate: '2025-01-01T00:00:00.000Z',
            status: 'ACTIVE',
          },
        ]),
        now,
      ),
    ).toBe(false)
  })

  it('returns true when at least one certification is still valid', () => {
    expect(
      hasValidCertification(
        baseUser([
          {
            id: 'c1',
            discipline: 'Building',
            authority: 'AB',
            issuedDate: '2024-01-01T00:00:00.000Z',
            expiryDate: '2027-01-01T00:00:00.000Z',
            status: 'ACTIVE',
          },
        ]),
        now,
      ),
    ).toBe(true)
  })
})
