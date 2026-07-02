import { describe, it, expect } from 'vitest'
import { InspectionMapper } from './inspection.mapper'
import type { PermitInspection, Permit } from '@codecomply/db'

describe('InspectionMapper', () => {
  const createMockInspection = (overrides?: Partial<PermitInspection>): PermitInspection =>
    ({
      id: 'insp-123',
      permitId: 'permit-456',
      esiteId: 'esite-789',
      status: 'SCHEDULED',
      scheduledDate: new Date('2024-02-01T09:00:00Z'),
      completedDate: null,
      notes: null,
      lastSyncedAt: new Date('2024-01-15T10:00:00Z'),
      etag: 'etag-123',
      createdAt: new Date('2024-01-15T10:00:00Z'),
      updatedAt: new Date('2024-01-15T12:00:00Z'),
      ...overrides,
    }) as PermitInspection

  const createMockPermit = (overrides?: Partial<Permit>): Permit =>
    ({
      id: 'permit-456',
      permitNumber: 'P-2024-001',
      address: '123 Main Street',
      legalLandDesc: 'Lot 1, Block 2',
      scope: 'New Construction',
      status: 'ACTIVE',
      latitude: 51.0447,
      longitude: -114.0719,
      createdAt: new Date('2024-01-01T10:00:00Z'),
      updatedAt: new Date('2024-01-01T10:00:00Z'),
      ...overrides,
    }) as Permit

  describe('toDTO', () => {
    it('should map inspection entity to DTO correctly', () => {
      const inspection = createMockInspection()
      const dto = InspectionMapper.toDTO(inspection)

      expect(dto.id).toBe('insp-123')
      expect(dto.permitId).toBe('permit-456')
      expect(dto.status).toBe('SCHEDULED')
      expect(dto.scheduledDate).toBe('2024-02-01T09:00:00.000Z')
      expect(dto.completedDate).toBeUndefined()
      expect(dto.notes).toBeUndefined()
      expect(dto.createdAt).toBe('2024-01-15T10:00:00.000Z')
      expect(dto.updatedAt).toBe('2024-01-15T12:00:00.000Z')
    })

    it('should handle completed inspection', () => {
      const inspection = createMockInspection({
        status: 'PASSED',
        completedDate: new Date('2024-02-01T15:00:00Z'),
        notes: 'Inspection passed successfully',
      })
      const dto = InspectionMapper.toDTO(inspection)

      expect(dto.status).toBe('PASSED')
      expect(dto.completedDate).toBe('2024-02-01T15:00:00.000Z')
      expect(dto.notes).toBe('Inspection passed successfully')
    })

    it('should include assigned inspector info if provided', () => {
      const inspection = {
        ...createMockInspection(),
        schedule: {
          assignedTo: {
            id: 'user-123',
            name: 'John Doe',
          },
        },
      }

      const dto = InspectionMapper.toDTO(inspection as any)

      expect(dto.assignedInspectorId).toBe('user-123')
      expect(dto.assignedInspectorName).toBe('John Doe')
    })

    it('should handle missing schedule', () => {
      const inspection = {
        ...createMockInspection(),
        schedule: null,
      }

      const dto = InspectionMapper.toDTO(inspection as any)

      expect(dto.assignedInspectorId).toBeUndefined()
      expect(dto.assignedInspectorName).toBeUndefined()
    })

    it('should handle all inspection statuses', () => {
      const statuses = ['SCHEDULED', 'IN_PROGRESS', 'PASSED', 'FAILED', 'CANCELLED']

      statuses.forEach((status) => {
        const inspection = createMockInspection({ status: status as any })
        const dto = InspectionMapper.toDTO(inspection)
        expect(dto.status).toBe(status)
      })
    })

    it('should handle missing permitId', () => {
      const inspection = createMockInspection({ permitId: null })
      const dto = InspectionMapper.toDTO(inspection)

      expect(dto.permitId).toBe('')
    })
  })

  describe('toListDTO', () => {
    it('should map inspection entity to list DTO correctly', () => {
      const permit = createMockPermit()
      const inspection = {
        ...createMockInspection(),
        permit,
        schedule: {
          assignedTo: {
            id: 'user-123',
            name: 'John Doe',
          },
        },
      }

      const dto = InspectionMapper.toListDTO(inspection as any)

      expect(dto.id).toBe('insp-123')
      expect(dto.permitId).toBe('permit-456')
      expect(dto.permitNumber).toBe('P-2024-001')
      expect(dto.address).toBe('123 Main Street')
      expect(dto.status).toBe('SCHEDULED')
      expect(dto.scheduledDate).toBe('2024-02-01T09:00:00.000Z')
      expect(dto.assignedInspectorName).toBe('John Doe')
    })

    it('should handle missing permit', () => {
      const inspection = {
        ...createMockInspection(),
        permit: null,
      }

      const dto = InspectionMapper.toListDTO(inspection as any)

      expect(dto.permitNumber).toBe('N/A')
      expect(dto.address).toBe('N/A')
    })

    it('should handle missing schedule', () => {
      const permit = createMockPermit()
      const inspection = {
        ...createMockInspection(),
        permit,
        schedule: null,
      }

      const dto = InspectionMapper.toListDTO(inspection as any)

      expect(dto.assignedInspectorName).toBeUndefined()
    })

    it('should handle missing permitId', () => {
      const inspection = {
        ...createMockInspection({ permitId: null }),
        permit: null,
      }

      const dto = InspectionMapper.toListDTO(inspection as any)

      expect(dto.permitId).toBe('')
    })
  })

  describe('toDTOs', () => {
    it('should map array of inspections to DTOs', () => {
      const inspections = [
        createMockInspection({ id: 'insp-1', permitId: 'permit-1' }),
        createMockInspection({ id: 'insp-2', permitId: 'permit-2' }),
        createMockInspection({ id: 'insp-3', permitId: 'permit-3' }),
      ]

      const dtos = InspectionMapper.toDTOs(inspections)

      expect(dtos).toHaveLength(3)
      expect(dtos[0].id).toBe('insp-1')
      expect(dtos[0].permitId).toBe('permit-1')
      expect(dtos[1].id).toBe('insp-2')
      expect(dtos[1].permitId).toBe('permit-2')
      expect(dtos[2].id).toBe('insp-3')
      expect(dtos[2].permitId).toBe('permit-3')
    })

    it('should handle empty array', () => {
      const dtos = InspectionMapper.toDTOs([])
      expect(dtos).toEqual([])
    })

    it('should preserve all fields for each inspection', () => {
      const inspections = [
        {
          ...createMockInspection({ id: 'insp-1' }),
          schedule: {
            assignedTo: {
              id: 'user-1',
              name: 'John Doe',
            },
          },
        },
        {
          ...createMockInspection({ id: 'insp-2' }),
          schedule: {
            assignedTo: {
              id: 'user-2',
              name: 'Jane Smith',
            },
          },
        },
      ]

      const dtos = InspectionMapper.toDTOs(inspections as any)

      expect(dtos[0].assignedInspectorName).toBe('John Doe')
      expect(dtos[1].assignedInspectorName).toBe('Jane Smith')
    })
  })

  describe('toListDTOs', () => {
    it('should map array of inspections to list DTOs', () => {
      const permit1 = createMockPermit({ id: 'permit-1', permitNumber: 'P-2024-001' })
      const permit2 = createMockPermit({ id: 'permit-2', permitNumber: 'P-2024-002' })

      const inspections = [
        {
          ...createMockInspection({ id: 'insp-1', permitId: 'permit-1' }),
          permit: permit1,
          schedule: {
            assignedTo: {
              id: 'user-1',
              name: 'John Doe',
            },
          },
        },
        {
          ...createMockInspection({ id: 'insp-2', permitId: 'permit-2' }),
          permit: permit2,
          schedule: {
            assignedTo: {
              id: 'user-2',
              name: 'Jane Smith',
            },
          },
        },
      ]

      const dtos = InspectionMapper.toListDTOs(inspections as any)

      expect(dtos).toHaveLength(2)
      expect(dtos[0].id).toBe('insp-1')
      expect(dtos[0].permitNumber).toBe('P-2024-001')
      expect(dtos[0].assignedInspectorName).toBe('John Doe')
      expect(dtos[1].id).toBe('insp-2')
      expect(dtos[1].permitNumber).toBe('P-2024-002')
      expect(dtos[1].assignedInspectorName).toBe('Jane Smith')
    })

    it('should handle empty array', () => {
      const dtos = InspectionMapper.toListDTOs([])
      expect(dtos).toEqual([])
    })

    it('should handle mixed data quality', () => {
      const inspections = [
        {
          ...createMockInspection({ id: 'insp-1' }),
          permit: createMockPermit(),
          schedule: {
            assignedTo: {
              id: 'user-1',
              name: 'John Doe',
            },
          },
        },
        {
          ...createMockInspection({ id: 'insp-2' }),
          permit: null,
          schedule: null,
        },
      ]

      const dtos = InspectionMapper.toListDTOs(inspections as any)

      expect(dtos).toHaveLength(2)
      expect(dtos[0].permitNumber).toBe('P-2024-001')
      expect(dtos[0].assignedInspectorName).toBe('John Doe')
      expect(dtos[1].permitNumber).toBe('N/A')
      expect(dtos[1].assignedInspectorName).toBeUndefined()
    })
  })
})
