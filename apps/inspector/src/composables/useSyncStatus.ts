/**
 * useSyncStatus - Composable for sync status management
 *
 * Provides reactive sync status information and manual sync trigger.
 * Integrates with SyncEngine to provide real-time updates.
 *
 * @module composables/useSyncStatus
 * @see M3-S5 - Create Sync Status Indicator Components
 * @see M-03 (Offline Workflow) - Sync status indicators
 */

import { ref, computed, onUnmounted } from 'vue'
import { syncEngine } from '@/lib/db/sync-engine'
import { isEncryptionServiceInitialized } from '@/lib/db/encryption'
import type { SyncEngineStatus, SyncEvent } from '@/lib/db/sync-engine'

/**
 * Sync status state
 */
export type SyncStatusState = 'online' | 'offline' | 'syncing' | 'error'

/**
 * Composable return type
 */
export interface UseSyncStatusReturn {
  /** Current sync status state */
  status: import('vue').ComputedRef<SyncStatusState>
  /** Whether device is online */
  isOnline: import('vue').Ref<boolean>
  /** Whether sync is in progress */
  isSyncing: import('vue').Ref<boolean>
  /** Number of pending items in queue */
  pendingCount: import('vue').Ref<number>
  /** Number of failed items in queue */
  failedCount: import('vue').Ref<number>
  /** Conflicts reconciled during the last sync pass */
  conflictCount: import('vue').Ref<number>
  /** Last sync timestamp */
  lastSyncedAt: import('vue').Ref<Date | null>
  /** Last error message */
  lastError: import('vue').Ref<string | null>
  /** Trigger manual sync */
  triggerSync: () => Promise<void>
  /** Retry failed items */
  retryFailed: () => Promise<void>
  /** Clear failed items */
  clearFailed: () => Promise<void>
}

/**
 * Composable for sync status management.
 *
 * Provides reactive sync status information and manual sync trigger.
 * Automatically updates when sync events occur.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useSyncStatus } from '@/composables/useSyncStatus'
 *
 * const {
 *   status,
 *   isOnline,
 *   isSyncing,
 *   pendingCount,
 *   failedCount,
 *   lastSyncedAt,
 *   triggerSync,
 * } = useSyncStatus()
 * </script>
 *
 * <template>
 *   <div>
 *     <p>Status: {{ status }}</p>
 *     <p>Pending: {{ pendingCount }}</p>
 *     <button @click="triggerSync" :disabled="isSyncing">
 *       Sync Now
 *     </button>
 *   </div>
 * </template>
 * ```
 */
