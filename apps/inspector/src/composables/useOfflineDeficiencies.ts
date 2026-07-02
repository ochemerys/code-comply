/**
 * useOfflineDeficiencies - Vue composable for offline deficiency storage operations
 *
 * Provides CRUD operations for deficiencies stored in IndexedDB with:
 * - Dirty flag tracking for unsynced changes
 * - Integration with sync engine for automatic queuing
 * - Type-safe operations with full TypeScript support
 * - Reactive state management
 * - Support for Stop Work orders and critical deficiencies
 *
 * @module composables/useOfflineDeficiencies
 * @see M3-S9 - Create Offline Storage Composables
 * @see M6-S17 - Store Deficiencies in IndexedDB (sync queue + applyFromServer)
 * @see M3-S1 - Design Complete IndexedDB Schema with Dexie.js
 * @see M3-S3 - Create SyncEngine Core Class
 * @see LSC-A-04 (Deficiency Management) - Add/Edit/Delete deficiencies
 */

import { ref, computed, type Ref } from 'vue'
import { db } from '@/lib/db/dexie'
import {
  OfflineStorageQuotaError,
  isIndexedDbInvalidStateError,
  runWithIndexedDbQuotaRetry,
} from '@/lib/db/reclaim-storage'
import { syncEngine } from '@/lib/db/sync-engine'
import type { LocalDeficiency, DeficiencyStatus, DeficiencySeverity } from '@/lib/db/types'

/**
 * Options for filtering deficiencies
 */
export interface DeficiencyFilters {
  /** Filter by deficiency status */
  status?: DeficiencyStatus
  /** Filter by severity level */
  severity?: DeficiencySeverity
  /** Filter by inspection ID */
  inspectionId?: string
  /** Filter by checklist item ID */
  checklistItemId?: string
  /** Only return Stop Work orders */
  stopWorkOnly?: boolean
  /** Only return unsafe conditions */
  unsafeOnly?: boolean
  /** Only return dirty (unsynced) items */
  dirtyOnly?: boolean
}

/** How to resolve a dirty local row when the server sends a different version */
export type ApplyFromServerStrategy = 'server-wins' | 'keep-local-when-dirty'

/** Outcome of applying a server snapshot into IndexedDB */
export interface ApplyFromServerResult {
  /** Whether the local row was updated from the server payload */
  applied: boolean
  /** True when local had unsynced edits and the server version differed (etag or timestamps) */
  conflict: boolean
}

/**
 * Return type for useOfflineDeficiencies composable
 */
export interface UseOfflineDeficienciesReturn {
  /** Reactive array of deficiencies */
  deficiencies: Ref<LocalDeficiency[]>
  /** Loading state */
  isLoading: Ref<boolean>
  /** Error state */
  error: Ref<Error | null>
  /** Count of dirty (unsynced) deficiencies */
  dirtyCount: Ref<number>
  /** Count of open deficiencies */
  openCount: Ref<number>
  /** Count of Stop Work orders */
  stopWorkCount: Ref<number>
  /** Count of critical deficiencies */
  criticalCount: Ref<number>
  /** Get all deficiencies (optionally filtered) */
  getAll: (filters?: DeficiencyFilters) => Promise<LocalDeficiency[]>
  /** Get a single deficiency by ID */
  getById: (id: string) => Promise<LocalDeficiency | null>
  /** Get deficiencies by inspection ID */
  getByInspectionId: (inspectionId: string) => Promise<LocalDeficiency[]>
  /** Save a deficiency (create or update) */
  save: (deficiency: LocalDeficiency) => Promise<void>
  /** Delete a deficiency */
  delete: (id: string) => Promise<void>
  /** Mark a deficiency as dirty (needs sync) */
  markDirty: (id: string) => Promise<void>
  /** Get all dirty (unsynced) deficiencies */
  getDirtyItems: () => Promise<LocalDeficiency[]>
  /** Refresh the deficiencies list */
  refresh: (filters?: DeficiencyFilters) => Promise<void>
  /** Clear all deficiencies from local storage */
  clearAll: () => Promise<void>
  /**
   * Merge a server deficiency into IndexedDB (after pull or successful sync).
   * Handles optimistic concurrency: optional keep-local when dirty and server etag differs.
   */
  applyFromServer: (
    serverRow: LocalDeficiency,
    options?: { strategy?: ApplyFromServerStrategy },
  ) => Promise<ApplyFromServerResult>
}

