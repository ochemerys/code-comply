/**
 * Unit tests for useOfflineInspections composable
 *
 * Tests all CRUD operations, dirty flag tracking, and sync engine integration.
 *
 * @see M3-S9 - Create Offline Storage Composables
 * @see testing-strategy.md - Testing Philosophy
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useOfflineInspections } from './useOfflineInspections'
import { db } from '@/lib/db/dexie'
import { syncEngine } from '@/lib/db/sync-engine'
import type { LocalInspection } from '@/lib/db/types'

// Mock dependencies
vi.mock('@/lib/db/dexie', () => ({
  db: {
    inspections: {
      toCollection: vi.fn(),
      where: vi.fn(),
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      clear: vi.fn(),
    },
  },
}))

vi.mock('@/lib/db/sync-engine', () => ({
  syncEngine: {
    queueMutation: vi.fn(),
  },
}))

describe('useOfflineInspections', () => {
  // ─── Test Data ───────────────────────────────────────────────────────────

  const createMockInspection = (overrides?: Partial<LocalInspection>): LocalInspection => ({
    id: 'insp-123',
    clientId: 'client-456',
    permitId: 'permit-789',
    permitNumber: 'P-2024-001',
    permitAddress: '123 Main St',
    status: 'SCHEDULED',
    scheduledDate: '2024-01-15T10:00:00Z',
    assignedToId: 'user-101',
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
    it('should return all inspections', async () => {
      const mockInspections = [
        createMockInspection({ id: 'insp-1', scheduledDate: '2024-01-15T10:00:00Z' }),
        createMockInspection({ id: 'insp-2', scheduledDate: '2024-01-16T10:00:00Z' }),
        createMockInspection({ id: 'insp-3', scheduledDate: '2024-01-14T10:00:00Z' }),
      ]

      const mockCollection = {
        toArray: vi.fn().mockResolvedValue(mockInspections),
      }

      vi.mocked(db.inspections.toCollection).mockReturnValue(mockCollection as any)

      const { getAll, inspections, isLoading } = useOfflineInspections()

      expect(isLoading.value).toBe(false)

      const result = await getAll()

      // Should return sorted by scheduled date (most recent first)
      expect(result).toHaveLength(3)
      expect(result[0].id).toBe('insp-2') // 2024-01-16
      expect(result[1].id).toBe('insp-1') // 2024-01-15
      expect(result[2].id).toBe('insp-3') // 2024-01-14

      // Should update reactive state
      expect(inspections.value).toEqual(result)
      expect(isLoading.value).toBe(false)
    })

    it('should filter by status', async () => {
      const mockInspections = [
        createMockInspection({ id: 'insp-1', status: 'SCHEDULED' }),
        createMockInspection({ id: 'insp-2', status: 'IN_PROGRESS' }),
      ]

      const mockWhere = {
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([mockInspections[0]]),
        }),
      }

      vi.mocked(db.inspections.where).mockReturnValue(mockWhere as any)

      const { getAll } = useOfflineInspections()

      const result = await getAll({ status: 'SCHEDULED' })

      expect(db.inspections.where).toHaveBeenCalledWith('status')
      expect(mockWhere.equals).toHaveBeenCalledWith('SCHEDULED')
      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('SCHEDULED')
    })

    it('should filter by assignedToId', async () => {
      const mockInspections = [createMockInspection({ assignedToId: 'user-101' })]

      const mockWhere = {
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockInspections),
        }),
      }

      vi.mocked(db.inspections.where).mockReturnValue(mockWhere as any)

      const { getAll } = useOfflineInspections()

      const result = await getAll({ assignedToId: 'user-101' })

      expect(db.inspections.where).toHaveBeenCalledWith('assignedToId')
      expect(mockWhere.equals).toHaveBeenCalledWith('user-101')
      expect(result).toHaveLength(1)
    })

    it('should filter by permitId', async () => {
      const mockInspections = [createMockInspection({ permitId: 'permit-789' })]

      const mockWhere = {
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockInspections),
        }),
      }

      vi.mocked(db.inspections.where).mockReturnValue(mockWhere as any)

      const { getAll } = useOfflineInspections()

      const result = await getAll({ permitId: 'permit-789' })

      expect(db.inspections.where).toHaveBeenCalledWith('permitId')
      expect(mockWhere.equals).toHaveBeenCalledWith('permit-789')
      expect(result).toHaveLength(1)
    })

    it('should filter by dirtyOnly', async () => {
      const mockInspections = [createMockInspection({ isDirty: true })]

      const mockWhere = {
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockInspections),
        }),
      }

      vi.mocked(db.inspections.where).mockReturnValue(mockWhere as any)

      const { getAll } = useOfflineInspections()

      const result = await getAll({ dirtyOnly: true })

      expect(db.inspections.where).toHaveBeenCalledWith('isDirty')
      expect(mockWhere.equals).toHaveBeenCalledWith(1)
      expect(result).toHaveLength(1)
      expect(result[0].isDirty).toBe(true)
    })

    it('should filter by date range', async () => {
      const mockInspections = [
        createMockInspection({ id: 'insp-1', scheduledDate: '2024-01-15T10:00:00Z' }),
        createMockInspection({ id: 'insp-2', scheduledDate: '2024-01-20T10:00:00Z' }),
        createMockInspection({ id: 'insp-3', scheduledDate: '2024-01-25T10:00:00Z' }),
      ]

      const mockCollection = {
        toArray: vi.fn().mockResolvedValue(mockInspections),
      }

      vi.mocked(db.inspections.toCollection).mockReturnValue(mockCollection as any)

      const { getAll } = useOfflineInspections()

      const result = await getAll({
        dateFrom: '2024-01-16T00:00:00Z',
        dateTo: '2024-01-24T23:59:59Z',
      })

      // Should only include insp-2 (2024-01-20)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('insp-2')
    })

    it('should handle errors gracefully', async () => {
      const mockError = new Error('Database error')

      vi.mocked(db.inspections.toCollection).mockReturnValue({
        toArray: vi.fn().mockRejectedValue(mockError),
      } as any)

      const { getAll, error } = useOfflineInspections()

      await expect(getAll()).rejects.toThrow('Database error')
      expect(error.value).toEqual(mockError)
    })
  })

  // ─── getById() Tests ─────────────────────────────────────────────────────

  describe('getById', () => {
    it('should return a single inspection', async () => {
      const mockInspection = createMockInspection()

      vi.mocked(db.inspections.get).mockResolvedValue(mockInspection)

      const { getById } = useOfflineInspections()

      const result = await getById('insp-123')

      expect(db.inspections.get).toHaveBeenCalledWith('insp-123')
      expect(result).toEqual(mockInspection)
    })

    it('should return null if inspection not found', async () => {
      vi.mocked(db.inspections.get).mockResolvedValue(undefined)

      const { getById } = useOfflineInspections()

      const result = await getById('non-existent')

      expect(result).toBeNull()
    })

    it('should handle errors gracefully', async () => {
      const mockError = new Error('Database error')

      vi.mocked(db.inspections.get).mockRejectedValue(mockError)

      const { getById, error } = useOfflineInspections()

      await expect(getById('insp-123')).rejects.toThrow('Database error')
      expect(error.value).toEqual(mockError)
    })
  })

  // ─── save() Tests ────────────────────────────────────────────────────────

  describe('save', () => {
    it('should create a new inspection', async () => {
      const mockInspection = createMockInspection()

      vi.mocked(db.inspections.get).mockResolvedValue(undefined) // Not exists
      vi.mocked(db.inspections.put).mockResolvedValue('insp-123')
      vi.mocked(syncEngine.queueMutation).mockResolvedValue('queue-123')

      const { save, inspections } = useOfflineInspections()

      await save(mockInspection)

      // Should save to IndexedDB with isDirty=true
      expect(db.inspections.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'insp-123',
          isDirty: true,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        }),
      )

      // Should queue for sync
      expect(syncEngine.queueMutation).toHaveBeenCalledWith(
        'inspection.create',
        expect.objectContaining({
          clientId: 'client-456',
          id: 'insp-123',
        }),
      )

      // Should update reactive state
      expect(inspections.value).toHaveLength(1)
      expect(inspections.value[0].id).toBe('insp-123')
    })

    it('should update an existing inspection', async () => {
      const existingInspection = createMockInspection()
      const updatedInspection = createMockInspection({ status: 'IN_PROGRESS' })

      vi.mocked(db.inspections.get).mockResolvedValue(existingInspection)
      vi.mocked(db.inspections.put).mockResolvedValue('insp-123')
      vi.mocked(syncEngine.queueMutation).mockResolvedValue('queue-123')

      const { save } = useOfflineInspections()

      await save(updatedInspection)

      // Should save to IndexedDB with isDirty=true
      expect(db.inspections.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'insp-123',
          status: 'IN_PROGRESS',
          isDirty: true,
          updatedAt: expect.any(String),
        }),
      )

      // Should queue for sync with update operation
      expect(syncEngine.queueMutation).toHaveBeenCalledWith(
        'inspection.update',
        expect.objectContaining({
          clientId: 'client-456',
          id: 'insp-123',
        }),
      )
    })

    it('should throw error if ID is missing', async () => {
      const invalidInspection = createMockInspection({ id: '' })

      const { save, error } = useOfflineInspections()

      await expect(save(invalidInspection)).rejects.toThrow('Inspection ID is required')
      expect(error.value?.message).toBe('Inspection ID is required')
    })

    it('should throw error if clientId is missing', async () => {
      const invalidInspection = createMockInspection({ clientId: '' })

      const { save, error } = useOfflineInspections()

      await expect(save(invalidInspection)).rejects.toThrow('Inspection clientId is required')
      expect(error.value?.message).toBe('Inspection clientId is required')
    })
  })

  // ─── delete() Tests ──────────────────────────────────────────────────────

  describe('delete', () => {
    it('should delete an inspection', async () => {
      vi.mocked(db.inspections.delete).mockResolvedValue()

      const { delete: deleteInspection, inspections } = useOfflineInspections()

      // Add an inspection to reactive state
      inspections.value = [createMockInspection()]

      await deleteInspection('insp-123')

      expect(db.inspections.delete).toHaveBeenCalledWith('insp-123')

      // Should update reactive state
      expect(inspections.value).toHaveLength(0)
    })

    it('should handle errors gracefully', async () => {
      const mockError = new Error('Database error')

      vi.mocked(db.inspections.delete).mockRejectedValue(mockError)

      const { delete: deleteInspection, error } = useOfflineInspections()

      await expect(deleteInspection('insp-123')).rejects.toThrow('Database error')
      expect(error.value).toEqual(mockError)
    })
  })

  // ─── markDirty() Tests ───────────────────────────────────────────────────

  describe('markDirty', () => {
    it('should mark an inspection as dirty', async () => {
      const mockInspection = createMockInspection({ isDirty: false })

      vi.mocked(db.inspections.get).mockResolvedValue(mockInspection)
      vi.mocked(db.inspections.update).mockResolvedValue(1)
      vi.mocked(syncEngine.queueMutation).mockResolvedValue('queue-123')

      const { markDirty, inspections } = useOfflineInspections()

      // Add inspection to reactive state
      inspections.value = [mockInspection]

      await markDirty('insp-123')

      // Should update dirty flag
      expect(db.inspections.update).toHaveBeenCalledWith('insp-123', {
        isDirty: true,
        updatedAt: expect.any(String),
      })

      // Should queue for sync
      expect(syncEngine.queueMutation).toHaveBeenCalledWith(
        'inspection.update',
        expect.objectContaining({
          clientId: 'client-456',
          id: 'insp-123',
        }),
      )

      // Should update reactive state
      expect(inspections.value[0].isDirty).toBe(true)
    })

    it('should throw error if inspection not found', async () => {
      vi.mocked(db.inspections.get).mockResolvedValue(undefined)

      const { markDirty, error } = useOfflineInspections()

      await expect(markDirty('non-existent')).rejects.toThrow('Inspection non-existent not found')
      expect(error.value?.message).toBe('Inspection non-existent not found')
    })
  })

  // ─── getDirtyItems() Tests ───────────────────────────────────────────────

  describe('getDirtyItems', () => {
    it('should return all dirty inspections', async () => {
      const mockInspections = [
        createMockInspection({ id: 'insp-1', isDirty: true, updatedAt: '2024-01-10T08:00:00Z' }),
        createMockInspection({ id: 'insp-2', isDirty: true, updatedAt: '2024-01-11T08:00:00Z' }),
        createMockInspection({ id: 'insp-3', isDirty: true, updatedAt: '2024-01-09T08:00:00Z' }),
      ]

      const mockWhere = {
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockInspections),
        }),
      }

      vi.mocked(db.inspections.where).mockReturnValue(mockWhere as any)

      const { getDirtyItems } = useOfflineInspections()

      const result = await getDirtyItems()

      // Should return sorted by updated date (oldest first for FIFO)
      expect(result).toHaveLength(3)
      expect(result[0].id).toBe('insp-3') // 2024-01-09
      expect(result[1].id).toBe('insp-1') // 2024-01-10
      expect(result[2].id).toBe('insp-2') // 2024-01-11
    })

    it('should return empty array if no dirty items', async () => {
      const mockWhere = {
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      }

      vi.mocked(db.inspections.where).mockReturnValue(mockWhere as any)

      const { getDirtyItems } = useOfflineInspections()

      const result = await getDirtyItems()

      expect(result).toHaveLength(0)
    })
  })

  // ─── Computed Properties Tests ───────────────────────────────────────────

  describe('computed properties', () => {
    it('should calculate dirtyCount correctly', async () => {
      const mockInspections = [
        createMockInspection({ id: 'insp-1', isDirty: true }),
        createMockInspection({ id: 'insp-2', isDirty: false }),
        createMockInspection({ id: 'insp-3', isDirty: true }),
      ]

      const mockCollection = {
        toArray: vi.fn().mockResolvedValue(mockInspections),
      }

      vi.mocked(db.inspections.toCollection).mockReturnValue(mockCollection as any)

      const { getAll, dirtyCount } = useOfflineInspections()

      await getAll()

      expect(dirtyCount.value).toBe(2)
    })
  })

  // ─── clearAll() Tests ────────────────────────────────────────────────────

  describe('clearAll', () => {
    it('should clear all inspections', async () => {
      vi.mocked(db.inspections.clear).mockResolvedValue()

      const { clearAll, inspections } = useOfflineInspections()

      // Add inspections to reactive state
      inspections.value = [createMockInspection(), createMockInspection({ id: 'insp-2' })]

      await clearAll()

      expect(db.inspections.clear).toHaveBeenCalled()
      expect(inspections.value).toHaveLength(0)
    })

    it('should handle errors gracefully', async () => {
      const mockError = new Error('Database error')

      vi.mocked(db.inspections.clear).mockRejectedValue(mockError)

      const { clearAll, error } = useOfflineInspections()

      await expect(clearAll()).rejects.toThrow('Database error')
      expect(error.value).toEqual(mockError)
    })
  })

  // ─── refresh() Tests ─────────────────────────────────────────────────────

  describe('refresh', () => {
    it('should refresh the inspections list', async () => {
      const mockInspections = [createMockInspection()]

      const mockCollection = {
        toArray: vi.fn().mockResolvedValue(mockInspections),
      }

      vi.mocked(db.inspections.toCollection).mockReturnValue(mockCollection as any)

      const { refresh, inspections } = useOfflineInspections()

      await refresh()

      expect(inspections.value).toEqual(mockInspections)
    })

    it('should refresh with filters', async () => {
      const mockInspections = [createMockInspection({ status: 'SCHEDULED' })]

      const mockWhere = {
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockInspections),
        }),
      }

      vi.mocked(db.inspections.where).mockReturnValue(mockWhere as any)

      const { refresh } = useOfflineInspections()

      await refresh({ status: 'SCHEDULED' })

      expect(db.inspections.where).toHaveBeenCalledWith('status')
    })
  })
})
