/**
 * Integration Tests for Permit Model (M4-S1)
 *
 * Tests GPS-based discovery, search functionality, and complex queries
 * that will be used by the Inspector PWA for permit retrieval.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient, PermitStatus } from '@prisma/client'

const prisma = new PrismaClient()

describe('Permit Integration Tests (M4-S1)', () => {
  beforeAll(async () => {
    // Clean up and seed test data
    await prisma.permit.deleteMany()

    // Create permits in different locations around Edmonton
    await prisma.permit.createMany({
      data: [
        // Downtown Edmonton
        {
          permitNumber: 'BP-2024-INT-001',
          address: '10230 Jasper Avenue, Edmonton, AB T5J 4P6',
          legalLandDesc: 'Plan 1234AB Block 5 Lot 12',
          scope: 'New Construction - Office Building',
          status: PermitStatus.ACTIVE,
          latitude: 53.5461,
          longitude: -113.4938,
        },
        {
          permitNumber: 'BP-2024-INT-002',
          address: '10665 Jasper Avenue, Edmonton, AB T5J 3S9',
          legalLandDesc: 'Plan 3456GH Block 7 Lot 15',
          scope: 'Commercial - Office Renovation',
          status: PermitStatus.ACTIVE,
          latitude: 53.5444,
          longitude: -113.4969,
        },
        // West Edmonton
        {
          permitNumber: 'BP-2024-INT-003',
          address: '8882 170 Street NW, Edmonton, AB T5T 4J2',
          legalLandDesc: 'Plan 5678CD Block 2 Lot 8',
          scope: 'Renovation - Kitchen and Bathroom',
          status: PermitStatus.ACTIVE,
          latitude: 53.5232,
          longitude: -113.6289,
        },
        // North Edmonton
        {
          permitNumber: 'BP-2024-INT-004',
          address: '11220 142 Street NW, Edmonton, AB T5M 1V1',
          legalLandDesc: 'Plan 9012EF Block 10 Lot 3',
          scope: 'Addition - Garage',
          status: PermitStatus.ACTIVE,
          latitude: 53.5673,
          longitude: -113.5789,
        },
        // South Edmonton
        {
          permitNumber: 'BP-2024-INT-005',
          address: '4015 Calgary Trail NW, Edmonton, AB T6J 5M8',
          legalLandDesc: 'Plan 7531QW Block 18 Lot 9',
          scope: 'New Construction - Retail',
          status: PermitStatus.ACTIVE,
          latitude: 53.4789,
          longitude: -113.4889,
        },
        // Completed permit
        {
          permitNumber: 'BP-2023-INT-100',
          address: '12345 82 Street NW, Edmonton, AB T5B 2W3',
          legalLandDesc: 'Plan 2468KL Block 12 Lot 5',
          scope: 'Deck Addition',
          status: PermitStatus.COMPLETED,
          latitude: 53.5505,
          longitude: -113.4658,
        },
        // Permit without GPS
        {
          permitNumber: 'BP-2024-INT-006',
          address: '9999 Unknown Street, Edmonton, AB T5X 0A0',
          legalLandDesc: null,
          scope: 'Fence Installation',
          status: PermitStatus.ACTIVE,
          latitude: null,
          longitude: null,
        },
      ],
    })
  })

  afterAll(async () => {
    await prisma.permit.deleteMany()
    await prisma.$disconnect()
  })

  describe('GPS-Based Discovery', () => {
    it('should find permits near a specific location (radius search)', async () => {
      // Downtown Edmonton coordinates
      const centerLat = 53.5461
      const centerLon = -113.4938
      const radiusKm = 1.0

      // Simple bounding box approximation (1 degree ≈ 111km)
      const latDelta = radiusKm / 111
      const lonDelta = radiusKm / (111 * Math.cos((centerLat * Math.PI) / 180))

      const permits = await prisma.permit.findMany({
        where: {
          AND: [
            { latitude: { gte: centerLat - latDelta } },
            { latitude: { lte: centerLat + latDelta } },
            { longitude: { gte: centerLon - lonDelta } },
            { longitude: { lte: centerLon + lonDelta } },
            { status: PermitStatus.ACTIVE },
          ],
        },
        orderBy: [{ latitude: 'asc' }, { longitude: 'asc' }],
      })

      expect(permits.length).toBeGreaterThan(0)
      // Should find downtown permits
      expect(permits.some((p) => p.permitNumber === 'BP-2024-INT-001')).toBe(true)
      expect(permits.some((p) => p.permitNumber === 'BP-2024-INT-002')).toBe(true)
    })

    it('should find permits within a bounding box', async () => {
      // Downtown Edmonton bounding box
      const minLat = 53.54
      const maxLat = 53.56
      const minLon = -113.5
      const maxLon = -113.49

      const permits = await prisma.permit.findMany({
        where: {
          AND: [
            { latitude: { gte: minLat } },
            { latitude: { lte: maxLat } },
            { longitude: { gte: minLon } },
            { longitude: { lte: maxLon } },
          ],
        },
      })

      expect(permits.length).toBeGreaterThan(0)
      permits.forEach((permit) => {
        if (permit.latitude && permit.longitude) {
          expect(permit.latitude).toBeGreaterThanOrEqual(minLat)
          expect(permit.latitude).toBeLessThanOrEqual(maxLat)
          expect(permit.longitude).toBeGreaterThanOrEqual(minLon)
          expect(permit.longitude).toBeLessThanOrEqual(maxLon)
        }
      })
    })

    it('should exclude permits without GPS coordinates from location search', async () => {
      const permits = await prisma.permit.findMany({
        where: {
          AND: [
            { latitude: { not: null } },
            { longitude: { not: null } },
            { status: PermitStatus.ACTIVE },
          ],
        },
      })

      permits.forEach((permit) => {
        expect(permit.latitude).not.toBeNull()
        expect(permit.longitude).not.toBeNull()
      })

      // Verify permit without GPS is excluded
      expect(permits.some((p) => p.permitNumber === 'BP-2024-INT-006')).toBe(false)
    })

    it('should find nearest permits (sorted by distance approximation)', async () => {
      // Inspector location (downtown)
      const inspectorLat = 53.545
      const inspectorLon = -113.495

      const permits = await prisma.permit.findMany({
        where: {
          AND: [
            { latitude: { not: null } },
            { longitude: { not: null } },
            { status: PermitStatus.ACTIVE },
          ],
        },
      })

      // Calculate distances and sort (simple Euclidean distance for testing)
      const permitsWithDistance = permits.map((permit) => {
        const latDiff = (permit.latitude || 0) - inspectorLat
        const lonDiff = (permit.longitude || 0) - inspectorLon
        const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff)
        return { ...permit, distance }
      })

      permitsWithDistance.sort((a, b) => a.distance - b.distance)

      expect(permitsWithDistance.length).toBeGreaterThan(0)
      // Nearest should be downtown permits
      expect(['BP-2024-INT-001', 'BP-2024-INT-002']).toContain(permitsWithDistance[0].permitNumber)
    })
  })

  describe('Local Search', () => {
    it('should search by permit number (exact match)', async () => {
      const permit = await prisma.permit.findUnique({
        where: { permitNumber: 'BP-2024-INT-001' },
      })

      expect(permit).toBeDefined()
      expect(permit?.permitNumber).toBe('BP-2024-INT-001')
    })

    it('should search by permit number (partial match)', async () => {
      const permits = await prisma.permit.findMany({
        where: {
          permitNumber: {
            contains: 'INT-00',
            mode: 'insensitive',
          },
        },
      })

      expect(permits.length).toBeGreaterThan(0)
      permits.forEach((permit) => {
        expect(permit.permitNumber).toContain('INT-00')
      })
    })

    it('should search by address (case-insensitive)', async () => {
      const permits = await prisma.permit.findMany({
        where: {
          address: {
            contains: 'jasper',
            mode: 'insensitive',
          },
        },
      })

      expect(permits.length).toBeGreaterThanOrEqual(2)
      permits.forEach((permit) => {
        expect(permit.address.toLowerCase()).toContain('jasper')
      })
    })

    it('should search by address (partial street name)', async () => {
      const permits = await prisma.permit.findMany({
        where: {
          address: {
            contains: '170 Street',
            mode: 'insensitive',
          },
        },
      })

      expect(permits.length).toBeGreaterThanOrEqual(1)
      expect(permits[0].permitNumber).toBe('BP-2024-INT-003')
    })

    it('should search by legal land description', async () => {
      const permits = await prisma.permit.findMany({
        where: {
          legalLandDesc: {
            contains: 'Block 5',
            mode: 'insensitive',
          },
        },
      })

      expect(permits.length).toBeGreaterThanOrEqual(1)
      permits.forEach((permit) => {
        expect(permit.legalLandDesc).toContain('Block 5')
      })
    })

    it('should search by scope', async () => {
      const permits = await prisma.permit.findMany({
        where: {
          scope: {
            contains: 'Renovation',
            mode: 'insensitive',
          },
        },
      })

      expect(permits.length).toBeGreaterThanOrEqual(1)
      permits.forEach((permit) => {
        expect(permit.scope.toLowerCase()).toContain('renovation')
      })
    })
  })

  describe('Combined Search Criteria', () => {
    it('should search by address AND status', async () => {
      const permits = await prisma.permit.findMany({
        where: {
          AND: [
            {
              address: {
                contains: 'Edmonton',
                mode: 'insensitive',
              },
            },
            { status: PermitStatus.ACTIVE },
          ],
        },
      })

      expect(permits.length).toBeGreaterThan(0)
      permits.forEach((permit) => {
        expect(permit.address).toContain('Edmonton')
        expect(permit.status).toBe(PermitStatus.ACTIVE)
      })
    })

    it('should search by GPS location AND status', async () => {
      const permits = await prisma.permit.findMany({
        where: {
          AND: [
            { latitude: { gte: 53.54 } },
            { latitude: { lte: 53.56 } },
            { longitude: { gte: -113.5 } },
            { longitude: { lte: -113.49 } },
            { status: PermitStatus.ACTIVE },
          ],
        },
      })

      expect(permits.length).toBeGreaterThan(0)
      permits.forEach((permit) => {
        expect(permit.status).toBe(PermitStatus.ACTIVE)
      })
    })

    it('should search by multiple criteria (address OR permit number)', async () => {
      const permits = await prisma.permit.findMany({
        where: {
          OR: [
            {
              address: {
                contains: 'Jasper',
                mode: 'insensitive',
              },
            },
            {
              permitNumber: {
                contains: 'INT-003',
              },
            },
          ],
        },
      })

      expect(permits.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('Filtering and Sorting', () => {
    it('should filter by status', async () => {
      const activePermits = await prisma.permit.findMany({
        where: { status: PermitStatus.ACTIVE },
      })

      const completedPermits = await prisma.permit.findMany({
        where: { status: PermitStatus.COMPLETED },
      })

      expect(activePermits.length).toBeGreaterThan(0)
      expect(completedPermits.length).toBeGreaterThan(0)

      activePermits.forEach((permit) => {
        expect(permit.status).toBe(PermitStatus.ACTIVE)
      })

      completedPermits.forEach((permit) => {
        expect(permit.status).toBe(PermitStatus.COMPLETED)
      })
    })

    it('should sort by permit number', async () => {
      const permits = await prisma.permit.findMany({
        orderBy: { permitNumber: 'asc' },
      })

      expect(permits.length).toBeGreaterThan(0)

      for (let i = 1; i < permits.length; i++) {
        expect(permits[i].permitNumber >= permits[i - 1].permitNumber).toBe(true)
      }
    })

    it('should sort by created date', async () => {
      const permits = await prisma.permit.findMany({
        orderBy: { createdAt: 'desc' },
      })

      expect(permits.length).toBeGreaterThan(0)

      for (let i = 1; i < permits.length; i++) {
        expect(permits[i].createdAt.getTime() <= permits[i - 1].createdAt.getTime()).toBe(true)
      }
    })

    it('should paginate results', async () => {
      const pageSize = 3
      const page1 = await prisma.permit.findMany({
        take: pageSize,
        skip: 0,
        orderBy: { permitNumber: 'asc' },
      })

      const page2 = await prisma.permit.findMany({
        take: pageSize,
        skip: pageSize,
        orderBy: { permitNumber: 'asc' },
      })

      expect(page1.length).toBeLessThanOrEqual(pageSize)
      expect(page2.length).toBeLessThanOrEqual(pageSize)

      // Ensure no overlap
      const page1Numbers = page1.map((p) => p.permitNumber)
      const page2Numbers = page2.map((p) => p.permitNumber)
      const overlap = page1Numbers.filter((n) => page2Numbers.includes(n))
      expect(overlap.length).toBe(0)
    })
  })

  describe('Permit with Inspections', () => {
    it('should retrieve permit with all inspections', async () => {
      const permit = await prisma.permit.findUnique({
        where: { permitNumber: 'BP-2024-INT-001' },
      })

      expect(permit).toBeDefined()

      // Create inspections for this permit
      await prisma.permitInspection.createMany({
        data: [
          {
            permitId: permit!.id,
            scheduledDate: new Date('2024-06-01'),
            status: 'SCHEDULED',
          },
          {
            permitId: permit!.id,
            scheduledDate: new Date('2024-06-15'),
            status: 'SCHEDULED',
          },
        ],
      })

      const permitWithInspections = await prisma.permit.findUnique({
        where: { permitNumber: 'BP-2024-INT-001' },
        include: {
          inspections: {
            orderBy: { scheduledDate: 'asc' },
          },
        },
      })

      expect(permitWithInspections?.inspections).toHaveLength(2)
      expect(permitWithInspections?.inspections[0].permitId).toBe(permit!.id)
    })

    it('should find permits with pending inspections', async () => {
      const permits = await prisma.permit.findMany({
        where: {
          inspections: {
            some: {
              status: 'SCHEDULED',
            },
          },
        },
        include: {
          inspections: {
            where: {
              status: 'SCHEDULED',
            },
          },
        },
      })

      expect(permits.length).toBeGreaterThan(0)
      permits.forEach((permit) => {
        expect(permit.inspections.length).toBeGreaterThan(0)
        permit.inspections.forEach((inspection) => {
          expect(inspection.status).toBe('SCHEDULED')
        })
      })
    })
  })

  describe('Performance and Indexing', () => {
    it('should efficiently query by indexed permit number', async () => {
      const startTime = Date.now()

      const permit = await prisma.permit.findUnique({
        where: { permitNumber: 'BP-2024-INT-001' },
      })

      const endTime = Date.now()
      const queryTime = endTime - startTime

      expect(permit).toBeDefined()
      expect(queryTime).toBeLessThan(100) // Should be very fast with index
    })

    it('should efficiently query by indexed status', async () => {
      const startTime = Date.now()

      const permits = await prisma.permit.findMany({
        where: { status: PermitStatus.ACTIVE },
      })

      const endTime = Date.now()
      const queryTime = endTime - startTime

      expect(permits.length).toBeGreaterThan(0)
      expect(queryTime).toBeLessThan(100) // Should be fast with index
    })

    it('should efficiently query by GPS coordinates (composite index)', async () => {
      const startTime = Date.now()

      const permits = await prisma.permit.findMany({
        where: {
          AND: [
            { latitude: { gte: 53.54 } },
            { latitude: { lte: 53.56 } },
            { longitude: { gte: -113.5 } },
            { longitude: { lte: -113.49 } },
          ],
        },
      })

      const endTime = Date.now()
      const queryTime = endTime - startTime

      expect(permits.length).toBeGreaterThan(0)
      expect(queryTime).toBeLessThan(100) // Should be fast with composite index
    })
  })
})
