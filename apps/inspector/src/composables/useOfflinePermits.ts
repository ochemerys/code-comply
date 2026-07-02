/**
 * useOfflinePermits - Vue composable for offline permit storage operations
 *
 * Provides CRUD operations for permits stored in IndexedDB with:
 * - Sync tracking for permit data
 * - Integration with sync engine for automatic updates
 * - Type-safe operations with full TypeScript support
 * - Reactive state management
 * - Support for offline search and viewing
 *
 * @module composables/useOfflinePermits
 * @see M4-S12 - Sync Permits to IndexedDB for Offline Access
 * @see M3-S1 - Design Complete IndexedDB Schema with Dexie.js
 * @see M-02 (Site & Permit Retrieval) - Local search by Permit Number or Address
 */

import { ref, computed, type Ref } from 'vue'
import { db } from '@/lib/db/dexie'
import { syncEngine } from '@/lib/db/sync-engine'
import type { LocalPermit } from '@/lib/db/types'

/**
 * Options for filtering permits
 */
export interface PermitFilters {
  /** Filter by permit status */
  status?: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'
  /** Filter by permit number (partial match) */
  permitNumber?: string
  /** Filter by address (partial match) */
  address?: string
  /** Filter by distance (max distance in meters) */
  maxDistance?: number
  /** Filter by next inspection date range */
  dateFrom?: string
  dateTo?: string
}

/**
 * Return type for useOfflinePermits composable
 */
export interface UseOfflinePermitsReturn {
  /** Reactive array of permits */
  permits: Ref<LocalPermit[]>
  /** Loading state */
  isLoading: Ref<boolean>
  /** Error state */
  error: Ref<Error | null>
  /** Count of total permits in cache */
  totalCount: Ref<number>
  /** Count of active permits */
  activeCount: Ref<number>
  /** Last sync timestamp */
  lastSyncedAt: Ref<string | null>
  /** Get all permits (optionally filtered) */
  getAll: (filters?: PermitFilters) => Promise<LocalPermit[]>
  /** Get a single permit by ID */
  getById: (id: string) => Promise<LocalPermit | null>
  /** Get a permit by permit number */
  getByPermitNumber: (permitNumber: string) => Promise<LocalPermit | null>
  /** Search permits by permit number or address */
  search: (query: string) => Promise<LocalPermit[]>
  /** Save a permit (create or update) */
  save: (permit: LocalPermit) => Promise<void>
  /** Save multiple permits (bulk operation) */
  saveMany: (permits: LocalPermit[]) => Promise<void>
  /** Delete a permit */
  delete: (id: string) => Promise<void>
  /** Refresh the permits list */
  refresh: (filters?: PermitFilters) => Promise<void>
  /** Clear all permits from local storage */
  clearAll: () => Promise<void>
  /** Sync permits from server */
  syncFromServer: () => Promise<void>
}

/**
 * Vue composable for offline permit storage operations.
 *
 * Provides a reactive interface to IndexedDB permit storage with
 * automatic sync tracking and search capabilities.
 *
 * @example
 * ```typescript
 * import { useOfflinePermits } from '@/composables/useOfflinePermits'
 *
 * const {
 *   permits,
 *   isLoading,
 *   error,
 *   totalCount,
 *   activeCount,
 *   getAll,
 *   getById,
 *   search,
 *   syncFromServer
 * } = useOfflinePermits()
 *
 * // Load all permits
 * await getAll()
 *
 * // Filter by status
 * await getAll({ status: 'ACTIVE' })
 *
 * // Search by permit number or address
 * const results = await search('BP-2024')
 *
 * // Get a specific permit
 * const permit = await getById('permit-123')
 *
 * // Sync from server
 * await syncFromServer()
 *
 * console.log(`${totalCount.value} permits cached, ${activeCount.value} active`)
 * ```
 *
 * @returns Object with reactive state and CRUD methods
 */
