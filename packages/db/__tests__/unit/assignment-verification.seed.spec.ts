import { describe, it, expect } from 'vitest'
import {
  ASSIGNMENT_INACTIVE_SCO,
  ASSIGNMENT_NEAR_MAX_PERMIT_NUMBERS,
  ASSIGNMENT_PREPARED_PERMIT,
  ASSIGNMENT_SUBDIVISION_PERMITS,
  ASSIGNMENT_VERIFICATION_SCO,
} from '../../prisma/seeds/assignment-verification.seed.js'

describe('assignment-verification seed (VC-ASSIGN)', () => {
  it('defines Pat Nguyen with Building discipline and 2027 certification expiry', () => {
    expect(ASSIGNMENT_VERIFICATION_SCO.name).toBe('Pat Nguyen')
    expect(ASSIGNMENT_VERIFICATION_SCO.disciplines).toContain('Building')
    expect(ASSIGNMENT_VERIFICATION_SCO.certificationExpiry).toContain('2027-03-31')
  })

  it('defines deactivated Jordan Blake SCO', () => {
    expect(ASSIGNMENT_INACTIVE_SCO.name).toBe('Jordan Blake')
    expect(ASSIGNMENT_INACTIVE_SCO.email).toContain('jordan.blake')
  })

  it('defines prepared permit BP-2026-004821 for grid assignment', () => {
    expect(ASSIGNMENT_PREPARED_PERMIT.permitNumber).toBe('BP-2026-004821')
  })

  it('defines three subdivision permits for bulk assignment', () => {
    const numbers = ASSIGNMENT_SUBDIVISION_PERMITS.map((p) => p.permitNumber)
    expect(numbers).toEqual(['BP-2026-005010', 'BP-2026-005011', 'BP-2026-005012'])
  })

  it('defines four near-max workload permits for Pat Nguyen', () => {
    expect(ASSIGNMENT_NEAR_MAX_PERMIT_NUMBERS).toHaveLength(4)
  })
})
