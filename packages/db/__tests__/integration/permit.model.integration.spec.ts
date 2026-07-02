/**
 * Unit Tests for Permit Model (M4-S1)
 *
 * Tests the Permit database schema including:
 * - Model creation and field validation
 * - GPS coordinate storage
 * - Indexes for search optimization
 * - Relationships with PermitInspection
 * - Status transitions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PrismaClient, PermitStatus } from '@prisma/client'

const prisma = new PrismaClient()

describe('Permit Model (M4-S1)', () => {
  // Clean up after each test
  afterEach(async () => {
    await prisma.permit.deleteMany()
  })

  describe('Model Creation', () => {
    it('should create a permit with all required fields', async () => {
      const permit = await prisma.permit.create({
        data: {
          permitNumber: 'BP-2024-TEST-001',
          address: '123 Test Street, Edmonton, AB T5J 1A1',
          scope: 'New Construction',
          status: PermitStatus.ACTIVE,
        },
      })

      expect(permit.id).toBeDefined()
      expect(permit.permitNumber).toBe('BP-2024-TEST-001')
      expect(permit.address).toBe('123 Test Street, Edmonton, AB T5J 1A1')
      expect(permit.scope).toBe('New Construction')
      expect(permit.status).toBe(PermitStatus.ACTIVE)
      expect(permit.createdAt).toBeInstanceOf(Date)
      expect(permit.updatedAt).toBeInstanceOf(Date)
    })

    it('should create a permit with GPS coordinates', async () => {
      const permit = await prisma.permit.create({
        data: {
          permitNumber: 'BP-2024-TEST-002',
          address: '456 GPS Avenue, Edmonton, AB T5J 2B2',
          scope: 'Renovation',
          status: PermitStatus.ACTIVE,
          latitude: 53.5461,
          longitude: -113.4938,
        },
      })

      expect(permit.latitude).toBe(53.5461)
      expect(permit.longitude).toBe(-113.4938)
    })

    it('should create a permit with legal land description', async () => {
      const permit = await prisma.permit.create({
        data: {
          permitNumber: 'BP-2024-TEST-003',
          address: '789 Legal Lane, Edmonton, AB T5J 3C3',
          legalLandDesc: 'Plan 1234AB Block 5 Lot 12',
          scope: 'Addition',
          status: PermitStatus.ACTIVE,
        },
      })

      expect(permit.legalLandDesc).toBe('Plan 1234AB Block 5 Lot 12')
    })

    it('should create a permit without optional fields', async () => {
      const permit = await prisma.permit.create({
        data: {
          permitNumber: 'BP-2024-TEST-004',
          address: '321 Minimal Street, Edmonton, AB T5J 4D4',
          scope: 'Fence Installation',
          status: PermitStatus.ACTIVE,
        },
      })

      expect(permit.legalLandDesc).toBeNull()
      expect(permit.latitude).toBeNull()
      expect(permit.longitude).toBeNull()
    })
  })

  describe('Unique Constraints', () => {
    it('should enforce unique permit number', async () => {
      await prisma.permit.create({
        data: {
          permitNumber: 'BP-2024-UNIQUE-001',
          address: '111 Unique Street, Edmonton, AB T5J 5E5',
          scope: 'Test',
          status: PermitStatus.ACTIVE,
        },
      })

      await expect(
        prisma.permit.create({
          data: {
            permitNumber: 'BP-2024-UNIQUE-001', // Duplicate
            address: '222 Different Street, Edmonton, AB T5J 6F6',
            scope: 'Test',
            status: PermitStatus.ACTIVE,
          },
        }),
      ).rejects.toThrow()
    })
  })

  describe('Permit Status', () => {
    it('should support all permit statuses', async () => {
      const statuses = [
        PermitStatus.ACTIVE,
        PermitStatus.COMPLETED,
        PermitStatus.CANCELLED,
        PermitStatus.EXPIRED,
      ]

      for (const status of statuses) {
        const permit = await prisma.permit.create({
          data: {
            permitNumber: `BP-2024-STATUS-${status}`,
            address: `${status} Street, Edmonton, AB`,
            scope: 'Test',
            status,
          },
        })

        expect(permit.status).toBe(status)
      }
    })

    it('should default to ACTIVE status', async () => {
      const permit = await prisma.permit.create({
        data: {
          permitNumber: 'BP-2024-DEFAULT-001',
          address: 'Default Street, Edmonton, AB',
          scope: 'Test',
        },
      })

      expect(permit.status).toBe(PermitStatus.ACTIVE)
    })

    it('should allow status transitions', async () => {
      const permit = await prisma.permit.create({
        data: {
          permitNumber: 'BP-2024-TRANSITION-001',
          address: 'Transition Street, Edmonton, AB',
          scope: 'Test',
          status: PermitStatus.ACTIVE,
        },
      })

      const updated = await prisma.permit.update({
        where: { id: permit.id },
        data: { status: PermitStatus.COMPLETED },
      })

      expect(updated.status).toBe(PermitStatus.COMPLETED)
    })
  })

  describe('GPS Coordinates', () => {
    it('should store GPS coordinates as Float', async () => {
      const permit = await prisma.permit.create({
        data: {
          permitNumber: 'BP-2024-GPS-001',
          address: 'GPS Test Street, Edmonton, AB',
          scope: 'Test',
          status: PermitStatus.ACTIVE,
          latitude: 53.123456789,
          longitude: -113.987654321,
        },
      })

      expect(typeof permit.latitude).toBe('number')
      expect(typeof permit.longitude).toBe('number')
      expect(permit.latitude).toBeCloseTo(53.123456789, 8)
      expect(permit.longitude).toBeCloseTo(-113.987654321, 8)
    })

    it('should handle null GPS coordinates', async () => {
      const permit = await prisma.permit.create({
        data: {
          permitNumber: 'BP-2024-GPS-002',
          address: 'No GPS Street, Edmonton, AB',
          scope: 'Test',
          status: PermitStatus.ACTIVE,
          latitude: null,
          longitude: null,
        },
      })

      expect(permit.latitude).toBeNull()
      expect(permit.longitude).toBeNull()
    })

    it('should allow partial GPS coordinates (latitude only)', async () => {
      const permit = await prisma.permit.create({
        data: {
          permitNumber: 'BP-2024-GPS-003',
          address: 'Partial GPS Street, Edmonton, AB',
          scope: 'Test',
          status: PermitStatus.ACTIVE,
          latitude: 53.5461,
        },
      })

      expect(permit.latitude).toBe(53.5461)
      expect(permit.longitude).toBeNull()
    })
  })

  describe('Search and Indexing', () => {
    beforeEach(async () => {
      // Create test permits for search
      await prisma.permit.createMany({
        data: [
          {
            permitNumber: 'BP-2024-SEARCH-001',
            address: '100 Jasper Avenue, Edmonton, AB',
            scope: 'Commercial',
            status: PermitStatus.ACTIVE,
            latitude: 53.5461,
            longitude: -113.4938,
          },
          {
            permitNumber: 'BP-2024-SEARCH-002',
            address: '200 Whyte Avenue, Edmonton, AB',
            scope: 'Residential',
            status: PermitStatus.ACTIVE,
            latitude: 53.5189,
            longitude: -113.5189,
          },
          {
            permitNumber: 'BP-2024-SEARCH-003',
            address: '300 Calgary Trail, Edmonton, AB',
            scope: 'Industrial',
            status: PermitStatus.COMPLETED,
            latitude: 53.4789,
            longitude: -113.4889,
          },
        ],
      })
    })

    it('should find permit by permit number', async () => {
      const permit = await prisma.permit.findUnique({
        where: { permitNumber: 'BP-2024-SEARCH-001' },
      })

      expect(permit).toBeDefined()
      expect(permit?.permitNumber).toBe('BP-2024-SEARCH-001')
    })

    it('should find permits by status', async () => {
      const activePermits = await prisma.permit.findMany({
        where: { status: PermitStatus.ACTIVE },
      })

      expect(activePermits.length).toBeGreaterThanOrEqual(2)
      activePermits.forEach((permit) => {
        expect(permit.status).toBe(PermitStatus.ACTIVE)
      })
    })

    it('should find permits by address (partial match)', async () => {
      const permits = await prisma.permit.findMany({
        where: {
          address: {
            contains: 'Jasper',
            mode: 'insensitive',
          },
        },
      })

      expect(permits.length).toBeGreaterThanOrEqual(1)
      expect(permits[0].address).toContain('Jasper')
    })

    it('should find permits within GPS bounding box', async () => {
      // Edmonton downtown area bounding box
      const minLat = 53.5
      const maxLat = 53.6
      const minLon = -113.6
      const maxLon = -113.4

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

      expect(permits.length).toBeGreaterThanOrEqual(1)
      permits.forEach((permit) => {
        if (permit.latitude && permit.longitude) {
          expect(permit.latitude).toBeGreaterThanOrEqual(minLat)
          expect(permit.latitude).toBeLessThanOrEqual(maxLat)
          expect(permit.longitude).toBeGreaterThanOrEqual(minLon)
          expect(permit.longitude).toBeLessThanOrEqual(maxLon)
        }
      })
    })
  })

  describe('Relationships', () => {
    it('should link permit to inspections', async () => {
      const permit = await prisma.permit.create({
        data: {
          permitNumber: 'BP-2024-REL-001',
          address: 'Relationship Street, Edmonton, AB',
          scope: 'Test',
          status: PermitStatus.ACTIVE,
        },
      })

      const inspection = await prisma.permitInspection.create({
        data: {
          permitId: permit.id,
          scheduledDate: new Date('2024-06-01'),
          status: 'SCHEDULED',
        },
      })

      const permitWithInspections = await prisma.permit.findUnique({
        where: { id: permit.id },
        include: { inspections: true },
      })

      expect(permitWithInspections?.inspections).toHaveLength(1)
      expect(permitWithInspections?.inspections[0].id).toBe(inspection.id)
    })

    it('should support multiple inspections per permit', async () => {
      const permit = await prisma.permit.create({
        data: {
          permitNumber: 'BP-2024-REL-002',
          address: 'Multiple Inspections Street, Edmonton, AB',
          scope: 'Test',
          status: PermitStatus.ACTIVE,
        },
      })

      await prisma.permitInspection.createMany({
        data: [
          {
            permitId: permit.id,
            scheduledDate: new Date('2024-06-01'),
            status: 'SCHEDULED',
          },
          {
            permitId: permit.id,
            scheduledDate: new Date('2024-06-15'),
            status: 'SCHEDULED',
          },
          {
            permitId: permit.id,
            scheduledDate: new Date('2024-07-01'),
            status: 'SCHEDULED',
          },
        ],
      })

      const permitWithInspections = await prisma.permit.findUnique({
        where: { id: permit.id },
        include: { inspections: true },
      })

      expect(permitWithInspections?.inspections).toHaveLength(3)
    })
  })

  describe('Timestamps', () => {
    it('should automatically set createdAt and updatedAt', async () => {
      const permit = await prisma.permit.create({
        data: {
          permitNumber: 'BP-2024-TIME-001',
          address: 'Timestamp Street, Edmonton, AB',
          scope: 'Test',
          status: PermitStatus.ACTIVE,
        },
      })

      expect(permit.createdAt).toBeInstanceOf(Date)
      expect(permit.updatedAt).toBeInstanceOf(Date)
      expect(permit.createdAt.getTime()).toBeLessThanOrEqual(permit.updatedAt.getTime())
    })

    it('should update updatedAt on modification', async () => {
      const permit = await prisma.permit.create({
        data: {
          permitNumber: 'BP-2024-TIME-002',
          address: 'Update Timestamp Street, Edmonton, AB',
          scope: 'Test',
          status: PermitStatus.ACTIVE,
        },
      })

      const originalUpdatedAt = permit.updatedAt

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 100))

      const updated = await prisma.permit.update({
        where: { id: permit.id },
        data: { scope: 'Updated Scope' },
      })

      expect(updated.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })
  })

  describe('Data Validation', () => {
    it('should require permitNumber', async () => {
      await expect(
        prisma.permit.create({
          // @ts-expect-error - Testing missing required field
          data: {
            address: 'Missing Permit Number Street, Edmonton, AB',
            scope: 'Test',
            status: PermitStatus.ACTIVE,
          },
        }),
      ).rejects.toThrow()
    })

    it('should require address', async () => {
      await expect(
        prisma.permit.create({
          // @ts-expect-error - Testing missing required field
          data: {
            permitNumber: 'BP-2024-VAL-001',
            scope: 'Test',
            status: PermitStatus.ACTIVE,
          },
        }),
      ).rejects.toThrow()
    })

    it('should require scope', async () => {
      await expect(
        prisma.permit.create({
          // @ts-expect-error - Testing missing required field
          data: {
            permitNumber: 'BP-2024-VAL-002',
            address: 'Missing Scope Street, Edmonton, AB',
            status: PermitStatus.ACTIVE,
          },
        }),
      ).rejects.toThrow()
    })
  })
})
