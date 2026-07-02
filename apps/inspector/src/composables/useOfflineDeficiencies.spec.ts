/**
 * Unit tests for useOfflineDeficiencies composable
 *
 * Tests all CRUD operations, dirty flag tracking, sync engine integration,
 * and priority handling for Stop Work orders and critical deficiencies.
 *
 * @see M3-S9 - Create Offline Storage Composables
 * @see testing-strategy.md - Testing Philosophy
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useOfflineDeficiencies } from './useOfflineDeficiencies'
import { db } from '@/lib/db/dexie'
import { syncEngine } from '@/lib/db/sync-engine'
import type { LocalDeficiency } from '@/lib/db/types'

// Mock dependencies
vi.mock('@/lib/db/dexie', () => {
  const permits = { clear: vi.fn().mockResolvedValue(undefined) }
  const checklistTemplateCache = { clear: vi.fn().mockResolvedValue(undefined) }
  const photos = {
    toCollection: vi.fn(() => ({
      modify: vi.fn().mockResolvedValue(0),
    })),
  }
  return {
    db: {
      deficiencies: {
        toArray: vi.fn(),
        where: vi.fn(),
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        update: vi.fn(),
        clear: vi.fn(),
      },
      permits,
      checklistTemplateCache,
      photos,
      transaction: vi.fn(async (...args: unknown[]) => {
        const scope = args[args.length - 1]
        if (typeof scope === 'function') await (scope as () => Promise<void>)()
      }),
    },
  }
})

vi.mock('@/lib/db/sync-engine', () => ({
  syncEngine: {
    queueMutation: vi.fn(),
  },
}))

describe('useOfflineDeficiencies', () => {
  // ─── Test Data ───────────────────────────────────────────────────────────

  const createMockDeficiency = (overrides?: Partial<LocalDeficiency>): LocalDeficiency => ({
    id: 'def-123',
    clientId: 'client-456',
    inspectionId: 'insp-789',
    createdById: 'user-101',
    description: 'Missing fire extinguisher',
    severity: 'MAJOR',
    status: 'OPEN',
    isStopWork: false,
    isUnsafe: false,
    createdAt: '2024-01-10T08:00:00Z',
    updatedAt: '2024-01-10T08:00:00Z',
    isDirty: false,
    ...overrides,
  })

  // ─── Setup & Teardown ────────────────────────────────────────────────────

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ─── getAll() Tests ──────────────────────────────────────────────────────

  describe('getAll', () => {
    it('should return all deficiencies', async () => {
      const mockDeficiencies = [
        createMockDeficiency({ id: 'def-1', createdAt: '2024-01-15T10:00:00Z' }),
        createMockDeficiency({ id: 'def-2', createdAt: '2024-01-16T10:00:00Z' }),
        createMockDeficiency({ id: 'def-3', createdAt: '2024-01-14T10:00:00Z' }),
      ]

      vi.mocked(db.deficiencies.toArray).mockResolvedValue(mockDeficiencies)

      const { getAll, deficiencies, isLoading } = useOfflineDeficiencies()

      expect(isLoading.value).toBe(false)

      const result = await getAll()

      // Should return sorted by created date (most recent first)
      expect(result).toHaveLength(3)
      expect(result[0].id).toBe('def-2') // 2024-01-16
      expect(result[1].id).toBe('def-1') // 2024-01-15
      expect(result[2].id).toBe('def-3') // 2024-01-14

      // Should update reactive state
      expect(deficiencies.value).toEqual(result)
      expect(isLoading.value).toBe(false)
    })

    it('should filter by status', async () => {
      const mockDeficiencies = [
        createMockDeficiency({ id: 'def-o', status: 'OPEN' }),
        createMockDeficiency({ id: 'def-c', status: 'CLOSED' }),
      ]

      vi.mocked(db.deficiencies.toArray).mockResolvedValue(mockDeficiencies)

      const { getAll } = useOfflineDeficiencies()

      const result = await getAll({ status: 'OPEN' })

      expect(db.deficiencies.toArray).toHaveBeenCalled()
      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('OPEN')
    })

    it('should filter by severity', async () => {
      const mockDeficiencies = [
        createMockDeficiency({ id: 'def-1', severity: 'MAJOR' }),
        createMockDeficiency({ id: 'def-2', severity: 'CRITICAL' }),
      ]

      vi.mocked(db.deficiencies.toArray).mockResolvedValue(mockDeficiencies)

      const { getAll } = useOfflineDeficiencies()

      const result = await getAll({ severity: 'CRITICAL' })

      expect(result).toHaveLength(1)
      expect(result[0].severity).toBe('CRITICAL')
    })

    it('should filter by inspectionId', async () => {
      const mockDeficiencies = [
        createMockDeficiency({ id: 'def-1', inspectionId: 'insp-a' }),
        createMockDeficiency({ id: 'def-2', inspectionId: 'insp-789' }),
      ]

      vi.mocked(db.deficiencies.toArray).mockResolvedValue(mockDeficiencies)

      const { getAll } = useOfflineDeficiencies()

      const result = await getAll({ inspectionId: 'insp-789' })

      expect(result).toHaveLength(1)
      expect(result[0].inspectionId).toBe('insp-789')
    })

    it('should AND multiple filters', async () => {
      const mockDeficiencies = [
        createMockDeficiency({
          id: 'def-1',
          inspectionId: 'insp-x',
          status: 'OPEN',
          severity: 'MAJOR',
        }),
        createMockDeficiency({
          id: 'def-2',
          inspectionId: 'insp-x',
          status: 'CLOSED',
          severity: 'CRITICAL',
        }),
        createMockDeficiency({
          id: 'def-3',
          inspectionId: 'insp-y',
          status: 'OPEN',
          severity: 'CRITICAL',
        }),
      ]

      vi.mocked(db.deficiencies.toArray).mockResolvedValue(mockDeficiencies)

      const { getAll } = useOfflineDeficiencies()

      const result = await getAll({
        inspectionId: 'insp-x',
        status: 'OPEN',
      })

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('def-1')
    })

    it('should filter by stopWorkOnly', async () => {
      const mockDeficiencies = [
        createMockDeficiency({ id: 'def-1', isStopWork: false }),
        createMockDeficiency({ id: 'def-2', isStopWork: true }),
      ]

      vi.mocked(db.deficiencies.toArray).mockResolvedValue(mockDeficiencies)

      const { getAll } = useOfflineDeficiencies()

      const result = await getAll({ stopWorkOnly: true })

      expect(result).toHaveLength(1)
      expect(result[0].isStopWork).toBe(true)
    })

    it('should filter by unsafeOnly (in-memory filter)', async () => {
      const mockDeficiencies = [
        createMockDeficiency({ id: 'def-1', isUnsafe: true }),
        createMockDeficiency({ id: 'def-2', isUnsafe: false }),
      ]

      vi.mocked(db.deficiencies.toArray).mockResolvedValue(mockDeficiencies)

      const { getAll } = useOfflineDeficiencies()

      const result = await getAll({ unsafeOnly: true })

      // Should only include unsafe deficiencies
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('def-1')
      expect(result[0].isUnsafe).toBe(true)
    })

    it('should handle errors gracefully', async () => {
      const mockError = new Error('Database error')

      vi.mocked(db.deficiencies.toArray).mockRejectedValue(mockError)

      const { getAll, error } = useOfflineDeficiencies()

      await expect(getAll()).rejects.toThrow('Database error')
      expect(error.value).toEqual(mockError)
    })
  })

  // ─── getById() Tests ─────────────────────────────────────────────────────

  describe('getById', () => {
    it('should return a single deficiency', async () => {
      const mockDeficiency = createMockDeficiency()

      vi.mocked(db.deficiencies.get).mockResolvedValue(mockDeficiency)

      const { getById } = useOfflineDeficiencies()

      const result = await getById('def-123')

      expect(db.deficiencies.get).toHaveBeenCalledWith('def-123')
      expect(result).toEqual(mockDeficiency)
    })

    it('should return null if deficiency not found', async () => {
      vi.mocked(db.deficiencies.get).mockResolvedValue(undefined)

      const { getById } = useOfflineDeficiencies()

      const result = await getById('non-existent')

      expect(result).toBeNull()
    })
  })

  // ─── getByInspectionId() Tests ───────────────────────────────────────────

  describe('getByInspectionId', () => {
    it('should return deficiencies for an inspection', async () => {
      const mockDeficiencies = [
        createMockDeficiency({ id: 'def-1', inspectionId: 'insp-789' }),
        createMockDeficiency({ id: 'def-2', inspectionId: 'insp-789' }),
      ]

      const mockWhere = {
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockDeficiencies),
        }),
      }

      vi.mocked(db.deficiencies.where).mockReturnValue(mockWhere as any)

      const { getByInspectionId } = useOfflineDeficiencies()

      const result = await getByInspectionId('insp-789')

      expect(db.deficiencies.where).toHaveBeenCalledWith('inspectionId')
      expect(mockWhere.equals).toHaveBeenCalledWith('insp-789')
      expect(result).toHaveLength(2)
    })
  })

  // ─── save() Tests ────────────────────────────────────────────────────────

  describe('save', () => {
    it('should create a new deficiency', async () => {
      const mockDeficiency = createMockDeficiency()

      vi.mocked(db.deficiencies.get).mockResolvedValue(undefined) // Not exists
      vi.mocked(db.deficiencies.put).mockResolvedValue('def-123')
      vi.mocked(syncEngine.queueMutation).mockResolvedValue('queue-123')

      const { save, deficiencies } = useOfflineDeficiencies()

      await save(mockDeficiency)

      // Should save to IndexedDB with isDirty=true
      expect(db.deficiencies.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'def-123',
          isDirty: true,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        }),
      )

      // Should queue for sync with normal priority (10)
      expect(syncEngine.queueMutation).toHaveBeenCalledWith(
        'deficiency.create',
        expect.objectContaining({
          clientId: 'client-456',
          id: 'def-123',
          isDirty: true,
        }),
        10, // Normal priority
      )

      // Should update reactive state
      expect(deficiencies.value).toHaveLength(1)
      expect(deficiencies.value[0].id).toBe('def-123')
    })

    it('should create Stop Work order with high priority', async () => {
      const mockDeficiency = createMockDeficiency({ isStopWork: true })

      vi.mocked(db.deficiencies.get).mockResolvedValue(undefined)
      vi.mocked(db.deficiencies.put).mockResolvedValue('def-123')
      vi.mocked(syncEngine.queueMutation).mockResolvedValue('queue-123')

      const { save } = useOfflineDeficiencies()

      await save(mockDeficiency)

      // Should queue with high priority (1)
      expect(syncEngine.queueMutation).toHaveBeenCalledWith(
        'deficiency.create',
        expect.anything(),
        1, // High priority for Stop Work
      )
    })

    it('should create critical deficiency with high priority', async () => {
      const mockDeficiency = createMockDeficiency({ severity: 'CRITICAL' })

      vi.mocked(db.deficiencies.get).mockResolvedValue(undefined)
      vi.mocked(db.deficiencies.put).mockResolvedValue('def-123')
      vi.mocked(syncEngine.queueMutation).mockResolvedValue('queue-123')

      const { save } = useOfflineDeficiencies()

      await save(mockDeficiency)

      // Should queue with high priority (1)
      expect(syncEngine.queueMutation).toHaveBeenCalledWith(
        'deficiency.create',
        expect.anything(),
        1, // High priority for CRITICAL
      )
    })

    it('should update an existing deficiency', async () => {
      const existingDeficiency = createMockDeficiency()
      const updatedDeficiency = createMockDeficiency({ status: 'VOC_SUBMITTED' })

      vi.mocked(db.deficiencies.get).mockResolvedValue(existingDeficiency)
      vi.mocked(db.deficiencies.put).mockResolvedValue('def-123')
      vi.mocked(syncEngine.queueMutation).mockResolvedValue('queue-123')

      const { save } = useOfflineDeficiencies()

      await save(updatedDeficiency)

      // Should queue for sync with update operation
      expect(syncEngine.queueMutation).toHaveBeenCalledWith(
        'deficiency.update',
        expect.objectContaining({
          clientId: 'client-456',
          id: 'def-123',
        }),
        10,
      )
    })

    it('should throw error if ID is missing', async () => {
      const invalidDeficiency = createMockDeficiency({ id: '' })

      const { save, error } = useOfflineDeficiencies()

      await expect(save(invalidDeficiency)).rejects.toThrow('Deficiency ID is required')
      expect(error.value?.message).toBe('Deficiency ID is required')
    })

    it('should throw error if clientId is missing', async () => {
      const invalidDeficiency = createMockDeficiency({ clientId: '' })

      const { save, error } = useOfflineDeficiencies()

      await expect(save(invalidDeficiency)).rejects.toThrow('Deficiency clientId is required')
      expect(error.value?.message).toBe('Deficiency clientId is required')
    })

    it('should throw error if inspectionId is missing', async () => {
      const invalidDeficiency = createMockDeficiency({ inspectionId: '' })

      const { save, error } = useOfflineDeficiencies()

      await expect(save(invalidDeficiency)).rejects.toThrow('Deficiency inspectionId is required')
      expect(error.value?.message).toBe('Deficiency inspectionId is required')
    })

    it('should throw error if description is empty', async () => {
      const invalidDeficiency = createMockDeficiency({ description: '   ' })

      const { save, error } = useOfflineDeficiencies()

      await expect(save(invalidDeficiency)).rejects.toThrow('Deficiency description is required')
      expect(error.value?.message).toBe('Deficiency description is required')
    })
  })

  // ─── delete() Tests ──────────────────────────────────────────────────────

  describe('delete', () => {
    it('should delete a deficiency and queue for sync if synced', async () => {
      const mockDeficiency = createMockDeficiency({ syncedAt: '2024-01-10T08:00:00Z' })

      vi.mocked(db.deficiencies.get).mockResolvedValue(mockDeficiency)
      vi.mocked(db.deficiencies.delete).mockResolvedValue()
      vi.mocked(syncEngine.queueMutation).mockResolvedValue('queue-123')

      const { delete: deleteDeficiency, deficiencies } = useOfflineDeficiencies()

      // Add deficiency to reactive state
      deficiencies.value = [mockDeficiency]

      await deleteDeficiency('def-123')

      expect(db.deficiencies.delete).toHaveBeenCalledWith('def-123')

      // Should queue deletion for sync
      expect(syncEngine.queueMutation).toHaveBeenCalledWith('deficiency.delete', {
        clientId: 'client-456',
        id: 'def-123',
      })

      // Should update reactive state
      expect(deficiencies.value).toHaveLength(0)
    })

    it('should delete a deficiency without queuing if not synced', async () => {
      const mockDeficiency = createMockDeficiency({ syncedAt: undefined })

      vi.mocked(db.deficiencies.get).mockResolvedValue(mockDeficiency)
      vi.mocked(db.deficiencies.delete).mockResolvedValue()

      const { delete: deleteDeficiency } = useOfflineDeficiencies()

      await deleteDeficiency('def-123')

      expect(db.deficiencies.delete).toHaveBeenCalledWith('def-123')

      // Should NOT queue for sync (never synced to server)
      expect(syncEngine.queueMutation).not.toHaveBeenCalled()
    })

    it('should throw error if deficiency not found', async () => {
      vi.mocked(db.deficiencies.get).mockResolvedValue(undefined)

      const { delete: deleteDeficiency, error } = useOfflineDeficiencies()

      await expect(deleteDeficiency('non-existent')).rejects.toThrow(
        'Deficiency non-existent not found',
      )
      expect(error.value?.message).toBe('Deficiency non-existent not found')
    })
  })

  // ─── markDirty() Tests ───────────────────────────────────────────────────

  describe('markDirty', () => {
    it('should mark a deficiency as dirty with normal priority', async () => {
      const mockDeficiency = createMockDeficiency({ isDirty: false })

      vi.mocked(db.deficiencies.get).mockResolvedValue(mockDeficiency)
      vi.mocked(db.deficiencies.update).mockResolvedValue(1)
      vi.mocked(syncEngine.queueMutation).mockResolvedValue('queue-123')

      const { markDirty, deficiencies } = useOfflineDeficiencies()

      // Add deficiency to reactive state
      deficiencies.value = [mockDeficiency]

      await markDirty('def-123')

      // Should update dirty flag
      expect(db.deficiencies.update).toHaveBeenCalledWith('def-123', {
        isDirty: true,
        updatedAt: expect.any(String),
      })

      // Should queue for sync with normal priority
      expect(syncEngine.queueMutation).toHaveBeenCalledWith(
        'deficiency.update',
        expect.objectContaining({
          clientId: 'client-456',
          id: 'def-123',
        }),
        10,
      )

      // Should update reactive state
      expect(deficiencies.value[0].isDirty).toBe(true)
    })

    it('should mark Stop Work deficiency as dirty with high priority', async () => {
      const mockDeficiency = createMockDeficiency({ isDirty: false, isStopWork: true })

      vi.mocked(db.deficiencies.get).mockResolvedValue(mockDeficiency)
      vi.mocked(db.deficiencies.update).mockResolvedValue(1)
      vi.mocked(syncEngine.queueMutation).mockResolvedValue('queue-123')

      const { markDirty } = useOfflineDeficiencies()

      await markDirty('def-123')

      // Should queue with high priority
      expect(syncEngine.queueMutation).toHaveBeenCalledWith(
        'deficiency.update',
        expect.anything(),
        1, // High priority
      )
    })

    it('should throw error if deficiency not found', async () => {
      vi.mocked(db.deficiencies.get).mockResolvedValue(undefined)

      const { markDirty, error } = useOfflineDeficiencies()

      await expect(markDirty('non-existent')).rejects.toThrow('Deficiency non-existent not found')
      expect(error.value?.message).toBe('Deficiency non-existent not found')
    })
  })

  describe('applyFromServer', () => {
    it('persists server row when no local copy exists', async () => {
      const server = createMockDeficiency({ etag: 'etag-srv', isDirty: false })

      vi.mocked(db.deficiencies.get).mockResolvedValue(undefined)
      vi.mocked(db.deficiencies.put).mockResolvedValue(server.id)

      const { applyFromServer } = useOfflineDeficiencies()

      const result = await applyFromServer(server)

      expect(result).toEqual({ applied: true, conflict: false })
      expect(db.deficiencies.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'def-123',
          etag: 'etag-srv',
          isDirty: false,
          syncedAt: expect.any(String),
        }),
      )
    })

    it('replaces clean local row with server snapshot', async () => {
      const local = createMockDeficiency({ isDirty: false, etag: 'e1' })
      const server = createMockDeficiency({
        description: 'Server description text',
        etag: 'e2',
        isDirty: false,
      })

      vi.mocked(db.deficiencies.get).mockResolvedValue(local)
      vi.mocked(db.deficiencies.put).mockResolvedValue(server.id)

      const { applyFromServer } = useOfflineDeficiencies()

      const result = await applyFromServer(server)

      expect(result.conflict).toBe(false)
      expect(db.deficiencies.put).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Server description text',
          isDirty: false,
          clientId: 'client-456',
        }),
      )
    })

    it('returns conflict without write when strategy keeps local pending edits', async () => {
      const local = createMockDeficiency({
        isDirty: true,
        etag: 'etag-local',
      })
      const server = createMockDeficiency({
        etag: 'etag-remote',
        status: 'CLOSED',
      })

      vi.mocked(db.deficiencies.get).mockResolvedValue(local)

      const { applyFromServer } = useOfflineDeficiencies()

      const result = await applyFromServer(server, { strategy: 'keep-local-when-dirty' })

      expect(result).toEqual({ applied: false, conflict: true })
      expect(db.deficiencies.put).not.toHaveBeenCalled()
    })

    it('applies server wins when dirty local etag differs', async () => {
      const local = createMockDeficiency({
        isDirty: true,
        etag: 'etag-local',
      })
      const server = createMockDeficiency({
        etag: 'etag-remote',
        status: 'VOC_SUBMITTED',
      })

      vi.mocked(db.deficiencies.get).mockResolvedValue(local)
      vi.mocked(db.deficiencies.put).mockResolvedValue(server.id)

      const { applyFromServer } = useOfflineDeficiencies()

      const result = await applyFromServer(server)

      expect(result.applied).toBe(true)
      expect(result.conflict).toBe(true)
      expect(db.deficiencies.put).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'VOC_SUBMITTED',
          isDirty: false,
        }),
      )
    })

    it('reclaims cache and retries when put hits quota', async () => {
      const server = createMockDeficiency({ etag: 'e-q', isDirty: false })
      vi.mocked(db.deficiencies.get).mockResolvedValue(undefined)
      const qe = new DOMException('The quota has been exceeded.', 'QuotaExceededError')
      vi.mocked(db.deficiencies.put).mockRejectedValueOnce(qe).mockResolvedValueOnce(server.id)

      const { applyFromServer } = useOfflineDeficiencies()
      const result = await applyFromServer(server)

      expect(result).toEqual({ applied: true, conflict: false })
      expect(db.deficiencies.put).toHaveBeenCalledTimes(2)
      expect(db.transaction).toHaveBeenCalled()
      expect(db.permits.clear).toHaveBeenCalled()
      expect(db.checklistTemplateCache.clear).toHaveBeenCalled()
    })

    it('throws OfflineStorageQuotaError when storage stays full after reclaim', async () => {
      const server = createMockDeficiency()
      vi.mocked(db.deficiencies.get).mockResolvedValue(undefined)
      const qe = new DOMException('The quota has been exceeded.', 'QuotaExceededError')
      vi.mocked(db.deficiencies.put).mockRejectedValue(qe)

      const { applyFromServer, error } = useOfflineDeficiencies()
      await expect(applyFromServer(server)).rejects.toMatchObject({
        name: 'OfflineStorageQuotaError',
      })
      expect(error.value?.name).toBe('OfflineStorageQuotaError')
    })

    it('surfaces reload hint when get fails with InvalidStateError', async () => {
      const server = createMockDeficiency()
      const ise = new DOMException('Connection is closing.', 'InvalidStateError')
      vi.mocked(db.deficiencies.get).mockRejectedValue(ise)

      const { applyFromServer, error } = useOfflineDeficiencies()
      await expect(applyFromServer(server)).rejects.toThrow(/Local database is unavailable/)
      expect(error.value?.message).toMatch(/unavailable/)
    })
  })

  describe('getDirtyItems', () => {
    it('should return all dirty deficiencies', async () => {
      const mockDeficiencies = [
        createMockDeficiency({ id: 'def-1', isDirty: true, updatedAt: '2024-01-10T08:00:00Z' }),
        createMockDeficiency({ id: 'def-2', isDirty: true, updatedAt: '2024-01-11T08:00:00Z' }),
        createMockDeficiency({ id: 'def-3', isDirty: true, updatedAt: '2024-01-09T08:00:00Z' }),
      ]

      const mockWhere = {
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockDeficiencies),
        }),
      }

      vi.mocked(db.deficiencies.where).mockReturnValue(mockWhere as any)

      const { getDirtyItems } = useOfflineDeficiencies()

      const result = await getDirtyItems()

      // Should return sorted by updated date (oldest first for FIFO)
      expect(result).toHaveLength(3)
      expect(result[0].id).toBe('def-3') // 2024-01-09
      expect(result[1].id).toBe('def-1') // 2024-01-10
      expect(result[2].id).toBe('def-2') // 2024-01-11
    })
  })

  // ─── Computed Properties Tests ───────────────────────────────────────────

  describe('computed properties', () => {
    it('should calculate dirtyCount correctly', async () => {
      const mockDeficiencies = [
        createMockDeficiency({ id: 'def-1', isDirty: true }),
        createMockDeficiency({ id: 'def-2', isDirty: false }),
        createMockDeficiency({ id: 'def-3', isDirty: true }),
      ]

      vi.mocked(db.deficiencies.toArray).mockResolvedValue(mockDeficiencies)

      const { getAll, dirtyCount } = useOfflineDeficiencies()

      await getAll()

      expect(dirtyCount.value).toBe(2)
    })

    it('should calculate openCount correctly', async () => {
      const mockDeficiencies = [
        createMockDeficiency({ id: 'def-1', status: 'OPEN' }),
        createMockDeficiency({ id: 'def-2', status: 'CLOSED' }),
        createMockDeficiency({ id: 'def-3', status: 'OPEN' }),
      ]

      vi.mocked(db.deficiencies.toArray).mockResolvedValue(mockDeficiencies)

      const { getAll, openCount } = useOfflineDeficiencies()

      await getAll()

      expect(openCount.value).toBe(2)
    })

    it('should calculate stopWorkCount correctly', async () => {
      const mockDeficiencies = [
        createMockDeficiency({ id: 'def-1', isStopWork: true }),
        createMockDeficiency({ id: 'def-2', isStopWork: false }),
        createMockDeficiency({ id: 'def-3', isStopWork: true }),
      ]

      vi.mocked(db.deficiencies.toArray).mockResolvedValue(mockDeficiencies)

      const { getAll, stopWorkCount } = useOfflineDeficiencies()

      await getAll()

      expect(stopWorkCount.value).toBe(2)
    })

    it('should calculate criticalCount correctly', async () => {
      const mockDeficiencies = [
        createMockDeficiency({ id: 'def-1', severity: 'CRITICAL' }),
        createMockDeficiency({ id: 'def-2', severity: 'MAJOR' }),
        createMockDeficiency({ id: 'def-3', severity: 'CRITICAL' }),
      ]

      vi.mocked(db.deficiencies.toArray).mockResolvedValue(mockDeficiencies)

      const { getAll, criticalCount } = useOfflineDeficiencies()

      await getAll()

      expect(criticalCount.value).toBe(2)
    })
  })

  // ─── clearAll() Tests ────────────────────────────────────────────────────

  describe('clearAll', () => {
    it('should clear all deficiencies', async () => {
      vi.mocked(db.deficiencies.clear).mockResolvedValue()

      const { clearAll, deficiencies } = useOfflineDeficiencies()

      // Add deficiencies to reactive state
      deficiencies.value = [createMockDeficiency(), createMockDeficiency({ id: 'def-2' })]

      await clearAll()

      expect(db.deficiencies.clear).toHaveBeenCalled()
      expect(deficiencies.value).toHaveLength(0)
    })
  })

  // ─── refresh() Tests ─────────────────────────────────────────────────────

  describe('refresh', () => {
    it('should refresh the deficiencies list', async () => {
      const mockDeficiencies = [createMockDeficiency()]

      vi.mocked(db.deficiencies.toArray).mockResolvedValue(mockDeficiencies)

      const { refresh, deficiencies } = useOfflineDeficiencies()

      await refresh()

      expect(deficiencies.value).toEqual(mockDeficiencies)
    })
  })
})
