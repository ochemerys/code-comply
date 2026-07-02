/**
 * Unit tests for useOfflinePermits composable
 *
 * Tests CRUD operations, filtering, search, and sync functionality
 * for offline permit storage in IndexedDB.
 *
 * @see M4-S12 - Sync Permits to IndexedDB for Offline Access
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useOfflinePermits } from './useOfflinePermits'
import { db } from '@/lib/db/dexie'
import { syncEngine } from '@/lib/db/sync-engine'
import type { LocalPermit } from '@/lib/db/types'

// Mock dependencies
vi.mock('@/lib/db/dexie', () => ({
  db: {
    permits: {
      toCollection: vi.fn(),
      where: vi.fn(),
      get: vi.fn(),
      put: vi.fn(),
      bulkPut: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      toArray: vi.fn(),
    },
  },
}))

vi.mock('@/lib/db/sync-engine', () => ({
  syncEngine: {
    queueMutation: vi.fn(),
  },
}))

describe('useOfflinePermits', () => {
  // ─── Test Data ─────────────────────────���─────────────────────────────────

  const mockPermits: LocalPermit[] = [
    {
      id: 'permit-1',
      permitNumber: 'BP-2024-001',
      address: '123 Main St',
      status: 'ACTIVE',
      distance: 500,
      nextInspectionDate: '2024-02-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    },
    {
      id: 'permit-2',
      permitNumber: 'BP-2024-002',
      address: '456 Oak Ave',
      status: 'ACTIVE',
      distance: 1000,
      nextInspectionDate: '2024-02-20T14:00:00Z',
      updatedAt: '2024-01-15T11:00:00Z',
    },
    {
      id: 'permit-3',
      permitNumber: 'BP-2024-003',
      address: '789 Pine Rd',
      status: 'COMPLETED',
      updatedAt: '2024-01-15T12:00:00Z',
    },
  ]

  // ─── Setup & Teardown ────────────────────────────────────────────────────

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ─── getAll Tests ────────────────────────────────────────────────────────

  describe('getAll', () => {
    it('should load all permits from IndexedDB', async () => {
      const mockToArray = vi.fn().mockResolvedValue([...mockPermits])
      vi.mocked(db.permits.toCollection).mockReturnValue({
        toArray: mockToArray,
      } as any)

      const { getAll, permits, isLoading } = useOfflinePermits()

      expect(isLoading.value).toBe(false)

      const result = await getAll()

      expect(result).toHaveLength(3)
      expect(permits.value).toHaveLength(3)
      expect(permits.value[0].permitNumber).toBe('BP-2024-001')
      expect(isLoading.value).toBe(false)
    })

    it('should filter by status', async () => {
      const activePermits = mockPermits.filter((p) => p.status === 'ACTIVE')
      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(activePermits),
        }),
      })
      vi.mocked(db.permits.where).mockImplementation(mockWhere)

      const { getAll } = useOfflinePermits()

      const result = await getAll({ status: 'ACTIVE' })

      expect(result).toHaveLength(2)
      expect(result.every((p) => p.status === 'ACTIVE')).toBe(true)
      expect(mockWhere).toHaveBeenCalledWith('status')
    })

    it('should filter by permit number (partial match)', async () => {
      const mockToArray = vi.fn().mockResolvedValue([...mockPermits])
      vi.mocked(db.permits.toCollection).mockReturnValue({
        toArray: mockToArray,
      } as any)

      const { getAll } = useOfflinePermits()

      const result = await getAll({ permitNumber: '001' })

      expect(result).toHaveLength(1)
      expect(result[0].permitNumber).toBe('BP-2024-001')
    })

    it('should filter by address (partial match, case-insensitive)', async () => {
      const mockToArray = vi.fn().mockResolvedValue([...mockPermits])
      vi.mocked(db.permits.toCollection).mockReturnValue({
        toArray: mockToArray,
      } as any)

      const { getAll } = useOfflinePermits()

      const result = await getAll({ address: 'main' })

      expect(result).toHaveLength(1)
      expect(result[0].address).toBe('123 Main St')
    })

    it('should filter by max distance', async () => {
      const mockToArray = vi.fn().mockResolvedValue([...mockPermits])
      vi.mocked(db.permits.toCollection).mockReturnValue({
        toArray: mockToArray,
      } as any)

      const { getAll } = useOfflinePermits()

      const result = await getAll({ maxDistance: 750 })

      expect(result).toHaveLength(1)
      expect(result[0].distance).toBe(500)
    })

    it('should filter by date range', async () => {
      const mockToArray = vi.fn().mockResolvedValue([...mockPermits])
      vi.mocked(db.permits.toCollection).mockReturnValue({
        toArray: mockToArray,
      } as any)

      const { getAll } = useOfflinePermits()

      const result = await getAll({
        dateFrom: '2024-02-14T00:00:00Z',
        dateTo: '2024-02-16T00:00:00Z',
      })

      expect(result).toHaveLength(1)
      expect(result[0].nextInspectionDate).toBe('2024-02-15T10:00:00Z')
    })

    it('should sort permits by permit number', async () => {
      const unsortedPermits = [mockPermits[2], mockPermits[0], mockPermits[1]]
      const mockToArray = vi.fn().mockResolvedValue(unsortedPermits)
      vi.mocked(db.permits.toCollection).mockReturnValue({
        toArray: mockToArray,
      } as any)

      const { getAll } = useOfflinePermits()

      const result = await getAll()

      expect(result[0].permitNumber).toBe('BP-2024-001')
      expect(result[1].permitNumber).toBe('BP-2024-002')
      expect(result[2].permitNumber).toBe('BP-2024-003')
    })

    it('should handle errors gracefully', async () => {
      const mockError = new Error('Database error')
      vi.mocked(db.permits.toCollection).mockReturnValue({
        toArray: vi.fn().mockRejectedValue(mockError),
      } as any)

      const { getAll, error } = useOfflinePermits()

      await expect(getAll()).rejects.toThrow('Database error')
      expect(error.value).toBe(mockError)
    })
  })

  // ─── getById Tests ───────────────────────────────────────────────────────

  describe('getById', () => {
    it('should get a permit by ID', async () => {
      vi.mocked(db.permits.get).mockResolvedValue(mockPermits[0])

      const { getById } = useOfflinePermits()

      const result = await getById('permit-1')

      expect(result).toEqual(mockPermits[0])
      expect(db.permits.get).toHaveBeenCalledWith('permit-1')
    })

    it('should return null if permit not found', async () => {
      vi.mocked(db.permits.get).mockResolvedValue(undefined)

      const { getById } = useOfflinePermits()

      const result = await getById('non-existent')

      expect(result).toBeNull()
    })

    it('should handle errors', async () => {
      const mockError = new Error('Database error')
      vi.mocked(db.permits.get).mockRejectedValue(mockError)

      const { getById, error } = useOfflinePermits()

      await expect(getById('permit-1')).rejects.toThrow('Database error')
      expect(error.value).toBe(mockError)
    })
  })

  // ─── getByPermitNumber Tests ──────────────────────────���──────────────────

  describe('getByPermitNumber', () => {
    it('should get a permit by permit number', async () => {
      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockPermits[0]),
        }),
      })
      vi.mocked(db.permits.where).mockImplementation(mockWhere)

      const { getByPermitNumber } = useOfflinePermits()

      const result = await getByPermitNumber('BP-2024-001')

      expect(result).toEqual(mockPermits[0])
      expect(mockWhere).toHaveBeenCalledWith('permitNumber')
    })

    it('should return null if permit not found', async () => {
      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(undefined),
        }),
      })
      vi.mocked(db.permits.where).mockImplementation(mockWhere)

      const { getByPermitNumber } = useOfflinePermits()

      const result = await getByPermitNumber('NON-EXISTENT')

      expect(result).toBeNull()
    })
  })

  // ─── search Tests ────────────────────────────────────────────────────────

  describe('search', () => {
    it('should search by permit number (partial match)', async () => {
      vi.mocked(db.permits.toArray).mockResolvedValue([...mockPermits])

      const { search } = useOfflinePermits()

      const result = await search('BP-2024-001')

      expect(result).toHaveLength(1)
      expect(result[0].permitNumber).toBe('BP-2024-001')
    })

    it('should search by address (partial match, case-insensitive)', async () => {
      vi.mocked(db.permits.toArray).mockResolvedValue([...mockPermits])

      const { search } = useOfflinePermits()

      const result = await search('main')

      expect(result).toHaveLength(1)
      expect(result[0].address).toBe('123 Main St')
    })

    it('should return multiple results for broad search', async () => {
      vi.mocked(db.permits.toArray).mockResolvedValue([...mockPermits])

      const { search } = useOfflinePermits()

      const result = await search('BP-2024')

      expect(result).toHaveLength(3)
    })

    it('should return empty array for empty query', async () => {
      const { search } = useOfflinePermits()

      const result = await search('')

      expect(result).toHaveLength(0)
    })

    it('should return empty array for whitespace query', async () => {
      const { search } = useOfflinePermits()

      const result = await search('   ')

      expect(result).toHaveLength(0)
    })

    it('should sort results by relevance (exact match first)', async () => {
      const permits = [
        { ...mockPermits[0], permitNumber: 'BP-2024-001' },
        { ...mockPermits[1], permitNumber: 'BP-2024' },
        { ...mockPermits[2], permitNumber: 'BP-2024-002' },
      ]
      vi.mocked(db.permits.toArray).mockResolvedValue(permits)

      const { search } = useOfflinePermits()

      const result = await search('BP-2024')

      // Exact match should be first
      expect(result[0].permitNumber).toBe('BP-2024')
    })

    it('should sort results by relevance (starts with second)', async () => {
      const permits = [
        { ...mockPermits[0], permitNumber: 'ABC-BP-2024' },
        { ...mockPermits[1], permitNumber: 'BP-2024-001' },
      ]
      vi.mocked(db.permits.toArray).mockResolvedValue(permits)

      const { search } = useOfflinePermits()

      const result = await search('BP-2024')

      // Starts with should be first
      expect(result[0].permitNumber).toBe('BP-2024-001')
    })
  })

  // ─── save Tests ──────────────────────────────────────────────────────────

  describe('save', () => {
    it('should save a new permit', async () => {
      vi.mocked(db.permits.get).mockResolvedValue(undefined)
      vi.mocked(db.permits.put).mockResolvedValue('permit-1')

      const { save, permits } = useOfflinePermits()

      const newPermit: LocalPermit = {
        id: 'permit-1',
        permitNumber: 'BP-2024-004',
        address: '999 New St',
        status: 'ACTIVE',
        updatedAt: '2024-01-15T10:00:00Z',
      }

      await save(newPermit)

      expect(db.permits.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'permit-1',
          permitNumber: 'BP-2024-004',
        }),
      )
      expect(permits.value).toHaveLength(1)
    })

    it('should update an existing permit', async () => {
      vi.mocked(db.permits.get).mockResolvedValue(mockPermits[0])
      vi.mocked(db.permits.put).mockResolvedValue('permit-1')

      const { save } = useOfflinePermits()

      const updatedPermit: LocalPermit = {
        ...mockPermits[0],
        address: 'Updated Address',
      }

      await save(updatedPermit)

      expect(db.permits.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'permit-1',
          address: 'Updated Address',
        }),
      )
    })

    it('should update the updatedAt timestamp', async () => {
      vi.mocked(db.permits.get).mockResolvedValue(undefined)
      vi.mocked(db.permits.put).mockResolvedValue('permit-1')

      const { save } = useOfflinePermits()

      const newPermit: LocalPermit = {
        id: 'permit-1',
        permitNumber: 'BP-2024-004',
        address: '999 New St',
        status: 'ACTIVE',
        updatedAt: '2024-01-15T10:00:00Z',
      }

      await save(newPermit)

      expect(db.permits.put).toHaveBeenCalledWith(
        expect.objectContaining({
          updatedAt: expect.any(String),
        }),
      )

      const savedPermit = vi.mocked(db.permits.put).mock.calls[0][0]
      expect(new Date(savedPermit.updatedAt).getTime()).toBeGreaterThan(
        new Date('2024-01-15T10:00:00Z').getTime(),
      )
    })

    it('should throw error if permit ID is missing', async () => {
      const { save, error } = useOfflinePermits()

      const invalidPermit = {
        permitNumber: 'BP-2024-004',
        address: '999 New St',
        status: 'ACTIVE',
        updatedAt: '2024-01-15T10:00:00Z',
      } as LocalPermit

      await expect(save(invalidPermit)).rejects.toThrow('Permit ID is required')
      expect(error.value?.message).toBe('Permit ID is required')
    })

    it('should throw error if permit number is missing', async () => {
      const { save, error } = useOfflinePermits()

      const invalidPermit = {
        id: 'permit-1',
        address: '999 New St',
        status: 'ACTIVE',
        updatedAt: '2024-01-15T10:00:00Z',
      } as LocalPermit

      await expect(save(invalidPermit)).rejects.toThrow('Permit number is required')
      expect(error.value?.message).toBe('Permit number is required')
    })
  })

  // ─── saveMany Tests ──────────────────────────────────────────────────────

  describe('saveMany', () => {
    it('should save multiple permits in bulk', async () => {
      vi.mocked(db.permits.bulkPut).mockResolvedValue('permit-1')
      const mockToArray = vi.fn().mockResolvedValue([...mockPermits])
      vi.mocked(db.permits.toCollection).mockReturnValue({
        toArray: mockToArray,
      } as any)

      const { saveMany, lastSyncedAt } = useOfflinePermits()

      await saveMany(mockPermits)

      expect(db.permits.bulkPut).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'permit-1' }),
          expect.objectContaining({ id: 'permit-2' }),
          expect.objectContaining({ id: 'permit-3' }),
        ]),
      )
      expect(lastSyncedAt.value).toBeTruthy()
    })

    it('should update timestamps for all permits', async () => {
      vi.mocked(db.permits.bulkPut).mockResolvedValue('permit-1')
      const mockToArray = vi.fn().mockResolvedValue([...mockPermits])
      vi.mocked(db.permits.toCollection).mockReturnValue({
        toArray: mockToArray,
      } as any)

      const { saveMany } = useOfflinePermits()

      await saveMany(mockPermits)

      const savedPermits = vi.mocked(db.permits.bulkPut).mock.calls[0][0]
      expect(savedPermits.every((p: LocalPermit) => p.updatedAt)).toBe(true)
    })

    it('should handle empty array', async () => {
      const { saveMany } = useOfflinePermits()

      await saveMany([])

      expect(db.permits.bulkPut).not.toHaveBeenCalled()
    })

    it('should throw error if any permit is missing ID', async () => {
      const { saveMany, error } = useOfflinePermits()

      const invalidPermits = [
        mockPermits[0],
        { permitNumber: 'BP-2024-004', address: '999 New St', status: 'ACTIVE' } as LocalPermit,
      ]

      await expect(saveMany(invalidPermits)).rejects.toThrow('All permits must have an ID')
      expect(error.value?.message).toBe('All permits must have an ID')
    })

    it('should throw error if any permit is missing permit number', async () => {
      const { saveMany, error } = useOfflinePermits()

      const invalidPermits = [
        mockPermits[0],
        { id: 'permit-4', address: '999 New St', status: 'ACTIVE' } as LocalPermit,
      ]

      await expect(saveMany(invalidPermits)).rejects.toThrow(
        'All permits must have a permit number',
      )
      expect(error.value?.message).toBe('All permits must have a permit number')
    })
  })

  // ─── delete Tests ────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should delete a permit', async () => {
      vi.mocked(db.permits.delete).mockResolvedValue()

      const { delete: deletePermit, permits } = useOfflinePermits()

      // Set initial state
      permits.value = [...mockPermits]

      await deletePermit('permit-1')

      expect(db.permits.delete).toHaveBeenCalledWith('permit-1')
      expect(permits.value).toHaveLength(2)
      expect(permits.value.find((p) => p.id === 'permit-1')).toBeUndefined()
    })

    it('should handle errors', async () => {
      const mockError = new Error('Database error')
      vi.mocked(db.permits.delete).mockRejectedValue(mockError)

      const { delete: deletePermit, error } = useOfflinePermits()

      await expect(deletePermit('permit-1')).rejects.toThrow('Database error')
      expect(error.value).toBe(mockError)
    })
  })

  // ─── clearAll Tests ─────────────────────────────���────────────────────────

  describe('clearAll', () => {
    it('should clear all permits', async () => {
      vi.mocked(db.permits.clear).mockResolvedValue()

      const { clearAll, permits, lastSyncedAt } = useOfflinePermits()

      // Set initial state
      permits.value = [...mockPermits]
      lastSyncedAt.value = '2024-01-15T10:00:00Z'

      await clearAll()

      expect(db.permits.clear).toHaveBeenCalled()
      expect(permits.value).toHaveLength(0)
      expect(lastSyncedAt.value).toBeNull()
    })

    it('should handle errors', async () => {
      const mockError = new Error('Database error')
      vi.mocked(db.permits.clear).mockRejectedValue(mockError)

      const { clearAll, error } = useOfflinePermits()

      await expect(clearAll()).rejects.toThrow('Database error')
      expect(error.value).toBe(mockError)
    })
  })

  // ─── syncFromServer Tests ────────────────────────────────────────────────

  describe('syncFromServer', () => {
    it('should queue a sync operation', async () => {
      vi.mocked(syncEngine.queueMutation).mockResolvedValue()

      const { syncFromServer } = useOfflinePermits()

      await syncFromServer()

      expect(syncEngine.queueMutation).toHaveBeenCalledWith(
        'permit.sync',
        expect.objectContaining({
          syncType: 'delta',
        }),
      )
    })

    it('should include lastSyncedAt in sync payload', async () => {
      vi.mocked(syncEngine.queueMutation).mockResolvedValue()

      const { syncFromServer, lastSyncedAt } = useOfflinePermits()

      lastSyncedAt.value = '2024-01-15T10:00:00Z'

      await syncFromServer()

      expect(syncEngine.queueMutation).toHaveBeenCalledWith(
        'permit.sync',
        expect.objectContaining({
          lastSyncedAt: '2024-01-15T10:00:00Z',
        }),
      )
    })

    it('should handle errors', async () => {
      const mockError = new Error('Sync error')
      vi.mocked(syncEngine.queueMutation).mockRejectedValue(mockError)

      const { syncFromServer, error } = useOfflinePermits()

      await expect(syncFromServer()).rejects.toThrow('Sync error')
      expect(error.value).toBe(mockError)
    })
  })

  // ─── Computed Properties Tests ───────────────────────────────────────────

  describe('computed properties', () => {
    it('should calculate totalCount correctly', async () => {
      const mockToArray = vi.fn().mockResolvedValue([...mockPermits])
      vi.mocked(db.permits.toCollection).mockReturnValue({
        toArray: mockToArray,
      } as any)

      const { getAll, totalCount } = useOfflinePermits()

      await getAll()

      expect(totalCount.value).toBe(3)
    })

    it('should calculate activeCount correctly', async () => {
      const mockToArray = vi.fn().mockResolvedValue([...mockPermits])
      vi.mocked(db.permits.toCollection).mockReturnValue({
        toArray: mockToArray,
      } as any)

      const { getAll, activeCount } = useOfflinePermits()

      await getAll()

      expect(activeCount.value).toBe(2)
    })
  })

  // ─── refresh Tests ───────────────────────────────────────────────────────

  describe('refresh', () => {
    it('should refresh the permits list', async () => {
      const mockToArray = vi.fn().mockResolvedValue([...mockPermits])
      vi.mocked(db.permits.toCollection).mockReturnValue({
        toArray: mockToArray,
      } as any)

      const { refresh, permits } = useOfflinePermits()

      await refresh()

      expect(permits.value).toHaveLength(3)
    })

    it('should refresh with filters', async () => {
      const activePermits = mockPermits.filter((p) => p.status === 'ACTIVE')
      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(activePermits),
        }),
      })
      vi.mocked(db.permits.where).mockImplementation(mockWhere)

      const { refresh, permits } = useOfflinePermits()

      await refresh({ status: 'ACTIVE' })

      expect(permits.value).toHaveLength(2)
    })
  })
})
