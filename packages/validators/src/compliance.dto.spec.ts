import { describe, it, expect } from 'vitest'
import {
  ComplianceSearchOutcomeSchema,
  ComplianceSearchQuerySchema,
  ComplianceSearchResponseSchema,
  ComplianceSearchResultDTOSchema,
} from './compliance.dto'

describe('Compliance DTOs (M10-S16)', () => {
  describe('ComplianceSearchQuerySchema', () => {
    it('accepts empty query with defaults', () => {
      const result = ComplianceSearchQuerySchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(100)
        expect(result.data.offset).toBe(0)
      }
    })

    it('accepts FOIP search criteria', () => {
      const result = ComplianceSearchQuerySchema.safeParse({
        legalLandDescription: 'Plan 1234AB',
        dateFrom: '2024-01-01',
        dateTo: '2024-06-30',
        inspectorId: 'user-1',
        permitNumber: 'P-2025-001',
        status: 'PASSED',
        outcome: 'PASSED',
        limit: 50,
        offset: 10,
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid date format', () => {
      const result = ComplianceSearchQuerySchema.safeParse({ dateFrom: '01/01/2024' })
      expect(result.success).toBe(false)
    })
  })

  describe('ComplianceSearchOutcomeSchema', () => {
    it('accepts PASSED and FAILED', () => {
      expect(ComplianceSearchOutcomeSchema.safeParse('PASSED').success).toBe(true)
      expect(ComplianceSearchOutcomeSchema.safeParse('FAILED').success).toBe(true)
    })
  })

  describe('ComplianceSearchResultDTOSchema', () => {
    it('validates a result row', () => {
      const result = ComplianceSearchResultDTOSchema.safeParse({
        hasCertificationSnapshot: true,
        inspectionId: 'insp-1',
        permitNumber: 'BP-001',
        address: '123 Main St',
        status: 'PASSED',
        scheduledDate: '2024-01-15T10:00:00.000Z',
        deficiencyCount: 2,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('ComplianceSearchResponseSchema', () => {
    it('validates search response envelope', () => {
      const result = ComplianceSearchResponseSchema.safeParse({
        results: [],
        total: 0,
        searchAuditId: 'audit-1',
      })
      expect(result.success).toBe(true)
    })
  })
})