/**
 * Vue composable for offline deficiency storage operations.
 *
 * Provides a reactive interface to IndexedDB deficiency storage with
 * automatic dirty flag tracking and sync engine integration.
 *
 * @example
 * ```typescript
 * import { useOfflineDeficiencies } from '@/composables/useOfflineDeficiencies'
 *
 * const {
 *   deficiencies,
 *   isLoading,
 *   error,
 *   dirtyCount,
 *   openCount,
 *   stopWorkCount,
 *   getAll,
 *   getById,
 *   getByInspectionId,
 *   save,
 *   markDirty,
 *   getDirtyItems
 * } = useOfflineDeficiencies()
 *
 * // Load all deficiencies
 * await getAll()
 *
 * // Filter by status
 * await getAll({ status: 'OPEN' })
 *
 * // Get deficiencies for an inspection
 * const inspectionDeficiencies = await getByInspectionId('insp-123')
 *
 * // Save a deficiency (marks as dirty)
 * await save({
 *   id: 'def-123',
 *   clientId: crypto.randomUUID(),
 *   inspectionId: 'insp-456',
 *   description: 'Missing fire extinguisher',
 *   severity: 'MAJOR',
 *   status: 'OPEN',
 *   // ...
 * })
 *
 * // Get all unsynced deficiencies
 * const dirty = await getDirtyItems()
 * console.log(`${dirtyCount.value} deficiencies need sync`)
 * ```
 *
 * @returns Object with reactive state and CRUD methods
 */
