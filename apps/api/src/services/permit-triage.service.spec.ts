import { describe, it, expect } from 'vitest'
import { computePermitTriage, isMissingLld } from './permit-triage.service.js'

describe('permit-triage.service', () => {
  describe('isMissingLld', () => {
    it('returns true when legal land description is null, empty, or whitespace', () => {
      expect(isMissingLld(null)).toBe(true)
      expect(isMissingLld('')).toBe(true)
      expect(isMissingLld('   ')).toBe(true)
    })

    it('returns false when legal land description is present', () => {
      expect(isMissingLld('Plan 1234AB Block 5 Lot 12')).toBe(false)
    })
  })

  describe('computePermitTriage', () => {
    it('flags expired permits as not assignment eligible', () => {
      const triage = computePermitTriage(
        { status: 'EXPIRED', legalLandDesc: 'NW-12-49-25-W4' },
        false,
      )
      expect(triage.assignmentEligible).toBe(false)
      expect(triage.blockReasons).toContain('Expired permit')
    })

    it('flags active permits with blank LLD and provides confirmation guidance', () => {
      const triage = computePermitTriage({ status: 'ACTIVE', legalLandDesc: null }, false)
      expect(triage.missingLld).toBe(true)
      expect(triage.assignmentEligible).toBe(false)
      expect(triage.blockReasons).toContain('Missing legal land description')
      expect(triage.guidance.join(' ')).toMatch(/confirm/i)
    })

    it('locks assignment when an active Stop Work order is in effect', () => {
      const triage = computePermitTriage(
        { status: 'ACTIVE', legalLandDesc: 'Plan 8821XY Block 4 Lot 9' },
        true,
      )
      expect(triage.stopWorkLockedOut).toBe(true)
      expect(triage.assignmentEligible).toBe(false)
      expect(triage.blockReasons).toContain('Active Stop Work order')
      expect(triage.guidance.join(' ')).toMatch(/Senior SCO/i)
    })

    it('marks clean active permits as assignment eligible', () => {
      const triage = computePermitTriage(
        { status: 'ACTIVE', legalLandDesc: 'Plan 1234AB Block 5 Lot 12' },
        false,
      )
      expect(triage.assignmentEligible).toBe(true)
      expect(triage.blockReasons).toHaveLength(0)
    })
  })
})