export function useOfflinePermits(): UseOfflinePermitsReturn {
  // ─── Reactive State ──────────────────────────────────────────────────────

  const permits = ref<LocalPermit[]>([])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)
  const lastSyncedAt = ref<string | null>(null)

  // ─── Computed Properties ─────────────────────────────────────────────────

  const totalCount = computed(() => permits.value.length)

  const activeCount = computed(() => {
    return permits.value.filter((p) => p.status === 'ACTIVE').length
  })

  // ─── Methods ─────────────────────────────────────────────────────────────

  /**
   * Get all permits from IndexedDB, optionally filtered.
   *
   * @param filters - Optional filters to apply
   * @returns Array of permits matching the filters
   */
  async function getAll(filters?: PermitFilters): Promise<LocalPermit[]> {
    isLoading.value = true
    error.value = null

    try {
      let query = db.permits.toCollection()

      // Apply indexed filters
      if (filters?.status) {
        query = db.permits.where('status').equals(filters.status)
      }

      let results = await query.toArray()

      // Apply non-indexed filters in memory
      if (filters) {
        if (filters.permitNumber) {
          const searchTerm = filters.permitNumber.toLowerCase()
          results = results.filter((p) => p.permitNumber.toLowerCase().includes(searchTerm))
        }

        if (filters.address) {
          const searchTerm = filters.address.toLowerCase()
          results = results.filter((p) => p.address.toLowerCase().includes(searchTerm))
        }

        if (filters.maxDistance !== undefined) {
          results = results.filter(
            (p) => p.distance !== undefined && p.distance <= filters.maxDistance!,
          )
        }

        if (filters.dateFrom || filters.dateTo) {
          results = results.filter((p) => {
            if (!p.nextInspectionDate) return false
            if (filters.dateFrom && p.nextInspectionDate < filters.dateFrom) return false
            if (filters.dateTo && p.nextInspectionDate > filters.dateTo) return false
            return true
          })
        }
      }

      // Sort by permit number
      results.sort((a, b) => a.permitNumber.localeCompare(b.permitNumber))

      permits.value = results
      return results
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to get permits')
      error.value = errorObj
      console.error('[useOfflinePermits] Error getting permits:', errorObj)
      throw errorObj
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Get a single permit by ID.
   *
   * @param id - The permit ID
   * @returns The permit or null if not found
   */
  async function getById(id: string): Promise<LocalPermit | null> {
    isLoading.value = true
    error.value = null

    try {
      const permit = await db.permits.get(id)
      return permit || null
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to get permit')
      error.value = errorObj
      console.error('[useOfflinePermits] Error getting permit:', errorObj)
      throw errorObj
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Get a permit by permit number.
   *
   * @param permitNumber - The permit number to search for
   * @returns The permit or null if not found
   */
  async function getByPermitNumber(permitNumber: string): Promise<LocalPermit | null> {
    isLoading.value = true
    error.value = null

    try {
      const permit = await db.permits.where('permitNumber').equals(permitNumber).first()
      return permit || null
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to get permit by number')
      error.value = errorObj
      console.error('[useOfflinePermits] Error getting permit by number:', errorObj)
      throw errorObj
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Search permits by permit number or address (case-insensitive partial match).
   *
   * @param query - Search query string
   * @returns Array of permits matching the query
   */
  async function search(query: string): Promise<LocalPermit[]> {
    isLoading.value = true
    error.value = null

    try {
      if (!query || query.trim().length === 0) {
        return []
      }

      const searchTerm = query.toLowerCase().trim()
      const allPermits = await db.permits.toArray()

      const results = allPermits.filter((permit) => {
        const permitNumberMatch = permit.permitNumber.toLowerCase().includes(searchTerm)
        const addressMatch = permit.address.toLowerCase().includes(searchTerm)
        return permitNumberMatch || addressMatch
      })

      // Sort by relevance (exact matches first, then partial matches)
      results.sort((a, b) => {
        const aPermitExact = a.permitNumber.toLowerCase() === searchTerm
        const bPermitExact = b.permitNumber.toLowerCase() === searchTerm
        if (aPermitExact && !bPermitExact) return -1
        if (!aPermitExact && bPermitExact) return 1

        const aPermitStarts = a.permitNumber.toLowerCase().startsWith(searchTerm)
        const bPermitStarts = b.permitNumber.toLowerCase().startsWith(searchTerm)
        if (aPermitStarts && !bPermitStarts) return -1
        if (!aPermitStarts && bPermitStarts) return 1

        return a.permitNumber.localeCompare(b.permitNumber)
      })

      return results
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to search permits')
      error.value = errorObj
      console.error('[useOfflinePermits] Error searching permits:', errorObj)
      throw errorObj
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Save a permit (create or update).
   * Updates the updatedAt timestamp automatically.
   *
   * @param permit - The permit to save
   */
  async function save(permit: LocalPermit): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      // Ensure required fields
      if (!permit.id) {
        throw new Error('Permit ID is required')
      }

      if (!permit.permitNumber) {
        throw new Error('Permit number is required')
      }

      // Check if permit exists
      const existing = await db.permits.get(permit.id)

      // Prepare permit data with updated timestamp
      const permitData: LocalPermit = {
        ...permit,
        updatedAt: new Date().toISOString(),
      }

      // Save to IndexedDB
      await db.permits.put(permitData)

      const operation = existing ? 'update' : 'create'
      console.log(`[useOfflinePermits] Saved permit ${permit.id} (${operation})`)

      // Update reactive state if this permit is in the list
      const index = permits.value.findIndex((p) => p.id === permit.id)
      if (index !== -1) {
        permits.value[index] = permitData
      } else {
        permits.value.push(permitData)
      }
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to save permit')
      error.value = errorObj
      console.error('[useOfflinePermits] Error saving permit:', errorObj)
      throw errorObj
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Save multiple permits in a single transaction (bulk operation).
   * Useful for initial sync or delta sync operations.
   *
   * @param permitsList - Array of permits to save
   */
  async function saveMany(permitsList: LocalPermit[]): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      if (permitsList.length === 0) {
        return
      }

      // Validate all permits
      for (const permit of permitsList) {
        if (!permit.id) {
          throw new Error('All permits must have an ID')
        }
        if (!permit.permitNumber) {
          throw new Error('All permits must have a permit number')
        }
      }

      // Update timestamps
      const now = new Date().toISOString()
      const permitsWithTimestamps = permitsList.map((permit) => ({
        ...permit,
        updatedAt: now,
      }))

      // Bulk save to IndexedDB
      await db.permits.bulkPut(permitsWithTimestamps)

      console.log(`[useOfflinePermits] Saved ${permitsList.length} permits (bulk operation)`)

      // Update last synced timestamp
      lastSyncedAt.value = now

      // Refresh the permits list
      await getAll()
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to save permits')
      error.value = errorObj
      console.error('[useOfflinePermits] Error saving permits:', errorObj)
      throw errorObj
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Delete a permit from local storage.
   *
   * @param id - The permit ID to delete
   */
  async function deletePermit(id: string): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      await db.permits.delete(id)

      console.log(`[useOfflinePermits] Deleted permit ${id}`)

      // Update reactive state
      permits.value = permits.value.filter((p) => p.id !== id)
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to delete permit')
      error.value = errorObj
      console.error('[useOfflinePermits] Error deleting permit:', errorObj)
      throw errorObj
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Refresh the permits list with optional filters.
   *
   * @param filters - Optional filters to apply
   */
  async function refresh(filters?: PermitFilters): Promise<void> {
    await getAll(filters)
  }

  /**
   * Clear all permits from local storage.
   * Use with caution - this is typically only used on logout or remote wipe.
   */
  async function clearAll(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      await db.permits.clear()
      permits.value = []
      lastSyncedAt.value = null
      console.log('[useOfflinePermits] Cleared all permits')
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to clear permits')
      error.value = errorObj
      console.error('[useOfflinePermits] Error clearing permits:', errorObj)
      throw errorObj
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Sync permits from server.
   * This method should be called on app load and periodically in the background.
   * It queues a sync operation that will be processed by the sync engine.
   */
  async function syncFromServer(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      // Queue a sync operation for permits
      await syncEngine.queueMutation('permit.sync', {
        lastSyncedAt: lastSyncedAt.value,
        syncType: 'delta', // Use delta sync if we have a last sync timestamp
      })

      console.log('[useOfflinePermits] Queued permit sync operation')
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to sync permits')
      error.value = errorObj
      console.error('[useOfflinePermits] Error syncing permits:', errorObj)
      throw errorObj
    } finally {
      isLoading.value = false
    }
  }

  // ─── Return Public API ───────────────────────────────────────────────────

  return {
    // Reactive state
    permits,
    isLoading,
    error,
    totalCount,
    activeCount,
    lastSyncedAt,

    // Methods
    getAll,
    getById,
    getByPermitNumber,
    search,
    save,
    saveMany,
    delete: deletePermit,
    refresh,
    clearAll,
    syncFromServer,
  }
}
