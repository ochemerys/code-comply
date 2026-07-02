/**
 * SyncEngine - Core synchronization engine for offline-first data management
 *
 * Manages the offline queue, retry logic, and synchronization with the server.
 * Implements exponential backoff retry, conflict detection, and event emission
 * for UI updates.
 *
 * @module lib/db/sync-engine
 * @see M3-S3 - Create SyncEngine Core Class
 * @see M-03 (Offline Workflow) - Sync up, conflict resolution
 */

import * as Sentry from '@sentry/vue'
import { db } from './dexie'
import type { SyncQueueItem, SyncOperation } from './types'

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Sync engine status information
 */
export interface SyncEngineStatus {
  /** Whether the device is currently online */
  isOnline: boolean
  /** Whether a sync operation is currently in progress */
  isSyncing: boolean
  /** Number of items in the sync queue */
  queueSize: number
  /** Conflicts reconciled in the current or last sync pass (409 → server wins) */
  conflictCount: number
  /** Timestamp of the last successful sync */
  lastSyncedAt: Date | null
  /** Last error message if any */
  lastError: string | null
}

/**
 * Sync event types emitted by the engine
 */
export type SyncEventType =
  | 'sync:start'
  | 'sync:complete'
  | 'sync:error'
  | 'sync:item:success'
  | 'sync:item:error'
  | 'sync:item:retry'
  | 'sync:item:conflict'
  | 'sync:queue:add'
  | 'sync:queue:clear'
  | 'online'
  | 'offline'

/**
 * Sync event payload
 */
export interface SyncEvent {
  type: SyncEventType
  timestamp: Date
  data?: {
    itemId?: string
    operation?: SyncOperation
    error?: string
    attempt?: number
    queueSize?: number
  }
}

/**
 * Sync event listener callback
 */
export type SyncEventListener = (event: SyncEvent) => void

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay: number
  /** Maximum delay in milliseconds (default: 60000) */
  maxDelay: number
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts: number
  /** Backoff multiplier (default: 2) */
  backoffMultiplier: number
}

/**
 * Mutation processor function type
 */
export type MutationProcessorResult = {
  ok?: boolean
  dropped?: boolean
  conflict?: boolean
  [key: string]: unknown
}

export type MutationProcessor = (
  operation: SyncOperation,
  payload: Record<string, unknown>,
) => Promise<MutationProcessorResult | void>

/**
 * Authentication check function type
 * Returns true if user is authenticated and can sync
 */
export type AuthCheckFunction = () => boolean

/**
 * Returns true when a remote wipe ran and sync must abort.
 */
export type RemoteWipeCheckFunction = () => Promise<boolean>

// ─── Default Configuration ───────────────────────────────────────────────────

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  initialDelay: 1000,
  maxDelay: 60000,
  maxAttempts: 3,
  backoffMultiplier: 2,
}

const SYNC_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

// ─── SyncEngine Class ────────────────────────────────────────────────────────

/**
 * SyncEngine manages offline queue, retry logic, and synchronization.
 *
 * Features:
 * - Queue mutation operations when offline
 * - Process queue when online (FIFO order)
 * - Exponential backoff retry logic
 * - Conflict detection and logging
 * - Event emission for UI updates
 *
 * @example
 * ```typescript
 * import { syncEngine } from '@/lib/db/sync-engine'
 *
 * // Queue a mutation
 * await syncEngine.queueMutation('deficiency.create', {
 *   clientId: crypto.randomUUID(),
 *   description: 'Missing fire extinguisher',
 *   severity: 'MAJOR',
 * })
 *
 * // Listen for sync events
 * syncEngine.on('sync:complete', (event) => {
 *   console.log('Sync completed at:', event.timestamp)
 * })
 *
 * // Check status
 * const status = syncEngine.getStatus()
 * console.log('Queue size:', status.queueSize)
 * ```
 */
export class SyncEngine {
  private _isOnline: boolean
  private _isSyncing: boolean
  private _isAuthenticated: boolean
  /** When true, sync is paused (e.g. logout) and must not run until resumeSync(). */
  private _isPaused: boolean
  private _lastSyncedAt: Date | null
  private _lastError: string | null
  private _conflictCount: number
  private _syncInterval: ReturnType<typeof setInterval> | null
  private _retryConfig: RetryConfig
  private _listeners: Map<SyncEventType, Set<SyncEventListener>>
  private _mutationProcessor: MutationProcessor | null
  private _authCheckFunction: AuthCheckFunction | null
  private _remoteWipeCheckFunction: RemoteWipeCheckFunction | null
  private _boundHandleOnline: () => void
  private _boundHandleOffline: () => void
  private _boundHandleVisibilityChange: () => void

