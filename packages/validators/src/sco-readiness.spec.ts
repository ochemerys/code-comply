import { describe, it, expect } from 'vitest'
import {
  computeCertificationEligibility,
  computeDailyAvailability,
  computeDisciplineMatch,
  inferDisciplineFromScope,
} from './sco-readiness.js'

describe('sco-readiness', () => {
  describe('inferDisciplineFromScope', () => {
    it('extracts discipline prefix from scope', () => {
      expect(inferDisciplineFromScope('Electrical - Service Upgrade')).toBe('Electrical')
      expect(inferDisciplineFromScope('Building framing inspection')).toBe('Building')
    })

    it('returns null when scope has no known discipline', () => {
      expect(inferDisciplineFromScope('New Construction - Subdivision lot 1')).toBeNull()
    })
  })

  describe('computeCertificationEligibility', () => {
    it('flags ineligible when certification expires before planned date', () => {
      const result = computeCertificationEligibility(
        {
          isActive: true,
          certificationExpiry: '2026-03-31T00:00:00.000Z',
          certifications: [],
        },
        '2026-06-10',
      )

      expect(result.eligible).toBe(false)
      expect(result.guidance.join(' ')).toMatch(/before the planned inspection/i)
    })

    it('marks eligible when certification covers planned date', () => {
      const result = computeCertificationEligibility(
        {
          isActive: true,
          certificationExpiry: '2027-03-31T00:00:00.000Z',
          certifications: [],
        },
        '2026-06-10',
      )

      expect(result.eligible).toBe(true)
      expect(result.guidance.join(' ')).toMatch(/eligible for 2026-06-10/i)
    })

    it('marks inactive users ineligible', () => {
      const result = computeCertificationEligibility(
        { isActive: false, certificationExpiry: '2027-03-31T00:00:00.000Z' },
        '2026-06-10',
      )

      expect(result.eligible).toBe(false)
      expect(result.guidance.join(' ')).toMatch(/inactive/i)
    })
  })

  describe('computeDisciplineMatch', () => {
    it('detects discipline mismatch for wrong-discipline SCO', () => {
      const result = computeDisciplineMatch(['Plumbing', 'Gas'], 'Electrical')

      expect(result.eligible).toBe(false)
      expect(result.guidance.join(' ')).toMatch(/Discipline mismatch/i)
    })

    it('accepts when SCO disciplines include permit discipline', () => {
      const result = computeDisciplineMatch(['Building', 'Electrical'], 'Building')

      expect(result.eligible).toBe(true)
      expect(result.guidance.join(' ')).toMatch(/discipline match/i)
    })
  })

  describe('computeDailyAvailability', () => {
    it('warns when at the default 5/day maximum', () => {
      const result = computeDailyAvailability(5)

      expect(result.atCapacity).toBe(true)
      expect(result.overCapacity).toBe(false)
      expect(result.guidance.join(' ')).toMatch(/at capacity/i)
    })

    it('warns when over the default maximum', () => {
      const result = computeDailyAvailability(6)

      expect(result.overCapacity).toBe(true)
      expect(result.guidance.join(' ')).toMatch(/over the default maximum/i)
    })
  })
})