export function useOfflineDeficiencies(): UseOfflineDeficienciesReturn {
  // ─── Reactive State ──────────────────────────────────────────────────────

  const deficiencies = ref<LocalDeficiency[]>([])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  // ─── Computed Properties ─────────────────────────────────────────────────

  const dirtyCount = computed(() => {
    return deficiencies.value.filter((d) => d.isDirty === true).length
  })

  const openCount = computed(() => {
    return deficiencies.value.filter((d) => d.status === 'OPEN').length
  })

  const stopWorkCount = computed(() => {
    return deficiencies.value.filter((d) => d.isStopWork === true).length
  })

  const criticalCount = computed(() => {
    return deficiencies.value.filter((d) => d.severity === 'CRITICAL').length
  })

  // ─── Methods ─────────────────────────────────────────────────────────────

  /**
   * Get all deficiencies from IndexedDB, optionally filtered.
   *
   * @param filters - Optional filters to apply
   * @returns Array of deficiencies matching the filters
   */
  function matchesFilters(row: LocalDeficiency, filters: DeficiencyFilters): boolean {
    if (filters.status !== undefined && row.status !== filters.status) return false
    if (filters.severity !== undefined && row.severity !== filters.severity) return false
    if (filters.inspectionId !== undefined && row.inspectionId !== filters.inspectionId)
      return false
    if (filters.checklistItemId !== undefined && row.checklistItemId !== filters.checklistItemId)
      return false
    if (filters.stopWorkOnly === true && row.isStopWork !== true) return false
    if (filters.dirtyOnly === true && row.isDirty !== true) return false
    if (filters.unsafeOnly === true && row.isUnsafe !== true) return false
    return true
  }

  async function getAll(filters?: DeficiencyFilters): Promise<LocalDeficiency[]> {
    isLoading.value = true
    error.value = null

    try {
      let results = await db.deficiencies.toArray()

      if (filters && Object.keys(filters).length > 0) {
        results = results.filter((row) => matchesFilters(row, filters))
      }

      // Sort by created date (most recent first)
      results.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

      deficiencies.value = results
      return results
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to get deficiencies')
      error.value = errorObj
      console.error('[useOfflineDeficiencies] Error getting deficiencies:', errorObj)
      throw errorObj
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Get a single deficiency by ID.
   *
   * @param id - The deficiency ID
   * @returns The deficiency or null if not found
   */
  async function getById(id: string): Promise<LocalDeficiency | null> {
    isLoading.value = true
    error.value = null

    try {
      const deficiency = await db.deficiencies.get(id)
      return deficiency || null
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to get deficiency')
      error.value = errorObj
      console.error('[useOfflineDeficiencies] Error getting deficiency:', errorObj)
      throw errorObj
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Get all deficiencies for a specific inspection.
   *
   * @param inspectionId - The inspection ID
   * @returns Array of deficiencies for the inspection
   */
  async function getByInspectionId(inspectionId: string): Promise<LocalDeficiency[]> {
    isLoading.value = true
    error.value = null

    try {
      const results = await db.deficiencies.where('inspectionId').equals(inspectionId).toArray()

      // Sort by created date (most recent first)
      results.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

      return results
    } catch (err) {
      const errorObj =
        err instanceof Error ? err : new Error('Failed to get deficiencies by inspection')
      error.value = errorObj
      console.error('[useOfflineDeficiencies] Error getting deficiencies by inspection:', errorObj)
      throw errorObj
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Save a deficiency (create or update).
   * Automatically marks the deficiency as dirty and queues for sync.
   *
   * @param deficiency - The deficiency to save
   */
  async function save(deficiency: LocalDeficiency): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      // Ensure required fields
      if (!deficiency.id) {
        throw new Error('Deficiency ID is required')
      }

      if (!deficiency.clientId) {
        throw new Error('Deficiency clientId is required')
      }

      if (!deficiency.inspectionId) {
        throw new Error('Deficiency inspectionId is required')
      }

      if (!deficiency.description || deficiency.description.trim().length === 0) {
        throw new Error('Deficiency description is required')
      }

      // Check if deficiency exists
      const existing = await db.deficiencies.get(deficiency.id)

      // Prepare deficiency data
      const now = new Date().toISOString()
      const deficiencyData: LocalDeficiency = {
        ...deficiency,
        updatedAt: now,
        isDirty: true, // Always mark as dirty when saving
      }

      // Set createdAt if new
      if (!existing) {
        deficiencyData.createdAt = now
      }

      // Save to IndexedDB
      await db.deficiencies.put(deficiencyData)

      // Queue for sync
      const operation = existing ? 'deficiency.update' : 'deficiency.create'
      const priority = deficiency.isStopWork || deficiency.severity === 'CRITICAL' ? 1 : 10

      await syncEngine.queueMutation(operation, { ...deficiencyData }, priority)

      console.log(
        `[useOfflineDeficiencies] Saved deficiency ${deficiency.id} (${operation}, priority: ${priority})`,
      )

      // Update reactive state if this deficiency is in the list
      const index = deficiencies.value.findIndex((d) => d.id === deficiency.id)
      if (index !== -1) {
        deficiencies.value[index] = deficiencyData
      } else {
        deficiencies.value.push(deficiencyData)
      }
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to save deficiency')
      error.value = errorObj
      console.error('[useOfflineDeficiencies] Error saving deficiency:', errorObj)
      throw errorObj
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Delete a deficiency from local storage and queue for server deletion.
   *
   * @param id - The deficiency ID to delete
   */
  async function deleteDeficiency(id: string): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const deficiency = await db.deficiencies.get(id)

      if (!deficiency) {
        throw new Error(`Deficiency ${id} not found`)
      }

      // Delete from IndexedDB
      await db.deficiencies.delete(id)

      // Queue deletion for sync (if it was synced to server)
      if (deficiency.syncedAt) {
        await syncEngine.queueMutation('deficiency.delete', {
          clientId: deficiency.clientId,
          id: deficiency.id,
        })
      }

      console.log(`[useOfflineDeficiencies] Deleted deficiency ${id}`)

      // Update reactive state
      deficiencies.value = deficiencies.value.filter((d) => d.id !== id)
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to delete deficiency')
      error.value = errorObj
      console.error('[useOfflineDeficiencies] Error deleting deficiency:', errorObj)
      throw errorObj
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Mark a deficiency as dirty (needs sync).
   * Useful when making changes that should trigger a sync.
   *
   * @param id - The deficiency ID to mark as dirty
   */
  async function markDirty(id: string): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const deficiency = await db.deficiencies.get(id)

      if (!deficiency) {
        throw new Error(`Deficiency ${id} not found`)
      }

      // Update dirty flag and timestamp
      await db.deficiencies.update(id, {
        isDirty: true,
        updatedAt: new Date().toISOString(),
      })

      // Queue for sync
      const priority = deficiency.isStopWork || deficiency.severity === 'CRITICAL' ? 1 : 10

      await syncEngine.queueMutation(
        'deficiency.update',
        {
          clientId: deficiency.clientId,
          id: deficiency.id,
        },
        priority,
      )

      console.log(`[useOfflineDeficiencies] Marked deficiency ${id} as dirty`)

      // Update reactive state
      const index = deficiencies.value.findIndex((d) => d.id === id)
      if (index !== -1) {
        deficiencies.value[index].isDirty = true
        deficiencies.value[index].updatedAt = new Date().toISOString()
      }
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to mark deficiency as dirty')
      error.value = errorObj
      console.error('[useOfflineDeficiencies] Error marking deficiency as dirty:', errorObj)
      throw errorObj
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Get all dirty (unsynced) deficiencies.
   *
   * @returns Array of deficiencies that need to be synced
   */
  async function getDirtyItems(): Promise<LocalDeficiency[]> {
    isLoading.value = true
    error.value = null

    try {
      const dirtyDeficiencies = await db.deficiencies.where('isDirty').equals(1).toArray()

      // Sort by updated date (oldest first for FIFO sync)
      dirtyDeficiencies.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))

      return dirtyDeficiencies
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to get dirty deficiencies')
      error.value = errorObj
      console.error('[useOfflineDeficiencies] Error getting dirty deficiencies:', errorObj)
      throw errorObj
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Refresh the deficiencies list with optional filters.
   *
   * @param filters - Optional filters to apply
   */
  async function refresh(filters?: DeficiencyFilters): Promise<void> {
    await getAll(filters)
  }

  /**
   * Clear all deficiencies from local storage.
   * Use with caution - this is typically only used on logout or remote wipe.
   */
  async function clearAll(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      await db.deficiencies.clear()
      deficiencies.value = []
      console.log('[useOfflineDeficiencies] Cleared all deficiencies')
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to clear deficiencies')
      error.value = errorObj
      console.error('[useOfflineDeficiencies] Error clearing deficiencies:', errorObj)
      throw errorObj
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Apply a server snapshot to the local deficiencies table.
   * When the device is clean, the server row replaces local state and clears dirty.
   * When local is dirty and etags differ, {@link ApplyFromServerStrategy} chooses
   * whether the server wins (typical post-pull reconciliation) or the pending local row is kept.
   *
   * IndexedDB writes use a quota retry: on {@link DOMException} `QuotaExceededError`, refetchable
   * caches and synced photo blobs are reclaimed once, then the write is retried. Check `error`
   * or catch {@link OfflineStorageQuotaError} / `InvalidStateError` for UI messaging.
   */
  async function applyFromServer(
    serverRow: LocalDeficiency,
    options?: { strategy?: ApplyFromServerStrategy },
  ): Promise<ApplyFromServerResult> {
    isLoading.value = true
    error.value = null
    const strategy = options?.strategy ?? 'server-wins'

    try {
      const local = await runWithIndexedDbQuotaRetry(() => db.deficiencies.get(serverRow.id))
      const now = new Date().toISOString()

      const merged: LocalDeficiency = {
        ...serverRow,
        clientId: local?.clientId ?? serverRow.clientId,
        syncedAt: now,
        isDirty: false,
      }

      if (!local) {
        await runWithIndexedDbQuotaRetry(() => db.deficiencies.put(merged))
        const idx = deficiencies.value.findIndex((d) => d.id === serverRow.id)
        if (idx !== -1) deficiencies.value[idx] = merged
        else deficiencies.value.push(merged)
        return { applied: true, conflict: false }
      }

      const etagConflict =
        local.etag !== undefined && serverRow.etag !== undefined && local.etag !== serverRow.etag

      if (local.isDirty && etagConflict && strategy === 'keep-local-when-dirty') {
        return { applied: false, conflict: true }
      }

      await runWithIndexedDbQuotaRetry(() => db.deficiencies.put(merged))

      const index = deficiencies.value.findIndex((d) => d.id === serverRow.id)
      if (index !== -1) {
        deficiencies.value[index] = merged
      }

      return {
        applied: true,
        conflict: local.isDirty && etagConflict,
      }
    } catch (err) {
      if (err instanceof OfflineStorageQuotaError) {
        error.value = err
        console.error('[useOfflineDeficiencies] IndexedDB quota exceeded after reclaim:', err)
        throw err
      }
      if (isIndexedDbInvalidStateError(err)) {
        const errorObj = new Error(
          'Local database is unavailable. Try reloading the page.',
        ) as Error & {
          cause?: unknown
        }
        errorObj.cause = err
        error.value = errorObj
        console.error('[useOfflineDeficiencies] IndexedDB unavailable:', errorObj)
        throw errorObj
      }
      const errorObj = err instanceof Error ? err : new Error('Failed to apply server deficiency')
      error.value = errorObj
      console.error('[useOfflineDeficiencies] Error applying server row:', errorObj)
      throw errorObj
    } finally {
      isLoading.value = false
    }
  }

  // ─── Return Public API ───────────────────────────────────────────────────

  return {
    // Reactive state
    deficiencies,
    isLoading,
    error,
    dirtyCount,
    openCount,
    stopWorkCount,
    criticalCount,

    // Methods
    getAll,
    getById,
    getByInspectionId,
    save,
    delete: deleteDeficiency,
    markDirty,
    getDirtyItems,
    refresh,
    clearAll,
    applyFromServer,
  }
}
