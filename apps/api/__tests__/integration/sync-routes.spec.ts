import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest'
import type { SyncMutation } from '@codecomply/validators'

// Import db before mocking to ensure it's available
import { integrationDb as db } from '../../src/test-utils/integration-db.js'

// Generate unique test user ID for this test suite
const TEST_USER_ID = `sync-test-user-${Date.now()}-${Math.random()}`

// Mock auth middleware to inject userId - but do this AFTER importing db
vi.mock('../../src/middleware/auth.middleware.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/middleware/auth.middleware.js')>()
  return {
    ...actual,
    authMiddleware: vi.fn(async (c, next) => {
      c.set('userId', TEST_USER_ID)
      await next()
    }),
  }
})

// Import app after mocking middleware
const { app } = await import('../../src/app.js')

describe.sequential('Sync Routes Integration Tests', () => {
  let testUserId: string
  let testInspectionId: string

  beforeAll(async () => {
    // Create test user with unique ID
    const user = await db.user.create({
      data: {
        id: TEST_USER_ID,
        email: `sync-test-${Date.now()}@example.com`,
        name: 'Test Sync User',
        role: 'SCO',
      },
    })
    testUserId = user.id

    // Create test inspection with unique ID
    const inspectionId = `sync-test-inspection-${Date.now()}-${Math.random()}`
    const inspection = await db.permitInspection.create({
      data: {
        id: inspectionId,
        scheduledDate: new Date(),
        status: 'SCHEDULED',
      },
    })
    testInspectionId = inspection.id

    // Create inspection schedule
    await db.inspectionSchedule.create({
      data: {
        inspectionId: testInspectionId,
        assignedToId: testUserId,
      },
    })
  })

  afterAll(async () => {
    // Scoped cleanup only — avoids racing parallel integration files that share `integrationDb`.
    await db.photo.deleteMany({ where: { inspectionId: testInspectionId } })
    await db.deficiency.deleteMany({ where: { inspectionId: testInspectionId } })
    await db.inspectionSchedule.deleteMany({ where: { inspectionId: testInspectionId } })
    await db.permitInspection.deleteMany({ where: { id: testInspectionId } })
    await db.user.deleteMany({ where: { id: testUserId } })
  })

  beforeEach(async () => {
    await db.photo.deleteMany({ where: { inspectionId: testInspectionId } })
    await db.deficiency.deleteMany({ where: { inspectionId: testInspectionId } })
  })

  describe('POST /api/sync/push', () => {
    it('should process valid mutations successfully', async () => {
      const mutations: SyncMutation[] = [
        {
          clientId: crypto.randomUUID(),
          entity: 'deficiency',
          operation: 'create',
          payload: {
            inspectionId: testInspectionId,
            description: 'Test deficiency from integration test',
            severity: 'MAJOR',
            location: 'Room 101',
          },
          timestamp: new Date().toISOString(),
        },
      ]

      const res = await app.request('/api/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mutations }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.results).toHaveLength(1)
      expect(data.results[0].success).toBe(true)
      expect(data.results[0].serverId).toBeDefined()
      expect(data.timestamp).toBeDefined()

      // Verify deficiency was created in database
      const deficiency = await db.deficiency.findUnique({
        where: { clientId: mutations[0].clientId },
      })
      expect(deficiency).toBeDefined()
      expect(deficiency?.description).toBe('Test deficiency from integration test')
    })

    it('should handle duplicate clientIds (deduplication)', async () => {
      const clientId = crypto.randomUUID()

      // Create deficiency first time
      const mutations1: SyncMutation[] = [
        {
          clientId,
          entity: 'deficiency',
          operation: 'create',
          payload: {
            inspectionId: testInspectionId,
            description: 'First submission',
            severity: 'MAJOR',
          },
          timestamp: new Date().toISOString(),
        },
      ]

      const res1 = await app.request('/api/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mutations: mutations1 }),
      })

      expect(res1.status).toBe(200)
      const data1 = await res1.json()
      const serverId = data1.results[0].serverId

      // Try to create same deficiency again (duplicate clientId)
      const mutations2: SyncMutation[] = [
        {
          clientId,
          entity: 'deficiency',
          operation: 'create',
          payload: {
            inspectionId: testInspectionId,
            description: 'Second submission (should be ignored)',
            severity: 'CRITICAL',
          },
          timestamp: new Date().toISOString(),
        },
      ]

      const res2 = await app.request('/api/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mutations: mutations2 }),
      })

      expect(res2.status).toBe(200)
      const data2 = await res2.json()
      expect(data2.results[0].success).toBe(true)
      expect(data2.results[0].serverId).toBe(serverId) // Same server ID

      // Verify only one deficiency exists
      const deficiencies = await db.deficiency.findMany({
        where: { clientId },
      })
      expect(deficiencies).toHaveLength(1)
      expect(deficiencies[0].description).toBe('First submission') // Original description
    })

    it('should handle batch mutations', async () => {
      const mutations: SyncMutation[] = [
        {
          clientId: crypto.randomUUID(),
          entity: 'deficiency',
          operation: 'create',
          payload: {
            inspectionId: testInspectionId,
            description: 'Deficiency 1',
            severity: 'MINOR',
          },
          timestamp: new Date().toISOString(),
        },
        {
          clientId: crypto.randomUUID(),
          entity: 'deficiency',
          operation: 'create',
          payload: {
            inspectionId: testInspectionId,
            description: 'Deficiency 2',
            severity: 'MAJOR',
          },
          timestamp: new Date().toISOString(),
        },
        {
          clientId: crypto.randomUUID(),
          entity: 'deficiency',
          operation: 'create',
          payload: {
            inspectionId: testInspectionId,
            description: 'Deficiency 3',
            severity: 'CRITICAL',
          },
          timestamp: new Date().toISOString(),
        },
      ]

      const res = await app.request('/api/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mutations }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.results).toHaveLength(3)
      expect(data.results.every((r: any) => r.success)).toBe(true)

      // Verify all deficiencies were created
      const deficiencies = await db.deficiency.findMany({
        where: {
          inspectionId: testInspectionId,
        },
      })
      expect(deficiencies).toHaveLength(3)
    })

    it('should detect conflicts with ETag mismatch', async () => {
      // Create a deficiency first
      const clientId = crypto.randomUUID()
      const deficiency = await db.deficiency.create({
        data: {
          clientId,
          inspectionId: testInspectionId,
          createdById: testUserId,
          description: 'Original description',
          severity: 'MAJOR',
          status: 'OPEN',
          etag: 'etag-original',
        },
      })

      // Try to update with wrong etag
      const mutations: SyncMutation[] = [
        {
          clientId,
          entity: 'deficiency',
          operation: 'update',
          payload: {
            description: 'Updated description',
            etag: 'etag-wrong',
          },
          timestamp: new Date().toISOString(),
        },
      ]

      const res = await app.request('/api/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mutations }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.results[0].success).toBe(false)
      expect(data.results[0].conflict).toBe(true)
      expect(data.results[0].error).toContain('Conflict')

      // Verify deficiency was not updated
      const unchanged = await db.deficiency.findUnique({
        where: { id: deficiency.id },
      })
      expect(unchanged?.description).toBe('Original description')
    })

    it('should return validation error for invalid payload', async () => {
      const res = await app.request('/api/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mutations: 'invalid' }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/sync/pull', () => {
    it('should return changes since timestamp', async () => {
      const now = new Date()
      const past = new Date(now.getTime() - 60000) // 1 minute ago

      // Create some deficiencies
      await db.deficiency.create({
        data: {
          clientId: crypto.randomUUID(),
          inspectionId: testInspectionId,
          createdById: testUserId,
          description: 'Old deficiency',
          severity: 'MAJOR',
          status: 'OPEN',
          syncedAt: past,
        },
      })

      await db.deficiency.create({
        data: {
          clientId: crypto.randomUUID(),
          inspectionId: testInspectionId,
          createdById: testUserId,
          description: 'New deficiency',
          severity: 'MINOR',
          status: 'OPEN',
          syncedAt: now,
        },
      })

      const res = await app.request(`/api/sync/pull?since=${past.toISOString()}&limit=100`, {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.changes).toBeDefined()
      expect(data.changes.length).toBeGreaterThan(0)
      expect(data.timestamp).toBeDefined()
      expect(data.hasMore).toBe(false)

      // Verify change structure
      const change = data.changes[0]
      expect(change.id).toBeDefined()
      expect(change.entity).toBe('deficiency')
      expect(change.operation).toBe('update')
      expect(change.data).toBeDefined()
      expect(change.timestamp).toBeDefined()
    })

    it('should return all changes if since is not provided', async () => {
      // Create deficiencies
      await db.deficiency.create({
        data: {
          clientId: crypto.randomUUID(),
          inspectionId: testInspectionId,
          createdById: testUserId,
          description: 'Deficiency 1',
          severity: 'MAJOR',
          status: 'OPEN',
          syncedAt: new Date(),
        },
      })

      await db.deficiency.create({
        data: {
          clientId: crypto.randomUUID(),
          inspectionId: testInspectionId,
          createdById: testUserId,
          description: 'Deficiency 2',
          severity: 'MINOR',
          status: 'OPEN',
          syncedAt: new Date(),
        },
      })

      const res = await app.request('/api/sync/pull', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.changes.length).toBeGreaterThanOrEqual(2)
    })

    it('should respect limit parameter', async () => {
      // Create many deficiencies
      for (let i = 0; i < 10; i++) {
        await db.deficiency.create({
          data: {
            clientId: crypto.randomUUID(),
            inspectionId: testInspectionId,
            createdById: testUserId,
            description: `Deficiency ${i}`,
            severity: 'MAJOR',
            status: 'OPEN',
            syncedAt: new Date(),
          },
        })
      }

      const res = await app.request('/api/sync/pull?limit=5', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.changes.length).toBeLessThanOrEqual(5)
      expect(data.hasMore).toBe(true)
    })

    it('should return empty array if no changes', async () => {
      const future = new Date(Date.now() + 60000) // 1 minute in future

      const res = await app.request(`/api/sync/pull?since=${future.toISOString()}`, {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.changes).toHaveLength(0)
      expect(data.hasMore).toBe(false)
    })
  })
})
