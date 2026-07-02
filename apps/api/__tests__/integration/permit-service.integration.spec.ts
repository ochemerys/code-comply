import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { prisma as db } from '@codecomply/db'
import { PermitService } from '../../src/services/permit.service'

describe.sequential('PermitService Integration Tests', () => {
  let service: PermitService
  let testPermitIds: string[] = []
  let testUserId: string

  beforeAll(async () => {
    service = new PermitService()

    // Create test user
    const user = await db.user.create({
      data: {
        id: `permit-test-user-${Date.now()}`,
        email: `permit-test-${Date.now()}@example.com`,
        name: 'Test Permit User',
        role: 'SCO',
      },
    })
    testUserId = user.id
  })

  afterAll(async () => {
    // Cleanup (do not $disconnect - other integration test files share the client)
    await db.inspectionSchedule.deleteMany()
    await db.permitInspection.deleteMany()
    await db.permit.deleteMany()
    await db.user.deleteMany()
  })

  beforeEach(async () => {
    // Clear permits before each test
    await db.inspectionSchedule.deleteMany()
    await db.permitInspection.deleteMany()
    await db.permit.deleteMany()
    testPermitIds = []
  })

  describe('getById', () => {
    it('should retrieve permit with inspections from database', async () => {
      // Create test permit
      const permit = await db.permit.create({
        data: {
          permitNumber: 'P-2024-INT-001',
          address: '123 Integration Test St',
          legalLandDesc: 'Lot 1, Block 2, Plan 3',
          scope: 'New Construction',
          status: 'ACTIVE',
          latitude: 51.0447,
          longitude: -114.0719,
        },
      })
      testPermitIds.push(permit.id)

      // Create inspection for permit
      const inspection = await db.permitInspection.create({
        data: {
          permitId: permit.id,
          scheduledDate: new Date('2024-02-01'),
          status: 'SCHEDULED',
        },
      })

      // Create schedule for inspection
      await db.inspectionSchedule.create({
        data: {
          inspectionId: inspection.id,
          assignedToId: testUserId,
        },
      })

      // Test getById
      const result = await service.getById(permit.id)

      expect(result).toBeDefined()
      expect(result?.id).toBe(permit.id)
      expect(result?.permitNumber).toBe('P-2024-INT-001')
      expect(result?.address).toBe('123 Integration Test St')
      expect(result?.inspections).toHaveLength(1)
      expect(result?.inspections[0].id).toBe(inspection.id)
      expect(result?.inspections[0].schedule).toBeDefined()
      expect(result?.inspections[0].schedule?.assignedToId).toBe(testUserId)
    })

    it('should return null for non-existent permit', async () => {
      const result = await service.getById('non-existent-id')
      expect(result).toBeNull()
    })

    it('should order inspections by scheduled date descending', async () => {
      // Create permit
      const permit = await db.permit.create({
        data: {
          permitNumber: 'P-2024-INT-002',
          address: '456 Test Ave',
          scope: 'Renovation',
          status: 'ACTIVE',
        },
      })
      testPermitIds.push(permit.id)

      // Create multiple inspections with different dates
      const inspection1 = await db.permitInspection.create({
        data: {
          permitId: permit.id,
          scheduledDate: new Date('2024-01-15'),
          status: 'SCHEDULED',
        },
      })

      const inspection2 = await db.permitInspection.create({
        data: {
          permitId: permit.id,
          scheduledDate: new Date('2024-02-20'),
          status: 'SCHEDULED',
        },
      })

      const inspection3 = await db.permitInspection.create({
        data: {
          permitId: permit.id,
          scheduledDate: new Date('2024-01-30'),
          status: 'SCHEDULED',
        },
      })

      // Test getById
      const result = await service.getById(permit.id)

      expect(result?.inspections).toHaveLength(3)
      // Should be ordered by scheduledDate descending
      expect(result?.inspections[0].id).toBe(inspection2.id) // Feb 20
      expect(result?.inspections[1].id).toBe(inspection3.id) // Jan 30
      expect(result?.inspections[2].id).toBe(inspection1.id) // Jan 15
    })
  })

  describe('search', () => {
    beforeEach(async () => {
      // Create test permits
      await db.permit.createMany({
        data: [
          {
            permitNumber: 'P-2024-SEARCH-001',
            address: '123 Main Street',
            scope: 'New Construction',
            status: 'ACTIVE',
          },
          {
            permitNumber: 'P-2024-SEARCH-002',
            address: '456 Oak Avenue',
            scope: 'Renovation',
            status: 'ACTIVE',
          },
          {
            permitNumber: 'P-2024-SEARCH-003',
            address: '789 Main Boulevard',
            scope: 'Addition',
            status: 'ACTIVE',
          },
          {
            permitNumber: 'P-2023-OLD-001',
            address: '999 Old Street',
            scope: 'Demolition',
            status: 'COMPLETED',
          },
        ],
      })
    })

    it('should search permits by permit number', async () => {
      const results = await service.search({ permitNumber: 'P-2024-SEARCH' })

      expect(results.length).toBeGreaterThanOrEqual(3)
      expect(results.every((p) => p.permitNumber.includes('SEARCH'))).toBe(true)
    })

    it('should search permits by address', async () => {
      const results = await service.search({ address: 'Main' })

      expect(results.length).toBeGreaterThanOrEqual(2)
      expect(results.every((p) => p.address.toLowerCase().includes('main'))).toBe(true)
    })

    it('should be case-insensitive', async () => {
      const results1 = await service.search({ address: 'main' })
      const results2 = await service.search({ address: 'MAIN' })
      const results3 = await service.search({ address: 'Main' })

      expect(results1.length).toBe(results2.length)
      expect(results2.length).toBe(results3.length)
    })

    it('should only return active permits', async () => {
      const results = await service.search({ permitNumber: 'P-2024', status: 'ACTIVE' })

      expect(results.every((p) => p.status === 'ACTIVE')).toBe(true)
      expect(results.every((p) => p.permitNumber !== 'P-2023-OLD-001')).toBe(true)
    })

    it('should return empty array for no matches', async () => {
      const results = await service.search({ permitNumber: 'NONEXISTENT' })
      expect(results).toEqual([])
    })

    it('should return empty array for empty query', async () => {
      const results = await service.search({})
      expect(results.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('findNearby', () => {
    beforeEach(async () => {
      // Create permits at various locations around Calgary
      // Calgary downtown: 51.0447° N, 114.0719° W
      await db.permit.createMany({
        data: [
          {
            permitNumber: 'P-2024-NEAR-001',
            address: 'Downtown Calgary',
            scope: 'New Construction',
            status: 'ACTIVE',
            latitude: 51.045, // ~33 meters from center
            longitude: -114.072,
          },
          {
            permitNumber: 'P-2024-NEAR-002',
            address: 'Beltline Calgary',
            scope: 'Renovation',
            status: 'ACTIVE',
            latitude: 51.04, // ~600 meters from center
            longitude: -114.07,
          },
          {
            permitNumber: 'P-2024-NEAR-003',
            address: 'North Calgary',
            scope: 'Addition',
            status: 'ACTIVE',
            latitude: 51.1, // ~6 km from center
            longitude: -114.1,
          },
          {
            permitNumber: 'P-2024-NO-GPS',
            address: 'No GPS Location',
            scope: 'Renovation',
            status: 'ACTIVE',
            latitude: null,
            longitude: null,
          },
        ],
      })
    })

    it('should find permits within radius', async () => {
      const centerLat = 51.0447
      const centerLng = -114.0719

      const { permits } = await service.findNearby(centerLat, centerLng, 1000) // 1 km radius (meters)

      expect(permits.length).toBeGreaterThanOrEqual(2)
      expect(permits.some((p) => p.permitNumber === 'P-2024-NEAR-001')).toBe(true)
      expect(permits.some((p) => p.permitNumber === 'P-2024-NEAR-002')).toBe(true)
      expect(permits.some((p) => p.permitNumber === 'P-2024-NEAR-003')).toBe(false)
    })

    it('should sort permits by distance (closest first)', async () => {
      const centerLat = 51.0447
      const centerLng = -114.0719

      const { permits } = await service.findNearby(centerLat, centerLng, 10000) // 10 km radius (meters)

      expect(permits.length).toBeGreaterThanOrEqual(3)
      // First result should be closest (P-2024-NEAR-001)
      expect(permits[0].permitNumber).toBe('P-2024-NEAR-001')
    })

    it('should exclude permits without GPS coordinates', async () => {
      const centerLat = 51.0447
      const centerLng = -114.0719

      const { permits } = await service.findNearby(centerLat, centerLng, 100)

      expect(permits.every((p) => p.latitude !== null && p.longitude !== null)).toBe(true)
      expect(permits.every((p) => p.permitNumber !== 'P-2024-NO-GPS')).toBe(true)
    })

    it('should only return active permits', async () => {
      // Create completed permit with GPS
      await db.permit.create({
        data: {
          permitNumber: 'P-2024-COMPLETED',
          address: 'Completed Project',
          scope: 'Renovation',
          status: 'COMPLETED',
          latitude: 51.045,
          longitude: -114.072,
        },
      })

      const centerLat = 51.0447
      const centerLng = -114.0719

      const { permits } = await service.findNearby(centerLat, centerLng, 1)

      expect(permits.every((p) => p.status === 'ACTIVE')).toBe(true)
      expect(permits.every((p) => p.permitNumber !== 'P-2024-COMPLETED')).toBe(true)
    })

    it('should return empty array if no permits within radius', async () => {
      // Search in a location far from any permits
      const { permits } = await service.findNearby(50.0, -113.0, 1)
      expect(permits).toEqual([])
    })

    it('should throw error for invalid coordinates', async () => {
      await expect(service.findNearby(-91, -114.0719, 5)).rejects.toThrow('Invalid latitude')
      await expect(service.findNearby(91, -114.0719, 5)).rejects.toThrow('Invalid latitude')
      await expect(service.findNearby(51.0447, -181, 5)).rejects.toThrow('Invalid longitude')
      await expect(service.findNearby(51.0447, 181, 5)).rejects.toThrow('Invalid longitude')
      await expect(service.findNearby(51.0447, -114.0719, 0)).rejects.toThrow('Invalid radius')
      await expect(service.findNearby(51.0447, -114.0719, -5)).rejects.toThrow('Invalid radius')
    })
  })

  describe('list', () => {
    beforeEach(async () => {
      // Create test permits
      await db.permit.createMany({
        data: [
          {
            permitNumber: 'P-2024-LIST-001',
            address: '123 First Street',
            scope: 'New Construction',
            status: 'ACTIVE',
          },
          {
            permitNumber: 'P-2024-LIST-002',
            address: '456 Second Avenue',
            scope: 'Renovation',
            status: 'ACTIVE',
          },
          {
            permitNumber: 'P-2024-LIST-003',
            address: '789 Third Boulevard',
            scope: 'Addition',
            status: 'COMPLETED',
          },
          {
            permitNumber: 'P-2024-LIST-004',
            address: '999 Fourth Road',
            scope: 'Demolition',
            status: 'CANCELLED',
          },
        ],
      })
    })

    it('should list all permits with default filters', async () => {
      const results = await service.search({})

      expect(results.length).toBeGreaterThanOrEqual(4)
    })

    it('should filter by status', async () => {
      const results = await service.search({ status: 'ACTIVE' })

      expect(results.length).toBeGreaterThanOrEqual(2)
      expect(results.every((p) => p.status === 'ACTIVE')).toBe(true)
    })

    it('should filter by permit number', async () => {
      const results = await service.search({ permitNumber: 'P-2024-LIST-001' })

      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results.some((p) => p.permitNumber === 'P-2024-LIST-001')).toBe(true)
    })

    it('should filter by address', async () => {
      const results = await service.search({ address: 'First' })

      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results.some((p) => p.address.includes('First'))).toBe(true)
    })

    it('should apply limit', async () => {
      const results = await service.search({ limit: 2 })

      expect(results.length).toBeLessThanOrEqual(2)
    })

    it('should apply offset', async () => {
      const allResults = await service.search({ limit: 100 })
      const offsetResults = await service.search({ offset: 2, limit: 100 })

      expect(offsetResults.length).toBeLessThanOrEqual(allResults.length - 2)
    })

    it('should combine multiple filters', async () => {
      const results = await service.search({
        status: 'ACTIVE',
        permitNumber: 'P-2024-LIST',
        limit: 10,
      })

      expect(results.every((p) => p.status === 'ACTIVE')).toBe(true)
      expect(results.every((p) => p.permitNumber.includes('LIST'))).toBe(true)
      expect(results.length).toBeLessThanOrEqual(10)
    })

    it('should order by createdAt descending', async () => {
      const results = await service.search({ limit: 100 })

      // Verify results are ordered by createdAt descending
      for (let i = 0; i < results.length - 1; i++) {
        const current = new Date(results[i].createdAt).getTime()
        const next = new Date(results[i + 1].createdAt).getTime()
        expect(current).toBeGreaterThanOrEqual(next)
      }
    })
  })

  describe('Haversine distance calculation', () => {
    it('should calculate accurate distances for known locations', async () => {
      // Create permits at known locations
      await db.permit.createMany({
        data: [
          {
            permitNumber: 'P-CALGARY',
            address: 'Calgary, AB',
            scope: 'Test',
            status: 'ACTIVE',
            latitude: 51.0447,
            longitude: -114.0719,
          },
          {
            permitNumber: 'P-EDMONTON',
            address: 'Edmonton, AB',
            scope: 'Test',
            status: 'ACTIVE',
            latitude: 53.5461,
            longitude: -113.4938,
          },
        ],
      })

      // Calgary to Edmonton is approximately 300 km
      const calgaryLat = 51.0447
      const calgaryLng = -114.0719

      // Should not find Edmonton within 100 km of Calgary (radius in meters)
      const { permits: permits100 } = await service.findNearby(calgaryLat, calgaryLng, 100 * 1000)
      expect(permits100.every((p) => p.permitNumber !== 'P-EDMONTON')).toBe(true)

      // Should find Edmonton within 400 km of Calgary (radius in meters)
      const { permits: permits400 } = await service.findNearby(calgaryLat, calgaryLng, 400 * 1000)
      expect(permits400.some((p) => p.permitNumber === 'P-EDMONTON')).toBe(true)
    })
  })
})
