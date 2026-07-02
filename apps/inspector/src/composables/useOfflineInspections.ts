/**
 * useOfflineInspections - Vue composable for offline inspection storage operations
 *
 * Provides CRUD operations for inspections stored in IndexedDB with:
 * - Dirty flag tracking for unsynced changes
 * - Integration with sync engine for automatic queuing
 * - Type-safe operations with full TypeScript support
 * - Reactive state management
 *
 * @module composables/useOfflineInspections
 * @see M3-S9 - Create Offline Storage Composables
 * @see M3-S1 - Design Complete IndexedDB Schema with Dexie.js
 * @see M3-S3 - Create SyncEngine Core Class
 */

import { ref, computed, type Ref } from 'vue'
import { db } from '@/lib/db/dexie'
import { syncEngine } from '@/lib/db/sync-engine'
import type { LocalInspection, InspectionStatus } from '@/lib/db/types'

/**
 * Options for filtering inspections
 */
export interface InspectionFilters {
  /** Filter by inspection status */
  status?: InspectionStatus
  /** Filter by assigned inspector ID */
  assignedToId?: string
  /** Filter by permit ID */
  permitId?: string
  /** Filter by date range (scheduled date) */
  dateFrom?: string
  dateTo?: string
  /** Only return dirty (unsynced) items */
  dirtyOnly?: boolean
}

/**
 * Return type for useOfflineInspections composable
 */
export interface UseOfflineInspectionsReturn {
  /** Reactive array of inspections */
  inspections: Ref<LocalInspection[]>
  /** Loading state */
  isLoading: Ref<boolean>
  /** Error state */
  error: Ref<Error | null>
  /** Count of dirty (unsynced) inspections */
  dirtyCount: Ref<number>
  /** Get all inspections (optionally filtered) */
  getAll: (filters?: InspectionFilters) => Promise<LocalInspection[]>
  /** Get a single inspection by ID */
  getById: (id: string) => Promise<LocalInspection | null>
  /** Save an inspection (create or update) */
  save: (inspection: LocalInspection) => Promise<void>
  /** Delete an inspection */
  delete: (id: string) => Promise<void>
  /** Mark an inspection as dirty (needs sync) */
  markDirty: (id: string) => Promise<void>
  /** Get all dirty (unsynced) inspections */
  getDirtyItems: () => Promise<LocalInspection[]>
  /** Refresh the inspections list */
  refresh: (filters?: InspectionFilters) => Promise<void>
  /** Clear all inspections from local storage */
  clearAll: () => Promise<void>
}

/**
 * Vue composable for offline inspection storage operations.
 *
 * Provides a reactive interface to IndexedDB inspection storage with
 * automatic dirty flag tracking and sync engine integration.
 *
 * @example
 * ```typescript
 * import { useOfflineInspections } from '@/composables/useOfflineInspections'
 *
 * const {
 *   inspections,
 *   isLoading,
 *   error,
 *   dirtyCount,
 *   getAll,
 *   getById,
 *   save,
 *   markDirty,
 *   getDirtyItems
 * } = useOfflineInspections()
 *
 * // Load all inspections
 * await getAll()
 *
 * // Filter by status
 * await getAll({ status: 'SCHEDULED' })
 *
 * // Get a specific inspection
 * const inspection = await getById('insp-123')
 *
 * // Save an inspection (marks as dirty)
 * await save({
 *   id: 'insp-123',
 *   clientId: crypto.randomUUID(),
 *   status: 'IN_PROGRESS',
 *   // ...
 * })
 *
 * // Get all unsynced inspections
 * const dirty = await getDirtyItems()
 * console.log(`${dirtyCount.value} inspections need sync`)
 * ```
 *
 * @returns Object with reactive state and CRUD methods
 */
