import { describe, it, expect } from 'vitest'
import { PermitMapper } from './permit.mapper'
import type { Permit, PermitInspection } from '@codecomply/db'

describe('PermitMapper', () => {
  const createMockPermit = (overrides?: Partial<Permit>): Permit =>
    ({
      id: 'permit-123',
      permitNumber: 'P-2024-001',
      address: '123 Main Street',
      legalLandDesc: 'Lot 1, Block 2, Plan 123456',
      scope: 'New Construction - Single Family Dwelling',
      status: 'ACTIVE',
      latitude: 51.0447,
      longitude: -114.0719,
      createdAt: new Date('2024-01-15T10:00:00Z'),
      updatedAt: new Date('2024-01-15T12:00:00Z'),
      ...overrides,
    }) as Permit

  const createMockInspection = (overrides?: Partial<PermitInspection>): PermitInspection =>
    ({
      id: 'insp-123',
      permitId: 'permit-123',
      status: 'SCHEDULED',
      scheduledDate: new Date('2024-02-01T09:00:00Z'),
      completedDate: null,
      notes: null,
      createdAt: new Date('2024-01-15T10:00:00Z'),
      updatedAt: new Date('2024-01-15T10:00:00Z'),
      ...overrides,
    }) as PermitInspection

  describe('toDTO', () => {
    it('should map permit entity to DTO correctly', () => {
      const permit = createMockPermit()
      const dto = PermitMapper.toDTO(permit)

      expect(dto.id).toBe('permit-123')
      expect(dto.permitNumber).toBe('P-2024-001')
      expect(dto.address).toBe('123 Main Street')
      expect(dto.legalLandDesc).toBe('Lot 1, Block 2, Plan 123456')
      expect(dto.scope).toBe('New Construction - Single Family Dwelling')
      expect(dto.status).toBe('ACTIVE')
      expect(dto.latitude).toBe(51.0447)
      expect(dto.longitude).toBe(-114.0719)
      expect(dto.createdAt).toBe('2024-01-15T10:00:00.000Z')
      expect(dto.updatedAt).toBe('2024-01-15T12:00:00.000Z')
    })

    it('should handle missing optional fields', () => {
      const permit = createMockPermit({
        legalLandDesc: null,
        latitude: null,
        longitude: null,
      })
      const dto = PermitMapper.toDTO(permit)

      expect(dto.legalLandDesc).toBeUndefined()
      expect(dto.latitude).toBeUndefined()
      expect(dto.longitude).toBeUndefined()
    })

    it('should include inspections if provided', () => {
      const inspection = createMockInspection()
      const permit = {
        ...createMockPermit(),
        inspections: [
          {
            ...inspection,
            schedule: {
              assignedTo: {
                id: 'user-123',
                name: 'John Doe',
              },
            },
          },
        ],
      }

      const dto = PermitMapper.toDTO(permit as any)

      expect(dto.inspections).toBeDefined()
      expect(dto.inspections).toHaveLength(1)
      expect(dto.inspections![0].id).toBe('insp-123')
      expect(dto.inspections![0].status).toBe('SCHEDULED')
      expect(dto.inspections![0].scheduledDate).toBe('2024-02-01T09:00:00.000Z')
      expect(dto.inspections![0].assignedInspectorName).toBe('John Doe')
    })

    it('should map workflow stages on inspections and permit label', () => {
      const inspection = createMockInspection()
      const permit = {
        ...createMockPermit(),
        inspections: [
          {
            ...inspection,
            schedule: null,
            workflow: { stages: ['FOUNDATION'] },
          },
        ],
      }

      const dto = PermitMapper.toDTO(permit as any)

      expect(dto.inspectionStageLabel).toBe('Foundation')
      expect(dto.inspections![0].stages).toEqual(['FOUNDATION'])
    })

    it('should map checklist executions on inspections when present', () => {
      const inspection = createMockInspection()
      const permit = {
        ...createMockPermit(),
        inspections: [
          {
            ...inspection,
            schedule: null,
            checklistExecutions: [
              { id: 'exec-1', completedAt: null },
              {
                id: 'exec-0',
                completedAt: new Date('2024-01-01T00:00:00.000Z'),
              },
            ],
          },
        ],
      }

      const dto = PermitMapper.toDTO(permit as any)

      expect(dto.inspections![0].checklistExecutions).toEqual([
        { id: 'exec-1', completedAt: null },
        { id: 'exec-0', completedAt: '2024-01-01T00:00:00.000Z' },
      ])
    })

    it('should handle inspections without schedule', () => {
      const inspection = createMockInspection()
      const permit = {
        ...createMockPermit(),
        inspections: [
          {
            ...inspection,
            schedule: null,
          },
        ],
      }

      const dto = PermitMapper.toDTO(permit as any)

      expect(dto.inspections).toBeDefined()
      expect(dto.inspections).toHaveLength(1)
      expect(dto.inspections![0].assignedInspectorName).toBeUndefined()
    })

    it('should handle all permit statuses', () => {
      const statuses = ['ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED']

      statuses.forEach((status) => {
        const permit = createMockPermit({ status: status as any })
        const dto = PermitMapper.toDTO(permit)
        expect(dto.status).toBe(status)
      })
    })
  })

  describe('toListDTO', () => {
    it('should map permit entity to list DTO correctly', () => {
      const permit = createMockPermit()
      const dto = PermitMapper.toListDTO(permit)

      expect(dto.id).toBe('permit-123')
      expect(dto.permitNumber).toBe('P-2024-001')
      expect(dto.address).toBe('123 Main Street')
      expect(dto.legalLandDesc).toBe('Lot 1, Block 2, Plan 123456')
      expect(dto.status).toBe('ACTIVE')
    })

    it('should omit legalLandDesc when null on list DTO', () => {
      const permit = createMockPermit({ legalLandDesc: null })
      const dto = PermitMapper.toListDTO(permit)
      expect(dto.legalLandDesc).toBeUndefined()
    })

    it('should include distance if provided', () => {
      const permit = createMockPermit()
      const dto = PermitMapper.toListDTO(permit, 1234.56)

      expect(dto.distance).toBe(1234.56)
    })

    it('should not include distance if not provided', () => {
      const permit = createMockPermit()
      const dto = PermitMapper.toListDTO(permit)

      expect(dto.distance).toBeUndefined()
    })

    it('should find next scheduled inspection', () => {
      const permit = {
        ...createMockPermit(),
        inspections: [
          createMockInspection({
            id: 'insp-1',
            status: 'SCHEDULED',
            scheduledDate: new Date('2024-02-15T09:00:00Z'),
          }),
          createMockInspection({
            id: 'insp-2',
            status: 'SCHEDULED',
            scheduledDate: new Date('2024-02-01T09:00:00Z'), // Earlier date
          }),
          createMockInspection({
            id: 'insp-3',
            status: 'PASSED',
            scheduledDate: new Date('2024-01-15T09:00:00Z'),
          }),
        ],
      }

      const dto = PermitMapper.toListDTO(permit as any)

      // Should return the earliest scheduled inspection
      expect(dto.nextInspectionDate).toBe('2024-02-01T09:00:00.000Z')
    })

    it('should include inspection stage label from next scheduled inspection workflow', () => {
      const permit = {
        ...createMockPermit(),
        inspections: [
          createMockInspection({
            id: 'insp-1',
            status: 'SCHEDULED',
            scheduledDate: new Date('2024-02-01T09:00:00Z'),
            workflow: { stages: ['FOUNDATION'] },
          }),
        ],
      }

      const dto = PermitMapper.toListDTO(permit as any)

      expect(dto.inspectionStageLabel).toBe('Foundation')
    })

    it('should handle no scheduled inspections', () => {
      const permit = {
        ...createMockPermit(),
        inspections: [
          createMockInspection({
            status: 'PASSED',
          }),
          createMockInspection({
            status: 'FAILED',
          }),
        ],
      }

      const dto = PermitMapper.toListDTO(permit as any)

      expect(dto.nextInspectionDate).toBeUndefined()
    })

    it('should handle no inspections', () => {
      const permit = {
        ...createMockPermit(),
        inspections: [],
      }

      const dto = PermitMapper.toListDTO(permit as any)

      expect(dto.nextInspectionDate).toBeUndefined()
    })
  })

  describe('toDTOs', () => {
    it('should map array of permits to DTOs', () => {
      const permits = [
        createMockPermit({ id: 'permit-1', permitNumber: 'P-2024-001' }),
        createMockPermit({ id: 'permit-2', permitNumber: 'P-2024-002' }),
        createMockPermit({ id: 'permit-3', permitNumber: 'P-2024-003' }),
      ]

      const dtos = PermitMapper.toDTOs(permits)

      expect(dtos).toHaveLength(3)
      expect(dtos[0].id).toBe('permit-1')
      expect(dtos[0].permitNumber).toBe('P-2024-001')
      expect(dtos[1].id).toBe('permit-2')
      expect(dtos[1].permitNumber).toBe('P-2024-002')
      expect(dtos[2].id).toBe('permit-3')
      expect(dtos[2].permitNumber).toBe('P-2024-003')
    })

    it('should handle empty array', () => {
      const dtos = PermitMapper.toDTOs([])
      expect(dtos).toEqual([])
    })
  })

  describe('toListDTOs', () => {
    it('should map array of permits to list DTOs', () => {
      const permits = [
        createMockPermit({ id: 'permit-1', permitNumber: 'P-2024-001' }),
        createMockPermit({ id: 'permit-2', permitNumber: 'P-2024-002' }),
      ]

      const dtos = PermitMapper.toListDTOs(permits)

      expect(dtos).toHaveLength(2)
      expect(dtos[0].id).toBe('permit-1')
      expect(dtos[1].id).toBe('permit-2')
    })

    it('should include distance for each permit', () => {
      const permits = [
        { ...createMockPermit({ id: 'permit-1' }), distance: 100 },
        { ...createMockPermit({ id: 'permit-2' }), distance: 200 },
      ]

      const dtos = PermitMapper.toListDTOs(permits as any)

      expect(dtos[0].distance).toBe(100)
      expect(dtos[1].distance).toBe(200)
    })

    it('should handle empty array', () => {
      const dtos = PermitMapper.toListDTOs([])
      expect(dtos).toEqual([])
    })
  })
})
