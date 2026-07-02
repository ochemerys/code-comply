/**
 * Integration tests for permit sync workflow
 *
 * Tests the complete flow of syncing permits from server to IndexedDB,
 * including initial sync, delta sync, and offline search capabilities.
 *
 * @see M4-S12 - Sync Permits to IndexedDB for Offline Access
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useOfflinePermits } from '@/composables/useOfflinePermits'
import { db } from '@/lib/db/dexie'
import { syncEngine } from '@/lib/db/sync-engine'
import type { LocalPermit } from '@/lib/db/types'

describe('Permit Sync Integration Tests', () => {
  // ─── Test Data ───────────────────────────────────────────────────────────

  const mockServerPermits: LocalPermit[] = [
    {
      id: 'permit-1',
      permitNumber: 'BP-2024-001',
      address: '123 Main St, Edmonton, AB',
      status: 'ACTIVE',
      distance: 500,
      nextInspectionDate: '2024-02-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    },
    {
      id: 'permit-2',
      permitNumber: 'BP-2024-002',
      address: '456 Oak Ave, Calgary, AB',
      status: 'ACTIVE',
      distance: 1000,
      nextInspectionDate: '2024-02-20T14:00:00Z',
      updatedAt: '2024-01-15T11:00:00Z',
    },
    {
      id: 'permit-3',
      permitNumber: 'BP-2024-003',
      address: '789 Pine Rd, Red Deer, AB',
      status: 'COMPLETED',
      updatedAt: '2024-01-15T12:00:00Z',
    },
  ]

  // ─── Setup & Teardown ────────────────────────────────────────────────────

  beforeEach(async () => {
    // Clear database before each test
    await db.permits.clear()
    vi.clearAllMocks()
  })

  afterEach(async () => {
    // Clean up after each test
    await db.permits.clear()
    vi.restoreAllMocks()
  })

  // ─── Initial Sync Tests ──────────────────────────────────────────────────

  describe('Initial Sync', () => {
    it('should sync all assigned permits on app load', async () => {
      const { saveMany, getAll, totalCount, lastSyncedAt } = useOfflinePermits()

      // Simulate initial sync from server
      await saveMany(mockServerPermits)

      // Verify permits are saved
      const permits = await getAll()
      expect(permits).toHaveLength(3)
      expect(totalCount.value).toBe(3)
      expect(lastSyncedAt.value).toBeTruthy()
    })

    it('should save permits with updated timestamps', async () => {
      const { saveMany, getAll } = useOfflinePermits()

      const beforeSync = new Date().toISOString()
      await saveMany(mockServerPermits)
      const afterSync = new Date().toISOString()

      const permits = await getAll()
      permits.forEach((permit) => {
        expect(permit.updatedAt >= beforeSync).toBe(true)
        expect(permit.updatedAt <= afterSync).toBe(true)
      })
    })

    it('should handle empty server response', async () => {
      const { saveMany, totalCount } = useOfflinePermits()

      await saveMany([])

      expect(totalCount.value).toBe(0)
    })
  })

  // ─── Delta Sync Tests ────────────────────────────────────────────────────

  describe('Delta Sync', () => {
    it('should update existing permits and add new ones', async () => {
      const { saveMany, getAll, getById } = useOfflinePermits()

      // Initial sync
      await saveMany(mockServerPermits)

      // Delta sync with updates and new permit
      const deltaPermits: LocalPermit[] = [
        {
          ...mockServerPermits[0],
          address: 'Updated Address',
          updatedAt: '2024-01-16T10:00:00Z',
        },
        {
          id: 'permit-4',
          permitNumber: 'BP-2024-004',
          address: '999 New St, Edmonton, AB',
          status: 'ACTIVE',
          updatedAt: '2024-01-16T10:00:00Z',
        },
      ]

      await saveMany(deltaPermits)

      // Verify updates
      const updatedPermit = await getById('permit-1')
      expect(updatedPermit?.address).toBe('Updated Address')

      // Verify new permit added
      const newPermit = await getById('permit-4')
      expect(newPermit?.permitNumber).toBe('BP-2024-004')

      // Verify total count
      const allPermits = await getAll()
      expect(allPermits).toHaveLength(4)
    })

    it('should preserve existing permits not in delta', async () => {
      const { saveMany, getAll, getById } = useOfflinePermits()

      // Initial sync
      await saveMany(mockServerPermits)

      // Delta sync with only one permit
      const deltaPermits: LocalPermit[] = [
        {
          ...mockServerPermits[0],
          address: 'Updated Address',
          updatedAt: '2024-01-16T10:00:00Z',
        },
      ]

      await saveMany(deltaPermits)

      // Verify other permits still exist
      const permit2 = await getById('permit-2')
      expect(permit2).toBeTruthy()
      expect(permit2?.address).toBe('456 Oak Ave, Calgary, AB')

      const permit3 = await getById('permit-3')
      expect(permit3).toBeTruthy()
    })
  })

  // ─── Background Refresh Tests ────────────────────────────────────────────

  describe('Background Refresh', () => {
    it('should queue sync operation for background refresh', async () => {
      vi.spyOn(syncEngine, 'queueMutation').mockResolvedValue()

      const { syncFromServer } = useOfflinePermits()

      await syncFromServer()

      expect(syncEngine.queueMutation).toHaveBeenCalledWith(
        'permit.sync',
        expect.objectContaining({
          syncType: 'delta',
        }),
      )
    })

    it('should include lastSyncedAt for delta sync', async () => {
      vi.spyOn(syncEngine, 'queueMutation').mockResolvedValue()

      const { saveMany, syncFromServer, lastSyncedAt } = useOfflinePermits()

      // Initial sync
      await saveMany(mockServerPermits)
      const syncTimestamp = lastSyncedAt.value

      // Background refresh
      await syncFromServer()

      expect(syncEngine.queueMutation).toHaveBeenCalledWith(
        'permit.sync',
        expect.objectContaining({
          lastSyncedAt: syncTimestamp,
          syncType: 'delta',
        }),
      )
    })
  })

  // ─── Offline Search Tests ────────────────────────────────────────────────

  describe('Offline Search', () => {
    beforeEach(async () => {
      // Populate database with test data
      const { saveMany } = useOfflinePermits()
      await saveMany(mockServerPermits)
    })

    it('should search permits by permit number offline', async () => {
      const { search } = useOfflinePermits()

      const results = await search('BP-2024-001')

      expect(results).toHaveLength(1)
      expect(results[0].permitNumber).toBe('BP-2024-001')
    })

    it('should search permits by address offline', async () => {
      const { search } = useOfflinePermits()

      const results = await search('Main St')

      expect(results).toHaveLength(1)
      expect(results[0].address).toContain('Main St')
    })

    it('should search permits case-insensitively', async () => {
      const { search } = useOfflinePermits()

      const results = await search('main st')

      expect(results).toHaveLength(1)
      expect(results[0].address).toContain('Main St')
    })

    it('should return multiple results for broad search', async () => {
      const { search } = useOfflinePermits()

      const results = await search('BP-2024')

      expect(results).toHaveLength(3)
    })

    it('should return results sorted by relevance', async () => {
      const { search } = useOfflinePermits()

      const results = await search('BP-2024-001')

      // Exact match should be first
      expect(results[0].permitNumber).toBe('BP-2024-001')
    })
  })

  // ─── Offline Detail View Tests ───────────────────────────────────────────

  describe('Offline Detail View', () => {
    beforeEach(async () => {
      // Populate database with test data
      const { saveMany } = useOfflinePermits()
      await saveMany(mockServerPermits)
    })

    it('should retrieve permit details offline by ID', async () => {
      const { getById } = useOfflinePermits()

      const permit = await getById('permit-1')

      expect(permit).toBeTruthy()
      expect(permit?.permitNumber).toBe('BP-2024-001')
      expect(permit?.address).toBe('123 Main St, Edmonton, AB')
      expect(permit?.status).toBe('ACTIVE')
    })

    it('should retrieve permit details offline by permit number', async () => {
      const { getByPermitNumber } = useOfflinePermits()

      const permit = await getByPermitNumber('BP-2024-002')

      expect(permit).toBeTruthy()
      expect(permit?.id).toBe('permit-2')
      expect(permit?.address).toBe('456 Oak Ave, Calgary, AB')
    })

    it('should return null for non-existent permit', async () => {
      const { getById } = useOfflinePermits()

      const permit = await getById('non-existent')

      expect(permit).toBeNull()
    })
  })

  // ─── Sync Status Tracking Tests ──────────────────────────────────────────

  describe('Sync Status Tracking', () => {
    it('should track last synced timestamp', async () => {
      const { saveMany, lastSyncedAt } = useOfflinePermits()

      expect(lastSyncedAt.value).toBeNull()

      await saveMany(mockServerPermits)

      expect(lastSyncedAt.value).toBeTruthy()
      expect(new Date(lastSyncedAt.value!).getTime()).toBeLessThanOrEqual(new Date().getTime())
    })

    it('should update last synced timestamp on each sync', async () => {
      const { saveMany, lastSyncedAt } = useOfflinePermits()

      await saveMany(mockServerPermits)
      const firstSync = lastSyncedAt.value

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10))

      await saveMany([mockServerPermits[0]])
      const secondSync = lastSyncedAt.value

      expect(secondSync).not.toBe(firstSync)
      expect(new Date(secondSync!).getTime()).toBeGreaterThan(new Date(firstSync!).getTime())
    })

    it('should track total permit count', async () => {
      const { saveMany, totalCount } = useOfflinePermits()

      expect(totalCount.value).toBe(0)

      await saveMany(mockServerPermits)

      expect(totalCount.value).toBe(3)
    })

    it('should track active permit count', async () => {
      const { saveMany, activeCount } = useOfflinePermits()

      expect(activeCount.value).toBe(0)

      await saveMany(mockServerPermits)

      expect(activeCount.value).toBe(2)
    })
  })

  // ─── Filter and Sort Tests ───────────────────────────────────────────────

  describe('Filter and Sort', () => {
    beforeEach(async () => {
      // Populate database with test data
      const { saveMany } = useOfflinePermits()
      await saveMany(mockServerPermits)
    })

    it('should filter permits by status', async () => {
      const { getAll } = useOfflinePermits()

      const activePermits = await getAll({ status: 'ACTIVE' })

      expect(activePermits).toHaveLength(2)
      expect(activePermits.every((p) => p.status === 'ACTIVE')).toBe(true)
    })

    it('should filter permits by distance', async () => {
      const { getAll } = useOfflinePermits()

      const nearbyPermits = await getAll({ maxDistance: 750 })

      expect(nearbyPermits).toHaveLength(1)
      expect(nearbyPermits[0].distance).toBe(500)
    })

    it('should filter permits by date range', async () => {
      const { getAll } = useOfflinePermits()

      const permits = await getAll({
        dateFrom: '2024-02-14T00:00:00Z',
        dateTo: '2024-02-16T00:00:00Z',
      })

      expect(permits).toHaveLength(1)
      expect(permits[0].nextInspectionDate).toBe('2024-02-15T10:00:00Z')
    })

    it('should sort permits by permit number', async () => {
      const { getAll } = useOfflinePermits()

      const permits = await getAll()

      expect(permits[0].permitNumber).toBe('BP-2024-001')
      expect(permits[1].permitNumber).toBe('BP-2024-002')
      expect(permits[2].permitNumber).toBe('BP-2024-003')
    })
  })

  // ─── Error Handling Tests ────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('should handle sync errors gracefully', async () => {
      vi.spyOn(syncEngine, 'queueMutation').mockRejectedValue(new Error('Network error'))

      const { syncFromServer, error } = useOfflinePermits()

      await expect(syncFromServer()).rejects.toThrow('Network error')
      expect(error.value?.message).toBe('Network error')
    })

    it('should handle database errors during save', async () => {
      vi.spyOn(db.permits, 'bulkPut').mockRejectedValue(new Error('Database full'))

      const { saveMany, error } = useOfflinePermits()

      await expect(saveMany(mockServerPermits)).rejects.toThrow('Database full')
      expect(error.value?.message).toBe('Database full')
    })

    it('should handle database errors during search', async () => {
      vi.spyOn(db.permits, 'toArray').mockRejectedValue(new Error('Database error'))

      const { search, error } = useOfflinePermits()

      await expect(search('BP-2024')).rejects.toThrow('Database error')
      expect(error.value?.message).toBe('Database error')
    })
  })

  // ─── Manual Refresh Tests ────────────────────────────────────────────────

  describe('Manual Refresh (Pull to Refresh)', () => {
    it('should refresh permits list on manual trigger', async () => {
      const { saveMany, refresh, permits } = useOfflinePermits()

      // Initial sync
      await saveMany(mockServerPermits)

      // Clear reactive state
      permits.value = []

      // Manual refresh
      await refresh()

      expect(permits.value).toHaveLength(3)
    })

    it('should apply filters on manual refresh', async () => {
      const { saveMany, refresh, permits } = useOfflinePermits()

      // Initial sync
      await saveMany(mockServerPermits)

      // Manual refresh with filter
      await refresh({ status: 'ACTIVE' })

      expect(permits.value).toHaveLength(2)
      expect(permits.value.every((p) => p.status === 'ACTIVE')).toBe(true)
    })
  })
})
