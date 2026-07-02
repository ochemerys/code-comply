import { describe, it, expect, beforeEach, vi } from 'vitest'
import { permitService } from './permit.service'
import { prisma } from '@codecomply/db'
import type { Permit } from '@codecomply/db'

// Mock Prisma client
vi.mock('@codecomply/db', () => ({
  prisma: {
    permit: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    inspectionSchedule: {
      findMany: vi.fn(),
    },
  },
}))

describe('PermitService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getById', () => {
    it('should return permit with inspections', async () => {
      const mockPermit = {
        id: 'permit-123',
        permitNumber: 'P-2024-001',
        address: '123 Main St',
        legalLandDesc: 'Lot 1, Block 2',
        scope: 'New Construction',
        status: 'ACTIVE',
        latitude: 51.0447,
        longitude: -114.0719,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        inspections: [
          {
            id: 'insp-1',
            status: 'SCHEDULED',
            scheduledDate: new Date('2024-02-01'),
            schedule: {
              assignedTo: {
                id: 'user-1',
                name: 'John Doe',
                email: 'john@example.com',
              },
            },
          },
        ],
      }

      vi.mocked(prisma.permit.findUnique).mockResolvedValue(mockPermit as any)

      const result = await permitService.getById('permit-123')

      expect(result).toBeDefined()
      expect(result?.id).toBe('permit-123')
      expect(result?.permitNumber).toBe('P-2024-001')
      expect(result?.inspections).toHaveLength(1)
      expect(prisma.permit.findUnique).toHaveBeenCalledWith({
        where: { id: 'permit-123' },
        include: expect.objectContaining({
          inspections: expect.any(Object),
        }),
      })
    })

    it('should return null if permit not found', async () => {
      vi.mocked(prisma.permit.findUnique).mockResolvedValue(null)

      const result = await permitService.getById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('search', () => {
    it('should search by permit number', async () => {
      const mockPermits = [
        {
          id: 'permit-123',
          permitNumber: 'P-2024-001',
          address: '123 Main St',
          scope: 'New Construction',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
          inspections: [],
        },
      ]

      vi.mocked(prisma.permit.findMany).mockResolvedValue(mockPermits as any)

      const result = await permitService.search({
        permitNumber: 'P-2024-001',
      })

      expect(result).toHaveLength(1)
      expect(result[0].permitNumber).toBe('P-2024-001')
      expect(prisma.permit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            permitNumber: {
              contains: 'P-2024-001',
              mode: 'insensitive',
            },
          }),
        }),
      )
    })

    it('should search by address (case-insensitive)', async () => {
      const mockPermits = [
        {
          id: 'permit-123',
          permitNumber: 'P-2024-001',
          address: '123 Main Street',
          scope: 'New Construction',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
          inspections: [],
        },
      ]

      vi.mocked(prisma.permit.findMany).mockResolvedValue(mockPermits as any)

      const result = await permitService.search({
        address: 'main',
      })

      expect(result).toHaveLength(1)
      expect(prisma.permit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            address: {
              contains: 'main',
              mode: 'insensitive',
            },
          }),
        }),
      )
    })

    it('should filter by status', async () => {
      const mockPermits = [
        {
          id: 'permit-123',
          permitNumber: 'P-2024-001',
          address: '123 Main St',
          scope: 'New Construction',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
          inspections: [],
        },
      ]

      vi.mocked(prisma.permit.findMany).mockResolvedValue(mockPermits as any)

      const result = await permitService.search({
        status: 'ACTIVE',
      })

      expect(result).toHaveLength(1)
      expect(prisma.permit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
          }),
        }),
      )
    })

    it('should apply pagination', async () => {
      vi.mocked(prisma.permit.findMany).mockResolvedValue([])

      await permitService.search({
        limit: 10,
        offset: 20,
      })

      expect(prisma.permit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        }),
      )
    })

    it('should use default pagination if not provided', async () => {
      vi.mocked(prisma.permit.findMany).mockResolvedValue([])

      await permitService.search({})

      expect(prisma.permit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          skip: 0,
        }),
      )
    })
  })

  describe('findNearby', () => {
    it('should find permits within radius', async () => {
      const mockPermits = [
        {
          id: 'permit-1',
          permitNumber: 'P-2024-001',
          address: '123 Main St',
          scope: 'New Construction',
          status: 'ACTIVE',
          latitude: 51.0447, // Calgary coordinates
          longitude: -114.0719,
          createdAt: new Date(),
          updatedAt: new Date(),
          inspections: [],
        },
        {
          id: 'permit-2',
          permitNumber: 'P-2024-002',
          address: '456 Oak Ave',
          scope: 'Renovation',
          status: 'ACTIVE',
          latitude: 51.045, // Very close to first permit
          longitude: -114.072,
          createdAt: new Date(),
          updatedAt: new Date(),
          inspections: [],
        },
        {
          id: 'permit-3',
          permitNumber: 'P-2024-003',
          address: '789 Far Away Rd',
          scope: 'Addition',
          status: 'ACTIVE',
          latitude: 52.0, // Far away
          longitude: -115.0,
          createdAt: new Date(),
          updatedAt: new Date(),
          inspections: [],
        },
      ]

      vi.mocked(prisma.permit.findMany).mockResolvedValue(mockPermits as any)

      const { permits } = await permitService.findNearby(
        51.0447,
        -114.0719,
        1000, // 1km radius
      )

      // Should only return permits within 1km
      expect(permits.length).toBeLessThanOrEqual(2)
      expect(permits[0]).toHaveProperty('distance')
      expect(permits[0].distance).toBeLessThanOrEqual(1000)

      // Results should be sorted by distance
      if (permits.length > 1) {
        expect(permits[0].distance).toBeLessThanOrEqual(permits[1].distance)
      }
    })

    it('should filter by status', async () => {
      const mockPermits = [
        {
          id: 'permit-1',
          permitNumber: 'P-2024-001',
          address: '123 Main St',
          scope: 'New Construction',
          status: 'ACTIVE',
          latitude: 51.0447,
          longitude: -114.0719,
          createdAt: new Date(),
          updatedAt: new Date(),
          inspections: [],
        },
      ]

      vi.mocked(prisma.permit.findMany).mockResolvedValue(mockPermits as any)

      await permitService.findNearby(51.0447, -114.0719, 5000, 'ACTIVE')

      expect(prisma.permit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
          }),
        }),
      )
    })

    it('should exclude permits without GPS coordinates', async () => {
      const mockPermits = [
        {
          id: 'permit-1',
          permitNumber: 'P-2024-001',
          address: '123 Main St',
          scope: 'New Construction',
          status: 'ACTIVE',
          latitude: null,
          longitude: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          inspections: [],
        },
      ]

      vi.mocked(prisma.permit.findMany).mockResolvedValue(mockPermits as any)

      const { permits } = await permitService.findNearby(51.0447, -114.0719, 5000)

      expect(permits).toHaveLength(0)
    })

    it('should limit results', async () => {
      const mockPermits = Array.from({ length: 50 }, (_, i) => ({
        id: `permit-${i}`,
        permitNumber: `P-2024-${String(i).padStart(3, '0')}`,
        address: `${i} Main St`,
        scope: 'New Construction',
        status: 'ACTIVE',
        latitude: 51.0447 + i * 0.0001, // Slightly different coordinates
        longitude: -114.0719 + i * 0.0001,
        createdAt: new Date(),
        updatedAt: new Date(),
        inspections: [],
      }))

      vi.mocked(prisma.permit.findMany).mockResolvedValue(mockPermits as any)

      const { permits } = await permitService.findNearby(
        51.0447,
        -114.0719,
        50000, // Large radius to include all
        undefined,
        10, // Limit to 10
      )

      expect(permits.length).toBeLessThanOrEqual(10)
    })

    it('should use default radius if not provided', async () => {
      vi.mocked(prisma.permit.findMany).mockResolvedValue([])

      await permitService.findNearby(51.0447, -114.0719)

      // Default radius is 5000m (5km)
      // Just verify the method was called
      expect(prisma.permit.findMany).toHaveBeenCalled()
    })
  })

  describe('list', () => {
    it('should list all permits with pagination', async () => {
      const mockPermits = [
        {
          id: 'permit-1',
          permitNumber: 'P-2024-001',
          address: '123 Main St',
          scope: 'New Construction',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
          inspections: [],
        },
      ]

      vi.mocked(prisma.permit.findMany).mockResolvedValue(mockPermits as any)

      const result = await permitService.list(10, 0)

      expect(result).toHaveLength(1)
      expect(prisma.permit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 0,
        }),
      )
    })

    it('should use default pagination', async () => {
      vi.mocked(prisma.permit.findMany).mockResolvedValue([])

      await permitService.list()

      expect(prisma.permit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          skip: 0,
        }),
      )
    })
  })

  describe('findAssignedToInspector', () => {
    it('should return distinct permits sorted by permit number', async () => {
      const permitA = {
        id: 'p-a',
        permitNumber: 'BP-002',
        address: 'A',
        status: 'ACTIVE',
        inspections: [],
      }
      const permitB = {
        id: 'p-b',
        permitNumber: 'BP-001',
        address: 'B',
        status: 'ACTIVE',
        inspections: [],
      }
      vi.mocked(prisma.inspectionSchedule.findMany).mockResolvedValue([
        { inspection: { permit: permitA } },
        { inspection: { permit: permitB } },
        { inspection: { permit: permitA } },
      ] as any)

      const result = await permitService.findAssignedToInspector('user-1')

      expect(prisma.inspectionSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { assignedToId: 'user-1' } }),
      )
      expect(result.map((p) => p.id)).toEqual(['p-b', 'p-a'])
    })

    it('should return empty when none assigned', async () => {
      vi.mocked(prisma.inspectionSchedule.findMany).mockResolvedValue([])
      const result = await permitService.findAssignedToInspector('nobody')
      expect(result).toEqual([])
    })
  })

  describe('calculateDistance', () => {
    it('should calculate distance correctly', () => {
      // Test with known coordinates
      // Calgary to Edmonton is approximately 300km
      const calgaryLat = 51.0447
      const calgaryLng = -114.0719
      const edmontonLat = 53.5461
      const edmontonLng = -113.4938

      // Access private method through service instance
      const service = new (permitService.constructor as any)()
      const distance = service.calculateDistance(calgaryLat, calgaryLng, edmontonLat, edmontonLng)

      // Distance should be approximately 300km (300,000m)
      // Allow 10% margin of error
      expect(distance).toBeGreaterThan(270000)
      expect(distance).toBeLessThan(330000)
    })

    it('should return 0 for same coordinates', () => {
      const service = new (permitService.constructor as any)()
      const distance = service.calculateDistance(51.0447, -114.0719, 51.0447, -114.0719)

      expect(distance).toBe(0)
    })
  })
})