export function useOfflineInspections(): UseOfflineInspectionsReturn {
  // ─── Reactive State ──────────────────────────────────────────────────────

  const inspections = ref<LocalInspection[]>([])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  // ─── Computed Properties ─────────────────────────────────────────────────

  const dirtyCount = computed(() => {
    return inspections.value.filter((i) => i.isDirty === true).length
  })

  // ─── Methods ─────────────────────────────────────────────────────────────

  /**
   * Get all inspections from IndexedDB, optionally filtered.
   *
   * @param filters - Optional filters to apply
   * @returns Array of inspections matching the filters
   */
  async function getAll(filters?: InspectionFilters): Promise<LocalInspection[]> {
    isLoading.value = true
    error.value = null

    try {
      let query = db.inspections.toCollection()

      // Apply filters
      if (filters) {
        if (filters.status) {
          query = db.inspections.where('status').equals(filters.status)
        }

        if (filters.assignedToId) {
          query = db.inspections.where('assignedToId').equals(filters.assignedToId)
        }

        if (filters.permitId) {
          query = db.inspections.where('permitId').equals(filters.permitId)
        }

        if (filters.dirtyOnly) {
          query = db.inspections.where('isDirty').equals(1)
        }
      }

      let results = await query.toArray()

      // Apply date range filter (not indexed, so filter in memory)
      if (filters?.dateFrom || filters?.dateTo) {
        results = results.filter((inspection) => {
          const scheduledDate = inspection.scheduledDate
          if (filters.dateFrom && scheduledDate < filters.dateFrom) return false
          if (filters.dateTo && scheduledDate > filters.dateTo) return false
          return true
        })
      }

      // Sort by scheduled date (most recent first)
      results.sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))

      inspections.value = results
      return results
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to get inspections')
      error.value = errorObj
      console.error('[useOfflineInspections] Error getting inspections:', errorObj)
      throw errorObj
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Get a single inspection by ID.
   *
   * @param id - The inspection ID
   * @returns The inspection or null if not found
   */
  async function getById(id: string): Promise<LocalInspection | null> {
    isLoading.value = true
    error.value = null

    try {
      const inspection = await db.inspections.get(id)
      return inspection || null
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to get inspection')
      error.value = errorObj
      console.error('[useOfflineInspections] Error getting inspection:', errorObj)
      throw errorObj
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Save an inspection (create or update).
   * Automatically marks the inspection as dirty and queues for sync.
   *
   * @param inspection - The inspection to save
   */
  async function save(inspection: LocalInspection): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      // Ensure required fields
      if (!inspection.id) {
        throw new Error('Inspection ID is required')
      }

      if (!inspection.clientId) {
        throw new Error('Inspection clientId is required')
      }

      // Check if inspection exists
      const existing = await db.inspections.get(inspection.id)

      // Prepare inspection data
      const now = new Date().toISOString()
      const inspectionData: LocalInspection = {
        ...inspection,
        updatedAt: now,
        isDirty: true, // Always mark as dirty when saving
      }

      // Set createdAt if new
      if (!existing) {
        inspectionData.createdAt = now
      }

      // Save to IndexedDB
      await db.inspections.put(inspectionData)

      // Queue for sync
      const operation = existing ? 'inspection.update' : 'inspection.create'
      await syncEngine.queueMutation(operation, {
        ...inspection,
      })

      console.log(`[useOfflineInspections] Saved inspection ${inspection.id} (${operation})`)

      // Update reactive state if this inspection is in the list
      const index = inspections.value.findIndex((i) => i.id === inspection.id)
      if (index !== -1) {
        inspections.value[index] = inspectionData
      } else {
        inspections.value.push(inspectionData)
      }
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to save inspection')
      error.value = errorObj
      console.error('[useOfflineInspections] Error saving inspection:', errorObj)
      throw errorObj
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Delete an inspection from local storage.
   * Note: This does not delete from the server. Use with caution.
   *
   * @param id - The inspection ID to delete
   */
  async function deleteInspection(id: string): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      await db.inspections.delete(id)

      console.log(`[useOfflineInspections] Deleted inspection ${id}`)

      // Update reactive state
      inspections.value = inspections.value.filter((i) => i.id !== id)
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to delete inspection')
      error.value = errorObj
      console.error('[useOfflineInspections] Error deleting inspection:', errorObj)
      throw errorObj
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Mark an inspection as dirty (needs sync).
   * Useful when making changes that should trigger a sync.
   *
   * @param id - The inspection ID to mark as dirty
   */
  async function markDirty(id: string): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const inspection = await db.inspections.get(id)

      if (!inspection) {
        throw new Error(`Inspection ${id} not found`)
      }

      // Update dirty flag and timestamp
      await db.inspections.update(id, {
        isDirty: true,
        updatedAt: new Date().toISOString(),
      })

      // Queue for sync
      await syncEngine.queueMutation('inspection.update', {
        clientId: inspection.clientId,
        id: inspection.id,
      })

      console.log(`[useOfflineInspections] Marked inspection ${id} as dirty`)

      // Update reactive state
      const index = inspections.value.findIndex((i) => i.id === id)
      if (index !== -1) {
        inspections.value[index].isDirty = true
        inspections.value[index].updatedAt = new Date().toISOString()
      }
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to mark inspection as dirty')
      error.value = errorObj
      console.error('[useOfflineInspections] Error marking inspection as dirty:', errorObj)
      throw errorObj
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Get all dirty (unsynced) inspections.
   *
   * @returns Array of inspections that need to be synced
   */
  async function getDirtyItems(): Promise<LocalInspection[]> {
    isLoading.value = true
    error.value = null

    try {
      const dirtyInspections = await db.inspections.where('isDirty').equals(1).toArray()

      // Sort by updated date (oldest first for FIFO sync)
      dirtyInspections.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))

      return dirtyInspections
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to get dirty inspections')
      error.value = errorObj
      console.error('[useOfflineInspections] Error getting dirty inspections:', errorObj)
      throw errorObj
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Refresh the inspections list with optional filters.
   *
   * @param filters - Optional filters to apply
   */
  async function refresh(filters?: InspectionFilters): Promise<void> {
    await getAll(filters)
  }

  /**
   * Clear all inspections from local storage.
   * Use with caution - this is typically only used on logout or remote wipe.
   */
  async function clearAll(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      await db.inspections.clear()
      inspections.value = []
      console.log('[useOfflineInspections] Cleared all inspections')
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to clear inspections')
      error.value = errorObj
      console.error('[useOfflineInspections] Error clearing inspections:', errorObj)
      throw errorObj
    } finally {
      isLoading.value = false
    }
  }

  // ─── Return Public API ───────────────────────────────────────────────────

  return {
    // Reactive state
    inspections,
    isLoading,
    error,
    dirtyCount,

    // Methods
    getAll,
    getById,
    save,
    delete: deleteInspection,
    markDirty,
    getDirtyItems,
    refresh,
    clearAll,
  }
}
