import { describe, it, expect } from 'vitest'
import {
  PermitDTOSchema,
  PermitListDTOSchema,
  PermitSearchQuerySchema,
  PermitGPSSearchSchema,
  CreatePermitDTOSchema,
  UpdatePermitDTOSchema,
  PermitStatusSchema,
  PermitTriageSummarySchema,
} from './permit.dto'
import { GPSCoordinatesDTOSchema } from './gps.dto'

describe('Permit DTOs', () => {
  describe('PermitStatusSchema', () => {
    it('should accept valid permit statuses', () => {
      const validStatuses = ['ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED']

      validStatuses.forEach((status) => {
        const result = PermitStatusSchema.safeParse(status)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid permit statuses', () => {
      const invalidStatuses = ['PENDING', 'DRAFT', 'invalid', '']

      invalidStatuses.forEach((status) => {
        const result = PermitStatusSchema.safeParse(status)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('GPSCoordinatesDTOSchema', () => {
    it('should accept valid GPS coordinates', () => {
      const validCoords = {
        latitude: 53.5461,
        longitude: -113.4938,
        accuracy: 10.5,
      }

      const result = GPSCoordinatesDTOSchema.safeParse(validCoords)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.latitude).toBe(53.5461)
        expect(result.data.longitude).toBe(-113.4938)
        expect(result.data.accuracy).toBe(10.5)
      }
    })

    it('should accept coordinates without accuracy', () => {
      const coords = {
        latitude: 53.5461,
        longitude: -113.4938,
      }

      const result = GPSCoordinatesDTOSchema.safeParse(coords)
      expect(result.success).toBe(true)
    })

    it('should reject latitude out of range', () => {
      const invalidCoords = [
        { latitude: -91, longitude: 0 },
        { latitude: 91, longitude: 0 },
        { latitude: -100, longitude: 0 },
        { latitude: 100, longitude: 0 },
      ]

      invalidCoords.forEach((coords) => {
        const result = GPSCoordinatesDTOSchema.safeParse(coords)
        expect(result.success).toBe(false)
      })
    })

    it('should reject longitude out of range', () => {
      const invalidCoords = [
        { latitude: 0, longitude: -181 },
        { latitude: 0, longitude: 181 },
        { latitude: 0, longitude: -200 },
        { latitude: 0, longitude: 200 },
      ]

      invalidCoords.forEach((coords) => {
        const result = GPSCoordinatesDTOSchema.safeParse(coords)
        expect(result.success).toBe(false)
      })
    })

    it('should reject negative accuracy', () => {
      const coords = {
        latitude: 53.5461,
        longitude: -113.4938,
        accuracy: -10,
      }

      const result = GPSCoordinatesDTOSchema.safeParse(coords)
      expect(result.success).toBe(false)
    })
  })

  describe('PermitDTOSchema', () => {
    it('should accept valid permit data', () => {
      const validPermit = {
        id: 'permit-123',
        permitNumber: 'BP-2024-001',
        address: '10230 Jasper Avenue, Edmonton, AB',
        legalLandDesc: 'Plan 1234AB Block 5 Lot 12',
        scope: 'New Construction - Single Family Dwelling',
        status: 'ACTIVE',
        latitude: 53.5461,
        longitude: -113.4938,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T12:00:00Z',
      }

      const result = PermitDTOSchema.safeParse(validPermit)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.permitNumber).toBe('BP-2024-001')
        expect(result.data.status).toBe('ACTIVE')
      }
    })

    it('should accept permit without optional fields', () => {
      const minimalPermit = {
        id: 'permit-123',
        permitNumber: 'BP-2024-001',
        address: '10230 Jasper Avenue',
        scope: 'New Construction',
        status: 'ACTIVE',
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T12:00:00Z',
      }

      const result = PermitDTOSchema.safeParse(minimalPermit)
      expect(result.success).toBe(true)
    })

    it('should reject permit without required fields', () => {
      const invalidPermits = [
        { permitNumber: 'BP-2024-001' }, // Missing other required fields
        { id: 'permit-123', address: 'Test' }, // Missing permitNumber
        { id: 'permit-123', permitNumber: 'BP-2024-001' }, // Missing address
      ]

      invalidPermits.forEach((permit) => {
        const result = PermitDTOSchema.safeParse(permit)
        expect(result.success).toBe(false)
      })
    })

    it('should reject invalid datetime strings', () => {
      const invalidPermit = {
        id: 'permit-123',
        permitNumber: 'BP-2024-001',
        address: '10230 Jasper Avenue',
        scope: 'New Construction',
        status: 'ACTIVE',
        createdAt: 'invalid-date',
        updatedAt: '2024-01-15T12:00:00Z',
      }

      const result = PermitDTOSchema.safeParse(invalidPermit)
      expect(result.success).toBe(false)
    })

    it('should accept inspections with checklist execution refs', () => {
      const permit = {
        id: 'permit-123',
        permitNumber: 'BP-2024-001',
        address: '10230 Jasper Avenue',
        scope: 'New Construction',
        status: 'ACTIVE',
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T12:00:00Z',
        inspections: [
          {
            id: 'insp-1',
            status: 'IN_PROGRESS',
            scheduledDate: '2024-06-01T10:00:00.000Z',
            assignedInspectorName: 'Jane',
            checklistExecutions: [{ id: 'exec-1', completedAt: null }],
          },
        ],
      }

      const result = PermitDTOSchema.safeParse(permit)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.inspections?.[0].checklistExecutions?.[0].id).toBe('exec-1')
      }
    })
  })

  describe('PermitTriageSummarySchema', () => {
    it('accepts triage summary for ineligible active permit', () => {
      const result = PermitTriageSummarySchema.safeParse({
        missingLld: true,
        stopWorkLockedOut: false,
        assignmentEligible: false,
        blockReasons: ['Missing legal land description'],
        guidance: [
          'Confirm the legal land description with the municipality before assigning an inspection.',
        ],
      })
      expect(result.success).toBe(true)
    })
  })

  describe('PermitListDTOSchema', () => {
    it('should accept valid permit list data', () => {
      const validPermitList = {
        id: 'permit-123',
        permitNumber: 'BP-2024-001',
        address: '10230 Jasper Avenue',
        status: 'ACTIVE',
        nextInspectionDate: '2024-06-15T10:00:00Z',
        distance: 1500.5,
      }

      const result = PermitListDTOSchema.safeParse(validPermitList)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.distance).toBe(1500.5)
      }
    })

    it('should accept permit list without optional fields', () => {
      const minimalPermitList = {
        id: 'permit-123',
        permitNumber: 'BP-2024-001',
        address: '10230 Jasper Avenue',
        status: 'ACTIVE',
      }

      const result = PermitListDTOSchema.safeParse(minimalPermitList)
      expect(result.success).toBe(true)
    })

    it('should accept client-only isOrphan flag', () => {
      const withOrphan = {
        id: 'permit-123',
        permitNumber: 'BP-2024-001',
        address: '10230 Jasper Avenue',
        status: 'ACTIVE',
        isOrphan: true,
      }
      const result = PermitListDTOSchema.safeParse(withOrphan)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isOrphan).toBe(true)
      }
    })
  })

  describe('PermitSearchQuerySchema', () => {
    it('should accept valid search query', () => {
      const validQuery = {
        permitNumber: 'BP-2024-001',
        address: 'Jasper',
        status: 'ACTIVE',
        latitude: 53.5461,
        longitude: -113.4938,
        radius: 5000,
        limit: 20,
        offset: 0,
      }

      const result = PermitSearchQuerySchema.safeParse(validQuery)
      expect(result.success).toBe(true)
    })

    it('should accept empty search query with defaults', () => {
      const emptyQuery = {}

      const result = PermitSearchQuerySchema.safeParse(emptyQuery)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(20)
        expect(result.data.offset).toBe(0)
      }
    })

    it('should reject limit exceeding maximum', () => {
      const invalidQuery = {
        limit: 101,
      }

      const result = PermitSearchQuerySchema.safeParse(invalidQuery)
      expect(result.success).toBe(false)
    })

    it('should reject negative offset', () => {
      const invalidQuery = {
        offset: -1,
      }

      const result = PermitSearchQuerySchema.safeParse(invalidQuery)
      expect(result.success).toBe(false)
    })

    it('should reject negative radius', () => {
      const invalidQuery = {
        radius: -100,
      }

      const result = PermitSearchQuerySchema.safeParse(invalidQuery)
      expect(result.success).toBe(false)
    })
  })

  describe('PermitGPSSearchSchema', () => {
    it('should accept valid GPS search', () => {
      const validSearch = {
        latitude: 53.5461,
        longitude: -113.4938,
        radius: 5000,
        status: 'ACTIVE',
        limit: 20,
      }

      const result = PermitGPSSearchSchema.safeParse(validSearch)
      expect(result.success).toBe(true)
    })

    it('should apply default radius', () => {
      const searchWithoutRadius = {
        latitude: 53.5461,
        longitude: -113.4938,
      }

      const result = PermitGPSSearchSchema.safeParse(searchWithoutRadius)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.radius).toBe(5000)
      }
    })

    it('should apply default limit', () => {
      const searchWithoutLimit = {
        latitude: 53.5461,
        longitude: -113.4938,
      }

      const result = PermitGPSSearchSchema.safeParse(searchWithoutLimit)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(20)
      }
    })

    it('should reject missing required coordinates', () => {
      const invalidSearches = [
        { longitude: -113.4938 }, // Missing latitude
        { latitude: 53.5461 }, // Missing longitude
        {}, // Missing both
      ]

      invalidSearches.forEach((search) => {
        const result = PermitGPSSearchSchema.safeParse(search)
        expect(result.success).toBe(false)
      })
    })

    it('should reject limit exceeding maximum', () => {
      const invalidSearch = {
        latitude: 53.5461,
        longitude: -113.4938,
        limit: 51,
      }

      const result = PermitGPSSearchSchema.safeParse(invalidSearch)
      expect(result.success).toBe(false)
    })
  })

  describe('CreatePermitDTOSchema', () => {
    it('should accept valid create permit data', () => {
      const validCreate = {
        permitNumber: 'BP-2024-001',
        address: '10230 Jasper Avenue',
        legalLandDesc: 'Plan 1234AB Block 5 Lot 12',
        scope: 'New Construction',
        status: 'ACTIVE',
        latitude: 53.5461,
        longitude: -113.4938,
      }

      const result = CreatePermitDTOSchema.safeParse(validCreate)
      expect(result.success).toBe(true)
    })

    it('should apply default status', () => {
      const createWithoutStatus = {
        permitNumber: 'BP-2024-001',
        address: '10230 Jasper Avenue',
        scope: 'New Construction',
      }

      const result = CreatePermitDTOSchema.safeParse(createWithoutStatus)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('ACTIVE')
      }
    })

    it('should reject empty required fields', () => {
      const invalidCreates = [
        { permitNumber: '', address: 'Test', scope: 'Test' },
        { permitNumber: 'BP-001', address: '', scope: 'Test' },
        { permitNumber: 'BP-001', address: 'Test', scope: '' },
      ]

      invalidCreates.forEach((create) => {
        const result = CreatePermitDTOSchema.safeParse(create)
        expect(result.success).toBe(false)
      })
    })

    it('should reject missing required fields', () => {
      const invalidCreates = [
        { address: 'Test', scope: 'Test' }, // Missing permitNumber
        { permitNumber: 'BP-001', scope: 'Test' }, // Missing address
        { permitNumber: 'BP-001', address: 'Test' }, // Missing scope
      ]

      invalidCreates.forEach((create) => {
        const result = CreatePermitDTOSchema.safeParse(create)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('UpdatePermitDTOSchema', () => {
    it('should accept partial update data', () => {
      const validUpdates = [
        { permitNumber: 'BP-2024-002' },
        { address: 'New Address' },
        { status: 'COMPLETED' },
        { latitude: 53.5461, longitude: -113.4938 },
        {},
      ]

      validUpdates.forEach((update) => {
        const result = UpdatePermitDTOSchema.safeParse(update)
        expect(result.success).toBe(true)
      })
    })

    it('should accept empty update object', () => {
      const emptyUpdate = {}

      const result = UpdatePermitDTOSchema.safeParse(emptyUpdate)
      expect(result.success).toBe(true)
    })

    it('should reject invalid field values', () => {
      const invalidUpdates = [
        { permitNumber: '' }, // Empty string
        { status: 'INVALID_STATUS' }, // Invalid enum
        { latitude: 100 }, // Out of range
      ]

      invalidUpdates.forEach((update) => {
        const result = UpdatePermitDTOSchema.safeParse(update)
        expect(result.success).toBe(false)
      })
    })
  })
})
