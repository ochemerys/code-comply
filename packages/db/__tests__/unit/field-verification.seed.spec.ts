import { describe, it, expect } from 'vitest'
import {
  FIELD_ASSIGNED_PERMIT,
  FIELD_SYNC_SCO,
} from '../../prisma/seeds/field-verification.seed.js'

describe('field-verification seed (VC-FIELD)', () => {
  it('defines Pat Nguyen as the field sync SCO', () => {
    expect(FIELD_SYNC_SCO.email).toBe('pat.nguyen@example.com')
  })

  it('defines BP-2026-004821 assigned permit with Calgary coords and Foundation stage', () => {
    expect(FIELD_ASSIGNED_PERMIT.permitNumber).toBe('BP-2026-004821')
    expect(FIELD_ASSIGNED_PERMIT.address).toContain('Calgary')
    expect(FIELD_ASSIGNED_PERMIT.stage).toBe('FOUNDATION')
    expect(FIELD_ASSIGNED_PERMIT.latitude).toBeCloseTo(51.0447)
  })
})