  constructor(retryConfig: Partial<RetryConfig> = {}) {
    this._isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    this._isSyncing = false
    this._isAuthenticated = false
    this._isPaused = false
    this._lastSyncedAt = null
    this._lastError = null
    this._conflictCount = 0
    this._syncInterval = null
    this._retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig }
    this._listeners = new Map()
    this._mutationProcessor = null
    this._authCheckFunction = null
    this._remoteWipeCheckFunction = null

    // Bind event handlers
    this._boundHandleOnline = this.handleOnline.bind(this)
    this._boundHandleOffline = this.handleOffline.bind(this)
    this._boundHandleVisibilityChange = this._handleVisibilityChange.bind(this)

    // Setup event listeners
    this._setupEventListeners()

    // Start periodic sync
    this._startPeriodicSync()
  }

  // ─── Public Methods ──────────────────────────────────────────────────────

  /**
   * Queue a mutation operation for sync.
   *
   * @param operation - The sync operation type
   * @param payload - The data payload for the operation
   * @param priority - Priority level (lower = higher priority, default: 10)
   * @returns The created queue item ID
   */
  async queueMutation(
    operation: SyncOperation,
    payload: Record<string, unknown>,
    priority?: number,
  ): Promise<string> {
    const clientId = (payload.clientId as string) || crypto.randomUUID()
    const effectivePriority = priority ?? (operation === 'inspection.finalize' ? 0 : 10)

    const queueItem: SyncQueueItem = {
      id: crypto.randomUUID(),
      clientId,
      operation,
      payload,
      status: 'PENDING',
      attempts: 0,
      maxAttempts: this._retryConfig.maxAttempts,
      createdAt: new Date().toISOString(),
      priority: effectivePriority,
    }

    await db.syncQueue.add(queueItem)

    this._emit('sync:queue:add', {
      itemId: queueItem.id,
      operation,
      queueSize: await this.getQueueSize(),
    })

    console.log('[SyncEngine] Queued:', operation, clientId)

    // Try immediate sync if online and authenticated
    if (this._isOnline && !this._isSyncing && this._checkAuthentication()) {
      // Use setTimeout to avoid blocking
      setTimeout(() => this.sync(), 0)
    }

    return queueItem.id
  }

  /**
   * Process the sync queue.
   * Items are processed in FIFO order within priority levels.
   */
  async sync(): Promise<void> {
    if (this._isSyncing || !this._isOnline || !this._checkAuthentication()) {
      if (!this._checkAuthentication()) {
        console.log('[SyncEngine] Skipping sync - user not authenticated')
      }
      return
    }

    this._isSyncing = true
    this._conflictCount = 0
    this._emit('sync:start')

    try {
      console.log('[SyncEngine] Starting sync...')

      const wiped = await this._checkRemoteWipeBeforeSync()
      if (wiped) {
        console.warn('[SyncEngine] Remote wipe triggered, aborting sync')
        return
      }

      await this.processQueue()

      this._lastSyncedAt = new Date()
      this._lastError = null

      console.log('[SyncEngine] Sync complete')
      this._isSyncing = false
      this._emit('sync:complete', {
        queueSize: await this.getQueueSize(),
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error'
      this._lastError = errorMessage
      console.error('[SyncEngine] Sync error:', errorMessage)
      this._isSyncing = false
      this._emit('sync:error', { error: errorMessage })
    } finally {
      this._isSyncing = false
    }
  }

  /**
   * Process all pending items in the queue.
   */
  async processQueue(): Promise<void> {
    const items = await db.getNextSyncItems(50)

    if (items.length === 0) {
      console.log('[SyncEngine] Queue is empty')
      Sentry.addBreadcrumb({
        category: 'sync',
        message: 'Sync ran with no pending queue items',
        level: 'info',
        data: { pendingCount: 0 },
      })
      return
    }

    console.log(`[SyncEngine] Processing ${items.length} items`)

    for (const item of items) {
      if (!this._isOnline) {
        console.log('[SyncEngine] Went offline, stopping queue processing')
        break
      }

      await this._processItem(item)
    }
  }

  /**
   * Handle device coming online.
   */
  async handleOnline(): Promise<void> {
    console.log('[SyncEngine] 🟢 Device is online')
    this._isOnline = true
    this._emit('online')

    // Trigger sync when coming online (if authenticated and have pending items)
    if (!this._isSyncing && this._checkAuthentication()) {
      const queueSize = await this.getQueueSize()
      if (queueSize > 0) {
        console.log(`[SyncEngine] Device online, ${queueSize} items pending, triggering sync`)
        this.sync()
      }
    }
  }

  /**
   * Handle device going offline.
   */
  handleOffline(): void {
    console.log('[SyncEngine] 🔴 Device is offline')
    this._isOnline = false
    this._emit('offline')
  }

  /**
   * Get the current sync engine status.
   */
  getStatus(): SyncEngineStatus {
    return {
      isOnline: this._isOnline,
      isSyncing: this._isSyncing,
      queueSize: 0, // Will be updated asynchronously
      conflictCount: this._conflictCount,
      lastSyncedAt: this._lastSyncedAt,
      lastError: this._lastError,
    }
  }

  /**
   * Get the current sync engine status with queue size.
   */
  async getStatusAsync(): Promise<SyncEngineStatus> {
    return {
      isOnline: this._isOnline,
      isSyncing: this._isSyncing,
      queueSize: await this.getQueueSize(),
      conflictCount: this._conflictCount,
      lastSyncedAt: this._lastSyncedAt,
      lastError: this._lastError,
    }
  }

  /**
   * Get the number of items in the sync queue.
   */
  async getQueueSize(): Promise<number> {
    return db.syncQueue.where('status').equals('PENDING').count()
  }

  /**
   * Get the total number of items in the sync queue (all statuses).
   */
  async getTotalQueueSize(): Promise<number> {
    return db.syncQueue.count()
  }

  /**
   * Clear all items from the sync queue.
   */
  async clearQueue(): Promise<void> {
    await db.syncQueue.clear()
    console.log('[SyncEngine] Queue cleared')
    this._emit('sync:queue:clear', { queueSize: 0 })
  }

  /**
   * Clear only failed items from the sync queue.
   */
  async clearFailedItems(): Promise<number> {
    const failedItems = await db.syncQueue.where('status').equals('FAILED').toArray()
    const ids = failedItems.map((item) => item.id)
    await db.syncQueue.bulkDelete(ids)
    console.log(`[SyncEngine] Cleared ${ids.length} failed items`)
    return ids.length
  }

  /**
   * Retry all failed items by resetting their status.
   */
  async retryFailedItems(): Promise<number> {
    const failedItems = await db.syncQueue.where('status').equals('FAILED').toArray()

    for (const item of failedItems) {
      await db.syncQueue.update(item.id, {
        status: 'PENDING',
        attempts: 0,
        lastError: undefined,
        lastAttemptAt: undefined,
      })
    }

    console.log(`[SyncEngine] Reset ${failedItems.length} failed items for retry`)

    // Trigger sync if online and authenticated
    if (this._isOnline && !this._isSyncing && this._checkAuthentication()) {
      setTimeout(() => this.sync(), 0)
    }

    return failedItems.length
  }

  /**
   * Register a mutation processor function.
   * This function will be called to process each mutation.
   *
   * @param processor - The mutation processor function
   */
  setMutationProcessor(processor: MutationProcessor): void {
    this._mutationProcessor = processor
  }

  /**
   * Register an authentication check function.
   * This function will be called before attempting sync operations.
   *
   * @param authCheck - Function that returns true if user is authenticated
   */
  setAuthCheck(authCheck: AuthCheckFunction): void {
    this._authCheckFunction = authCheck
    this._isAuthenticated = authCheck()
    console.log('[SyncEngine] Auth check registered, authenticated:', this._isAuthenticated)
  }

  /**
   * Register the remote-wipe guard that must pass before queue drains.
   */
  setRemoteWipeCheck(remoteWipeCheck: RemoteWipeCheckFunction): void {
    this._remoteWipeCheckFunction = remoteWipeCheck
  }

  /**
   * Pause sync operations (called on logout).
   * Stops periodic sync and prevents new sync attempts.
   */
  pauseSync(): void {
    console.log('[SyncEngine] Pausing sync - user logged out')
    this._isPaused = true
    this._isAuthenticated = false

    // Stop periodic sync
    this._stopPeriodicSync()
  }

  /**
   * Resume sync operations (called on login).
   * Restarts periodic sync and triggers immediate sync if there are pending items.
   */
  async resumeSync(): Promise<void> {
    console.log('[SyncEngine] Resuming sync - user logged in')
    this._isPaused = false
    this._isAuthenticated = this._authCheckFunction ? this._authCheckFunction() : true

    // Restart periodic sync
    this._startPeriodicSync()

    // Trigger immediate sync if online and have pending items
    if (this._isOnline && !this._isSyncing) {
      const queueSize = await this.getQueueSize()
      if (queueSize > 0) {
        console.log(`[SyncEngine] ${queueSize} items pending, triggering sync`)
        setTimeout(() => this.sync(), 0)
      }
    }
  }

  /**
   * Add an event listener.
   *
   * @param event - The event type to listen for
   * @param listener - The callback function
   */
  on(event: SyncEventType, listener: SyncEventListener): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set())
    }
    this._listeners.get(event)!.add(listener)
  }

  /**
   * Remove an event listener.
   *
   * @param event - The event type
   * @param listener - The callback function to remove
   */
  off(event: SyncEventType, listener: SyncEventListener): void {
    const listeners = this._listeners.get(event)
    if (listeners) {
      listeners.delete(listener)
    }
  }

  /**
   * Remove all event listeners for a specific event type.
   *
   * @param event - The event type (optional, removes all if not specified)
   */
  removeAllListeners(event?: SyncEventType): void {
    if (event) {
      this._listeners.delete(event)
    } else {
      this._listeners.clear()
    }
  }

  /**
   * Clean up resources and stop the sync engine.
   */
  destroy(): void {
    // Stop periodic sync
    this._stopPeriodicSync()

    // Remove event listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this._boundHandleOnline)
      window.removeEventListener('offline', this._boundHandleOffline)
      document.removeEventListener('visibilitychange', this._boundHandleVisibilityChange)
    }

    // Clear all listeners
    this._listeners.clear()

    console.log('[SyncEngine] Destroyed')
  }

  // ─── Private Methods ─────────────────────────────────────────────────────

  /**
   * Setup event listeners for network status and visibility changes.
   */
  private _setupEventListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this._boundHandleOnline)
      window.addEventListener('offline', this._boundHandleOffline)
      document.addEventListener('visibilitychange', this._boundHandleVisibilityChange)
    }
  }

  /**
   * Start periodic sync interval.
   */
  private _startPeriodicSync(): void {
    // Clear existing interval if any
    this._stopPeriodicSync()

    if (typeof window !== 'undefined') {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return
      }

      this._syncInterval = setInterval(async () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          this._stopPeriodicSync()
          return
        }

        if (this._isOnline && !this._isSyncing && this._checkAuthentication()) {
          // Only sync if there are pending items
          const queueSize = await this.getQueueSize()
          if (queueSize > 0) {
            console.log(`[SyncEngine] Periodic sync: ${queueSize} items pending`)
            this.sync()
          }
        }
      }, SYNC_INTERVAL_MS)
    }
  }

  /**
   * Stop the periodic sync interval.
   */
  private _stopPeriodicSync(): void {
    if (this._syncInterval) {
      clearInterval(this._syncInterval)
      this._syncInterval = null
    }
  }

  /**
   * Handle visibility change (tab becomes active).
   */
  private async _handleVisibilityChange(): Promise<void> {
    if (document.visibilityState === 'hidden') {
      this._stopPeriodicSync()
      return
    }

    this._startPeriodicSync()

    if (
      document.visibilityState === 'visible' &&
      this._isOnline &&
      !this._isSyncing &&
      this._checkAuthentication()
    ) {
      // Only sync if there are pending items
      const queueSize = await this.getQueueSize()
      if (queueSize > 0) {
        console.log(`[SyncEngine] Tab became visible, ${queueSize} items pending, triggering sync`)
        this.sync()
      }
    }
  }

  /**
   * Check if user is authenticated.
   * Uses registered auth check function or falls back to internal state.
   */
  private _checkAuthentication(): boolean {
    if (this._isPaused) {
      return false
    }
    if (this._authCheckFunction) {
      this._isAuthenticated = this._authCheckFunction()
    }
    return this._isAuthenticated
  }

  private async _checkRemoteWipeBeforeSync(): Promise<boolean> {
    if (!this._remoteWipeCheckFunction) return false
    return await this._remoteWipeCheckFunction()
  }

  /**
   * Process a single queue item.
   */
  private async _processItem(item: SyncQueueItem): Promise<void> {
    try {
      // Mark as in progress
      await db.syncQueue.update(item.id, {
        status: 'IN_PROGRESS',
        lastAttemptAt: new Date().toISOString(),
      })

      // Process the mutation (processors may return { dropped: true } when the server already
      // reflects state and the queue entry is intentionally removed without a successful PATCH.)
      const outcome = await this._processMutation(item)

      // Mark as completed and remove from queue
      await db.syncQueue.delete(item.id)

      const dropped =
        outcome !== undefined &&
        outcome !== null &&
        typeof outcome === 'object' &&
        'dropped' in outcome &&
        (outcome as { dropped?: boolean }).dropped === true

      const conflict =
        outcome !== undefined &&
        outcome !== null &&
        typeof outcome === 'object' &&
        'conflict' in outcome &&
        (outcome as { conflict?: boolean }).conflict === true

      if (conflict) {
        this._conflictCount += 1
        this._emit('sync:item:conflict', {
          itemId: item.id,
          operation: item.operation,
          queueSize: await this.getQueueSize(),
        })
        console.warn(
          '[SyncEngine] ◆ Conflict reconciled from server:',
          item.operation,
          item.clientId,
        )
      }

      if (dropped) {
        console.log(
          '[SyncEngine] ◆ Dropped stale queue entry (server already satisfied or rejected sync):',
          item.operation,
          item.clientId,
        )
      } else {
        console.log('[SyncEngine] ✓ Processed:', item.operation, item.clientId)
      }
      this._emit('sync:item:success', {
        itemId: item.id,
        operation: item.operation,
        queueSize: await this.getQueueSize(),
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[SyncEngine] ✗ Failed:', item.operation, errorMessage)

      // Increment attempts
      const newAttempts = item.attempts + 1

      if (newAttempts >= item.maxAttempts) {
        // Max attempts reached, mark as failed
        console.error('[SyncEngine] Max attempts reached for:', item.clientId)
        await db.syncQueue.update(item.id, {
          status: 'FAILED',
          attempts: newAttempts,
          lastError: errorMessage,
          lastAttemptAt: new Date().toISOString(),
        })

        this._emit('sync:item:error', {
          itemId: item.id,
          operation: item.operation,
          error: errorMessage,
          attempt: newAttempts,
          queueSize: await this.getQueueSize(),
        })
      } else {
        // Schedule retry with exponential backoff
        const delay = this._calculateBackoffDelay(newAttempts)
        console.log(`[SyncEngine] Retry ${newAttempts}/${item.maxAttempts} in ${delay}ms`)

        await db.syncQueue.update(item.id, {
          status: 'PENDING',
          attempts: newAttempts,
          lastError: errorMessage,
          lastAttemptAt: new Date().toISOString(),
        })

        this._emit('sync:item:retry', {
          itemId: item.id,
          operation: item.operation,
          error: errorMessage,
          attempt: newAttempts,
          queueSize: await this.getQueueSize(),
        })

        // Wait before retrying the same item within this sync pass
        await this._delay(delay)

        return this._processItem({
          ...item,
          status: 'PENDING',
          attempts: newAttempts,
          lastError: errorMessage,
          lastAttemptAt: new Date().toISOString(),
        })
      }
    }
  }

  /**
   * Process a mutation using the registered processor or default handling.
   */
  private async _processMutation(item: SyncQueueItem): Promise<unknown> {
    if (this._mutationProcessor) {
      return await this._mutationProcessor(item.operation, item.payload)
    }
    // Default: throw error if no processor is registered
    throw new Error(`No mutation processor registered for operation: ${item.operation}`)
  }

  /**
   * Calculate exponential backoff delay.
   */
  private _calculateBackoffDelay(attempt: number): number {
    const delay =
      this._retryConfig.initialDelay * Math.pow(this._retryConfig.backoffMultiplier, attempt - 1)
    return Math.min(delay, this._retryConfig.maxDelay)
  }

  /**
   * Delay execution for a specified time.
   * Returns immediately if delay is 0.
   */
  private _delay(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve()
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Emit a sync event to all registered listeners.
   */
  private _emit(type: SyncEventType, data?: SyncEvent['data']): void {
    const event: SyncEvent = {
      type,
      timestamp: new Date(),
      data,
    }

    const listeners = this._listeners.get(type)
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(event)
        } catch (error) {
          console.error('[SyncEngine] Event listener error:', error)
        }
      })
    }
  }
}

// ─── Singleton Instance ──────────────────────────────────────────────────────

/**
 * Singleton SyncEngine instance.
 * Use this throughout the application for all sync operations.
 *
 * @example
 * ```typescript
 * import { syncEngine } from '@/lib/db/sync-engine'
 *
 * // Queue a mutation
 * await syncEngine.queueMutation('deficiency.create', { ... })
 *
 * // Check status
 * const status = await syncEngine.getStatusAsync()
 * ```
 */
export const syncEngine = new SyncEngine()

// ─── Factory Function ────────────────────────────────────────────────────────

/**
 * Create a new SyncEngine instance with custom configuration.
 *
 * @param retryConfig - Custom retry configuration
 * @returns A new SyncEngine instance
 */
export function createSyncEngine(retryConfig: Partial<RetryConfig> = {}): SyncEngine {
  return new SyncEngine(retryConfig)
}