export function useSyncStatus(): UseSyncStatusReturn {
  // ─── State ────────────────────────────────────────────────────��──────────

  const isOnline = ref(true)
  const isSyncing = ref(false)
  const pendingCount = ref(0)
  const failedCount = ref(0)
  const conflictCount = ref(0)
  const lastSyncedAt = ref<Date | null>(null)
  const lastError = ref<string | null>(null)
  let statusVersion = 0

  // ─── Computed ────────────────────────────────────────────────────────────

  /**
   * Current sync status state.
   * Determines the overall status based on online/syncing/error states.
   */
  const status = computed<SyncStatusState>(() => {
    if (!isOnline.value) return 'offline'
    if (lastError.value) return 'error'
    if (isSyncing.value) return 'syncing'
    return 'online'
  })

  // ─── Methods ─────────────────────────────────────────────────────────────

  function applyStatus(
    engineStatus: SyncEngineStatus,
    totalQueueSize = engineStatus.queueSize,
  ): void {
    isOnline.value = engineStatus.isOnline
    isSyncing.value = engineStatus.isSyncing
    pendingCount.value = engineStatus.queueSize
    conflictCount.value = engineStatus.conflictCount
    lastSyncedAt.value = engineStatus.lastSyncedAt
    lastError.value = engineStatus.lastError
    failedCount.value = totalQueueSize - engineStatus.queueSize
  }

  function applyStatusWithoutQueue(): void {
    applyStatus(syncEngine.getStatus(), 0)
  }

  function isEncryptionUnavailableError(error: unknown): boolean {
    return error instanceof Error && error.message.includes('EncryptionService not initialized')
  }

  function markStatusChanged(): void {
    statusVersion += 1
  }

  /**
   * Update status from sync engine.
   */
  async function updateStatus(): Promise<void> {
    const requestVersion = ++statusVersion

    if (!isEncryptionServiceInitialized()) {
      if (requestVersion !== statusVersion) return
      applyStatusWithoutQueue()
      return
    }

    try {
      const engineStatus = await syncEngine.getStatusAsync()
      const totalQueueSize = await syncEngine.getTotalQueueSize()
      if (requestVersion !== statusVersion) return
      applyStatus(engineStatus, totalQueueSize)
    } catch (error) {
      if (isEncryptionUnavailableError(error)) {
        if (requestVersion !== statusVersion) return
        applyStatusWithoutQueue()
        return
      }
      throw error
    }
  }

  function updateStatusSafely(): void {
    void updateStatus().catch((error) => {
      console.error('[useSyncStatus] Failed to update status:', error)
    })
  }

  /**
   * Trigger manual sync.
   */
  async function triggerSync(): Promise<void> {
    if (!isOnline.value || isSyncing.value) {
      return
    }

    try {
      await syncEngine.sync()
    } catch (error) {
      console.error('[useSyncStatus] Manual sync failed:', error)
    }
  }

  /**
   * Retry all failed items.
   */
  async function retryFailed(): Promise<void> {
    try {
      const count = await syncEngine.retryFailedItems()
      console.log(`[useSyncStatus] Retrying ${count} failed items`)
      await updateStatus()
    } catch (error) {
      console.error('[useSyncStatus] Retry failed:', error)
    }
  }

  /**
   * Clear all failed items from queue.
   */
  async function clearFailed(): Promise<void> {
    try {
      const count = await syncEngine.clearFailedItems()
      console.log(`[useSyncStatus] Cleared ${count} failed items`)
      await updateStatus()
    } catch (error) {
      console.error('[useSyncStatus] Clear failed:', error)
    }
  }

  // ─── Event Handlers ────────────────────────────────────��─────────────────

  /**
   * Handle sync start event.
   */
  function handleSyncStart(event: SyncEvent): void {
    console.log('[useSyncStatus] Sync started:', event.timestamp)
    markStatusChanged()
    isSyncing.value = true
    lastError.value = null
  }

  /**
   * Handle sync complete event.
   */
  function handleSyncComplete(event: SyncEvent): void {
    console.log('[useSyncStatus] Sync completed:', event.timestamp)
    markStatusChanged()
    isSyncing.value = false
    lastSyncedAt.value = event.timestamp
    lastError.value = null
    pendingCount.value = event.data?.queueSize ?? 0
  }

  /**
   * Handle sync error event.
   */
  function handleSyncError(event: SyncEvent): void {
    console.error('[useSyncStatus] Sync error:', event.data?.error)
    markStatusChanged()
    isSyncing.value = false
    lastError.value = event.data?.error ?? 'Unknown sync error'
  }

  /**
   * Handle online event.
   */
  function handleOnline(event: SyncEvent): void {
    console.log('[useSyncStatus] Device online:', event.timestamp)
    markStatusChanged()
    isOnline.value = true
    lastError.value = null
  }

  /**
   * Handle offline event.
   */
  function handleOffline(event: SyncEvent): void {
    console.log('[useSyncStatus] Device offline:', event.timestamp)
    markStatusChanged()
    isOnline.value = false
  }

  /**
   * Handle queue add event.
   */
  function handleQueueAdd(event: SyncEvent): void {
    markStatusChanged()
    pendingCount.value = event.data?.queueSize ?? pendingCount.value + 1
  }

  /**
   * Handle queue clear event.
   */
  function handleQueueClear(_event: SyncEvent): void {
    markStatusChanged()
    pendingCount.value = 0
    failedCount.value = 0
    conflictCount.value = 0
  }

  function handleItemConflict(_event: SyncEvent): void {
    updateStatusSafely()
  }

  /**
   * Handle item error event.
   */
  function handleItemError(_event: SyncEvent): void {
    // Update failed count
    updateStatusSafely()
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  // Initial status update (called immediately, not waiting for mount)
  updateStatusSafely()

  // Register event listeners immediately
  syncEngine.on('sync:start', handleSyncStart)
  syncEngine.on('sync:complete', handleSyncComplete)
  syncEngine.on('sync:error', handleSyncError)
  syncEngine.on('online', handleOnline)
  syncEngine.on('offline', handleOffline)
  syncEngine.on('sync:queue:add', handleQueueAdd)
  syncEngine.on('sync:queue:clear', handleQueueClear)
  syncEngine.on('sync:item:success', handleItemConflict)
  syncEngine.on('sync:item:retry', handleItemError)
  syncEngine.on('sync:item:error', handleItemError)
  syncEngine.on('sync:item:conflict', handleItemConflict)

  onUnmounted(() => {
    // Unregister event listeners
    syncEngine.off('sync:start', handleSyncStart)
    syncEngine.off('sync:complete', handleSyncComplete)
    syncEngine.off('sync:error', handleSyncError)
    syncEngine.off('online', handleOnline)
    syncEngine.off('offline', handleOffline)
    syncEngine.off('sync:queue:add', handleQueueAdd)
    syncEngine.off('sync:queue:clear', handleQueueClear)
    syncEngine.off('sync:item:success', handleItemConflict)
    syncEngine.off('sync:item:retry', handleItemError)
    syncEngine.off('sync:item:error', handleItemError)
    syncEngine.off('sync:item:conflict', handleItemConflict)
  })

  // ─── Return ──────────────────────────────────────────────────────────────

  return {
    status,
    isOnline,
    isSyncing,
    pendingCount,
    failedCount,
    conflictCount,
    lastSyncedAt,
    lastError,
    triggerSync,
    retryFailed,
    clearFailed,
  }
}
