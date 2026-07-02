import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { conflictResolverService } from '../../src/services/conflict-resolver'
import { integrationDb as db } from '../../src/test-utils/integration-db.js'

/**
 * Integration tests for ConflictResolverService
 * These tests use the real database to verify end-to-end functionality
 */

describe.sequential('ConflictResolverService Integration Tests', () => {
  // Test data
  let testUserId: string
  let testInspectionId: string
  let testDeficiencyId: string

  beforeEach(async () => {
    // Create test user with unique ID
    const userId = `conflict-test-user-${Date.now()}-${Math.random()}`
    const user = await db.user.create({
      data: {
        id: userId,
        email: `conflict-test-${Date.now()}@example.com`,
        name: 'Test User',
        role: 'SCO',
      },
    })
    testUserId = user.id

    // Create test inspection with unique ID
    const inspectionId = `conflict-test-inspection-${Date.now()}-${Math.random()}`
    const inspection = await db.permitInspection.create({
      data: {
        id: inspectionId,
        scheduledDate: new Date(),
        status: 'SCHEDULED',
        etag: 'etag-initial',
      },
    })
    testInspectionId = inspection.id

    // Create test deficiency with unique clientId
    const deficiency = await db.deficiency.create({
      data: {
        clientId: `conflict-client-${Date.now()}-${Math.random()}`,
        inspectionId: testInspectionId,
        createdById: testUserId,
        description: 'Test deficiency',
        severity: 'MAJOR',
        status: 'OPEN',
        etag: 'etag-initial',
      },
    })
    testDeficiencyId = deficiency.id
  })

  afterEach(async () => {
    // Clean up conflicts first (before deleting entities they reference)
    // Use a more comprehensive cleanup to ensure no conflicts remain
    await db.syncConflict.deleteMany({
      where: {
        OR: [
          { entityId: testInspectionId || '' },
          { entityId: testDeficiencyId || '' },
          { entityId: { contains: 'permit-123' } }, // For permit conflicts
          { entityId: { contains: 'insp-2' } }, // For test conflicts
          { entityId: { contains: 'conflict-test' } }, // For any test conflicts
        ],
      },
    })

    // Clean up only the specific test data we created
    if (testDeficiencyId) {
      await db.photo.deleteMany({ where: { deficiencyId: testDeficiencyId } })
      await db.deficiency.deleteMany({
        where: { id: testDeficiencyId },
      })
    }
    if (testInspectionId) {
      await db.permitInspection.deleteMany({
        where: { id: testInspectionId },
      })
    }
    if (testUserId) {
      await db.user.deleteMany({
        where: { id: testUserId },
      })
    }
  })

  describe('detectConflict', () => {
    it('should detect conflict when ETags do not match for inspection', async () => {
      // Update inspection ETag
      await db.permitInspection.update({
        where: { id: testInspectionId },
        data: { etag: 'etag-updated' },
      })

      const hasConflict = await conflictResolverService.detectConflict(
        'inspection',
        testInspectionId,
        'etag-initial',
      )

      expect(hasConflict).toBe(true)
    })

    it('should not detect conflict when ETags match for inspection', async () => {
      const hasConflict = await conflictResolverService.detectConflict(
        'inspection',
        testInspectionId,
        'etag-initial',
      )

      expect(hasConflict).toBe(false)
    })

    it('should detect conflict when ETags do not match for deficiency', async () => {
      // Update deficiency ETag
      await db.deficiency.update({
        where: { id: testDeficiencyId },
        data: { etag: 'etag-updated' },
      })

      const hasConflict = await conflictResolverService.detectConflict(
        'deficiency',
        testDeficiencyId,
        'etag-initial',
      )

      expect(hasConflict).toBe(true)
    })

    it('should not detect conflict when ETags match for deficiency', async () => {
      const hasConflict = await conflictResolverService.detectConflict(
        'deficiency',
        testDeficiencyId,
        'etag-initial',
      )

      expect(hasConflict).toBe(false)
    })
  })

  describe('logConflict', () => {
    it('should log conflict to database with FIELD_WINS resolution', async () => {
      const conflictData = {
        entityType: 'inspection',
        entityId: testInspectionId,
        clientVersion: { status: 'COMPLETED', notes: 'Field notes' },
        serverVersion: { status: 'IN_PROGRESS', notes: 'Server notes' },
      }

      const result = await conflictResolverService.logConflict(conflictData)

      expect(result.id).toBeDefined()
      expect(result.entityType).toBe('inspection')
      expect(result.entityId).toBe(testInspectionId)
      expect(result.resolution).toBe('FIELD_WINS')
      expect(result.resolvedAt).toBeInstanceOf(Date)

      // Verify conflict was saved to database
      const savedConflict = await db.syncConflict.findUnique({
        where: { id: result.id },
      })

      expect(savedConflict).toBeDefined()
      expect(savedConflict?.entityType).toBe('inspection')
      expect(savedConflict?.resolution).toBe('FIELD_WINS')
    })

    it('should log conflict with SERVER_WINS resolution for permit', async () => {
      const conflictData = {
        entityType: 'permit',
        entityId: 'permit-123',
        clientVersion: { address: 'Old Address' },
        serverVersion: { address: 'New Address' },
      }

      const result = await conflictResolverService.logConflict(conflictData)

      expect(result.resolution).toBe('SERVER_WINS')

      // Verify in database
      const savedConflict = await db.syncConflict.findUnique({
        where: { id: result.id },
      })

      expect(savedConflict?.resolution).toBe('SERVER_WINS')
    })
  })

  describe('resolveConflict', () => {
    it('should resolve conflict with field data winning for inspection', async () => {
      const conflictData = {
        entityType: 'inspection',
        entityId: testInspectionId,
        clientVersion: { status: 'COMPLETED', notes: 'Field notes' },
        serverVersion: { status: 'IN_PROGRESS', notes: 'Server notes' },
      }

      const result = await conflictResolverService.resolveConflict(conflictData)

      // Should return client version (field wins)
      expect(result).toEqual(conflictData.clientVersion)

      // Verify conflict was logged
      const conflicts = await db.syncConflict.findMany({
        where: {
          entityType: 'inspection',
          entityId: testInspectionId,
        },
      })

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].resolution).toBe('FIELD_WINS')
    })

    it('should resolve conflict with server data winning for permit', async () => {
      const conflictData = {
        entityType: 'permit',
        entityId: 'permit-123',
        clientVersion: { address: 'Old Address' },
        serverVersion: { address: 'New Address' },
      }

      const result = await conflictResolverService.resolveConflict(conflictData)

      // Should return server version (server wins)
      expect(result).toEqual(conflictData.serverVersion)

      // Verify conflict was logged
      const conflicts = await db.syncConflict.findMany({
        where: {
          entityType: 'permit',
          entityId: 'permit-123',
        },
      })

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].resolution).toBe('SERVER_WINS')
    })
  })

  describe('getConflictsByEntity', () => {
    it('should retrieve all conflicts for a specific entity', async () => {
      // Create multiple conflicts for the same inspection
      await conflictResolverService.logConflict({
        entityType: 'inspection',
        entityId: testInspectionId,
        clientVersion: { status: 'COMPLETED' },
        serverVersion: { status: 'IN_PROGRESS' },
      })

      await conflictResolverService.logConflict({
        entityType: 'inspection',
        entityId: testInspectionId,
        clientVersion: { notes: 'Field notes' },
        serverVersion: { notes: 'Server notes' },
      })

      const conflicts = await conflictResolverService.getConflictsByEntity(
        'inspection',
        testInspectionId,
      )

      expect(conflicts).toHaveLength(2)
      expect(conflicts[0].entityType).toBe('inspection')
      expect(conflicts[0].entityId).toBe(testInspectionId)
      expect(conflicts[1].entityType).toBe('inspection')
      expect(conflicts[1].entityId).toBe(testInspectionId)
    })

    it('should return empty array when no conflicts exist', async () => {
      const conflicts = await conflictResolverService.getConflictsByEntity(
        'inspection',
        'non-existent-id',
      )

      expect(conflicts).toEqual([])
    })
  })

  describe('getAllConflicts', () => {
    it('should retrieve all conflicts', async () => {
      // Create conflicts for different entities
      await conflictResolverService.logConflict({
        entityType: 'inspection',
        entityId: testInspectionId,
        clientVersion: { status: 'COMPLETED' },
        serverVersion: { status: 'IN_PROGRESS' },
      })

      await conflictResolverService.logConflict({
        entityType: 'deficiency',
        entityId: testDeficiencyId,
        clientVersion: { description: 'Field description' },
        serverVersion: { description: 'Server description' },
      })

      const conflicts = await conflictResolverService.getAllConflicts()

      expect(conflicts.length).toBeGreaterThanOrEqual(2)
    })

    it('should filter conflicts by entity type', async () => {
      // Create conflicts for different entity types
      await conflictResolverService.logConflict({
        entityType: 'inspection',
        entityId: testInspectionId,
        clientVersion: { status: 'COMPLETED' },
        serverVersion: { status: 'IN_PROGRESS' },
      })

      await conflictResolverService.logConflict({
        entityType: 'deficiency',
        entityId: testDeficiencyId,
        clientVersion: { description: 'Field description' },
        serverVersion: { description: 'Server description' },
      })

      const inspectionConflicts = await conflictResolverService.getAllConflicts({
        entityType: 'inspection',
      })

      expect(inspectionConflicts.every((c) => c.entityType === 'inspection')).toBe(true)
    })

    it('should filter conflicts by resolution', async () => {
      // Create conflicts with different resolutions
      await conflictResolverService.logConflict({
        entityType: 'inspection',
        entityId: testInspectionId,
        clientVersion: { status: 'COMPLETED' },
        serverVersion: { status: 'IN_PROGRESS' },
      })

      await conflictResolverService.logConflict({
        entityType: 'permit',
        entityId: 'permit-123',
        clientVersion: { address: 'Old' },
        serverVersion: { address: 'New' },
      })

      const fieldWinsConflicts = await conflictResolverService.getAllConflicts({
        resolution: 'FIELD_WINS',
      })

      expect(fieldWinsConflicts.every((c) => c.resolution === 'FIELD_WINS')).toBe(true)
    })

    it('should filter conflicts by date range', async () => {
      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

      await conflictResolverService.logConflict({
        entityType: 'inspection',
        entityId: testInspectionId,
        clientVersion: { status: 'COMPLETED' },
        serverVersion: { status: 'IN_PROGRESS' },
      })

      const conflicts = await conflictResolverService.getAllConflicts({
        startDate: yesterday,
        endDate: tomorrow,
      })

      expect(conflicts.length).toBeGreaterThan(0)
      conflicts.forEach((conflict) => {
        expect(conflict.resolvedAt.getTime()).toBeGreaterThanOrEqual(yesterday.getTime())
        expect(conflict.resolvedAt.getTime()).toBeLessThanOrEqual(tomorrow.getTime())
      })
    })
  })

  describe('getConflictStats', () => {
    it('should return conflict statistics', async () => {
      // Create conflicts with different types and resolutions
      await conflictResolverService.logConflict({
        entityType: 'inspection',
        entityId: testInspectionId,
        clientVersion: { status: 'COMPLETED' },
        serverVersion: { status: 'IN_PROGRESS' },
      })

      await conflictResolverService.logConflict({
        entityType: 'inspection',
        entityId: 'insp-2',
        clientVersion: { notes: 'Field' },
        serverVersion: { notes: 'Server' },
      })

      await conflictResolverService.logConflict({
        entityType: 'deficiency',
        entityId: testDeficiencyId,
        clientVersion: { description: 'Field' },
        serverVersion: { description: 'Server' },
      })

      await conflictResolverService.logConflict({
        entityType: 'permit',
        entityId: 'permit-123',
        clientVersion: { address: 'Old' },
        serverVersion: { address: 'New' },
      })

      const stats = await conflictResolverService.getConflictStats()

      expect(stats.total).toBeGreaterThanOrEqual(4)
      expect(stats.byResolution['FIELD_WINS']).toBeGreaterThanOrEqual(3)
      expect(stats.byResolution['SERVER_WINS']).toBeGreaterThanOrEqual(1)
      expect(stats.byEntityType['inspection']).toBeGreaterThanOrEqual(2)
      expect(stats.byEntityType['deficiency']).toBeGreaterThanOrEqual(1)
      expect(stats.byEntityType['permit']).toBeGreaterThanOrEqual(1)
    })

    it('should return zero stats when no conflicts exist', async () => {
      const stats = await conflictResolverService.getConflictStats()

      expect(stats.total).toBe(0)
      expect(stats.byResolution).toEqual({})
      expect(stats.byEntityType).toEqual({})
    })
  })

  describe('end-to-end conflict resolution workflow', () => {
    it('should handle complete conflict detection and resolution workflow', async () => {
      // Step 1: Update inspection on server (simulating concurrent modification)
      await db.permitInspection.update({
        where: { id: testInspectionId },
        data: {
          status: 'IN_PROGRESS',
          etag: 'etag-server-updated',
        },
      })

      // Step 2: Detect conflict (client has old ETag)
      const hasConflict = await conflictResolverService.detectConflict(
        'inspection',
        testInspectionId,
        'etag-initial',
      )

      expect(hasConflict).toBe(true)

      // Step 3: Resolve conflict (field data wins for inspections)
      const clientVersion = { status: 'COMPLETED', notes: 'Inspection completed in field' }
      const serverVersion = { status: 'IN_PROGRESS', notes: 'Server notes' }

      const resolvedData = await conflictResolverService.resolveConflict({
        entityType: 'inspection',
        entityId: testInspectionId,
        clientVersion,
        serverVersion,
      })

      // Should return client version (field wins)
      expect(resolvedData).toEqual(clientVersion)

      // Step 4: Verify conflict was logged
      const conflicts = await conflictResolverService.getConflictsByEntity(
        'inspection',
        testInspectionId,
      )

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].resolution).toBe('FIELD_WINS')
      expect(conflicts[0].clientVersion).toEqual(clientVersion)
      expect(conflicts[0].serverVersion).toEqual(serverVersion)

      // Step 5: Verify stats
      const stats = await conflictResolverService.getConflictStats()

      expect(stats.total).toBeGreaterThanOrEqual(1)
      expect(stats.byResolution['FIELD_WINS']).toBeGreaterThanOrEqual(1)
      expect(stats.byEntityType['inspection']).toBeGreaterThanOrEqual(1)
    })
  })
})
