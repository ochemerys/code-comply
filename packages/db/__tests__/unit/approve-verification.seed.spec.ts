import { describe, it, expect } from 'vitest'
import {
  APPROVE_GARAGE_DEFICIENCY,
  APPROVE_VERIFICATION_PERMIT,
} from '../../prisma/seeds/approve-verification.seed.js'

describe('approve-verification seed (VC-APPROVE)', () => {
  it('defines finalized BP-2026-004821 with FOIP LLD from VC-APPROVE-05', () => {
    expect(APPROVE_VERIFICATION_PERMIT.permitNumber).toBe('BP-2026-004821')
    expect(APPROVE_VERIFICATION_PERMIT.legalLandDesc).toContain('Plan 1620P')
  })

  it('defines garage fire separation deficiency for VoC workflow', () => {
    expect(APPROVE_GARAGE_DEFICIENCY.description).toMatch(/garage fire separation/i)
    expect(APPROVE_GARAGE_DEFICIENCY.relatedOrderNumber).toBe('ORD-2026-000337')
  })
})
