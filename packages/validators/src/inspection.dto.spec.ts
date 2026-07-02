import { describe, it, expect } from 'vitest'
import {
  InspectionDTOSchema,
  InspectionListDTOSchema,
  CreateInspectionDTOSchema,
  UpdateInspectionDTOSchema,
  InspectionSearchQuerySchema,
  InspectionStatusSchema,
} from './inspection.dto'

describe('Inspection DTOs', () => {
  describe('InspectionStatusSchema', () => {
    it('should accept valid inspection statuses', () => {
      const validStatuses = ['SCHEDULED', 'IN_PROGRESS', 'PASSED', 'FAILED', 'CANCELLED']

      validStatuses.forEach((status) => {
        const result = InspectionStatusSchema.safeParse(status)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid inspection statuses', () => {
      const invalidStatuses = ['PENDING', 'COMPLETED', 'invalid', '']

      invalidStatuses.forEach((status) => {
        const result = InspectionStatusSchema.safeParse(status)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('InspectionDTOSchema', () => {
    it('should accept valid inspection data', () => {
      const validInspection = {
        id: 'insp-123',
        permitId: 'permit-456',
        status: 'SCHEDULED',
        scheduledDate: '2024-06-15T10:00:00Z',
        completedDate: '2024-06-15T14:30:00Z',
        notes: 'Initial inspection',
        assignedInspectorId: 'user-789',
        assignedInspectorName: 'Jane Smith',
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T12:00:00Z',
      }

      const result = InspectionDTOSchema.safeParse(validInspection)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe('insp-123')
        expect(result.data.status).toBe('SCHEDULED')
      }
    })

    it('should accept inspection without optional fields', () => {
      const minimalInspection = {
        id: 'insp-123',
        permitId: 'permit-456',
        status: 'SCHEDULED',
        scheduledDate: '2024-06-15T10:00:00Z',
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T12:00:00Z',
      }

      const result = InspectionDTOSchema.safeParse(minimalInspection)
      expect(result.success).toBe(true)
    })

    it('should reject inspection without required fields', () => {
      const invalidInspections = [
        { permitId: 'permit-456', status: 'SCHEDULED' }, // Missing id
        { id: 'insp-123', status: 'SCHEDULED' }, // Missing permitId
        { id: 'insp-123', permitId: 'permit-456' }, // Missing status
      ]

      invalidInspections.forEach((inspection) => {
        const result = InspectionDTOSchema.safeParse(inspection)
        expect(result.success).toBe(false)
      })
    })

    it('should reject invalid datetime strings', () => {
      const invalidInspection = {
        id: 'insp-123',
        permitId: 'permit-456',
        status: 'SCHEDULED',
        scheduledDate: 'invalid-date',
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T12:00:00Z',
      }

      const result = InspectionDTOSchema.safeParse(invalidInspection)
      expect(result.success).toBe(false)
    })
  })

  describe('InspectionListDTOSchema', () => {
    it('should accept valid inspection list data', () => {
      const validInspectionList = {
        id: 'insp-123',
        permitId: 'permit-456',
        permitNumber: 'BP-2024-001',
        address: '10230 Jasper Avenue',
        status: 'SCHEDULED',
        scheduledDate: '2024-06-15T10:00:00Z',
        assignedInspectorName: 'Jane Smith',
      }

      const result = InspectionListDTOSchema.safeParse(validInspectionList)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.permitNumber).toBe('BP-2024-001')
      }
    })

    it('should accept inspection list without optional fields', () => {
      const minimalInspectionList = {
        id: 'insp-123',
        permitId: 'permit-456',
        permitNumber: 'BP-2024-001',
        address: '10230 Jasper Avenue',
        status: 'SCHEDULED',
        scheduledDate: '2024-06-15T10:00:00Z',
      }

      const result = InspectionListDTOSchema.safeParse(minimalInspectionList)
      expect(result.success).toBe(true)
    })
  })

  describe('CreateInspectionDTOSchema', () => {
    it('should accept valid create inspection data', () => {
      const validCreate = {
        permitId: 'permit-456',
        scheduledDate: '2024-06-15T10:00:00Z',
        notes: 'Initial inspection',
        assignedInspectorId: 'user-789',
      }

      const result = CreateInspectionDTOSchema.safeParse(validCreate)
      expect(result.success).toBe(true)
    })

    it('should accept create without optional fields', () => {
      const minimalCreate = {
        permitId: 'permit-456',
        scheduledDate: '2024-06-15T10:00:00Z',
      }

      const result = CreateInspectionDTOSchema.safeParse(minimalCreate)
      expect(result.success).toBe(true)
    })

    it('should reject missing required fields', () => {
      const invalidCreates = [
        { scheduledDate: '2024-06-15T10:00:00Z' }, // Missing permitId
        { permitId: 'permit-456' }, // Missing scheduledDate
        {}, // Missing both
      ]

      invalidCreates.forEach((create) => {
        const result = CreateInspectionDTOSchema.safeParse(create)
        expect(result.success).toBe(false)
      })
    })

    it('should reject invalid datetime', () => {
      const invalidCreate = {
        permitId: 'permit-456',
        scheduledDate: 'invalid-date',
      }

      const result = CreateInspectionDTOSchema.safeParse(invalidCreate)
      expect(result.success).toBe(false)
    })
  })

  describe('UpdateInspectionDTOSchema', () => {
    it('should accept partial update data', () => {
      const validUpdates = [
        { status: 'IN_PROGRESS' },
        { scheduledDate: '2024-06-16T10:00:00Z' },
        { completedDate: '2024-06-15T14:30:00Z' },
        { notes: 'Updated notes' },
        { assignedInspectorId: 'user-999' },
        {},
      ]

      validUpdates.forEach((update) => {
        const result = UpdateInspectionDTOSchema.safeParse(update)
        expect(result.success).toBe(true)
      })
    })

    it('should accept empty update object', () => {
      const emptyUpdate = {}

      const result = UpdateInspectionDTOSchema.safeParse(emptyUpdate)
      expect(result.success).toBe(true)
    })

    it('should reject invalid field values', () => {
      const invalidUpdates = [
        { status: 'INVALID_STATUS' }, // Invalid enum
        { scheduledDate: 'invalid-date' }, // Invalid datetime
        { completedDate: 'not-a-date' }, // Invalid datetime
      ]

      invalidUpdates.forEach((update) => {
        const result = UpdateInspectionDTOSchema.safeParse(update)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('InspectionSearchQuerySchema', () => {
    it('should accept valid search query', () => {
      const validQuery = {
        permitId: 'permit-456',
        status: 'SCHEDULED',
        assignedInspectorId: 'user-789',
        scheduledAfter: '2024-01-01T00:00:00Z',
        scheduledBefore: '2024-12-31T23:59:59Z',
        limit: 20,
        offset: 0,
      }

      const result = InspectionSearchQuerySchema.safeParse(validQuery)
      expect(result.success).toBe(true)
    })

    it('should accept empty search query with defaults', () => {
      const emptyQuery = {}

      const result = InspectionSearchQuerySchema.safeParse(emptyQuery)
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

      const result = InspectionSearchQuerySchema.safeParse(invalidQuery)
      expect(result.success).toBe(false)
    })

    it('should reject negative offset', () => {
      const invalidQuery = {
        offset: -1,
      }

      const result = InspectionSearchQuerySchema.safeParse(invalidQuery)
      expect(result.success).toBe(false)
    })

    it('should reject invalid datetime strings', () => {
      const invalidQueries = [{ scheduledAfter: 'invalid-date' }, { scheduledBefore: 'not-a-date' }]

      invalidQueries.forEach((query) => {
        const result = InspectionSearchQuerySchema.safeParse(query)
        expect(result.success).toBe(false)
      })
    })
  })
})
