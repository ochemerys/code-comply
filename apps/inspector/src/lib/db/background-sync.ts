/**
 * Background Sync API Integration
 *
 * Integrates the Background Sync API to automatically sync data when
 * connectivity is restored. Provides fallback for browsers without
 * Background Sync support, sync status tracking, and manual sync trigger.
 *
 * @module lib/db/background-sync
 * @see M3-S4 - Implement Background Sync API Integration
 * @see M-03 (Offline Workflow) - Sync up, conflict resolution
 */

import { syncEngine } from './sync-engine'
import type { SyncEventListener, SyncEvent } from './sync-engine'

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Sync tag identifiers used for Background Sync API registration.
 * Each tag corresponds to a specific data type to sync.
 */
export const SYNC_TAGS = {
  INSPECTION: 'inspection-sync',
  DEFICIENCY: 'deficiency-sync',
  PHOTO: 'photo-sync',
  ALL: 'all-data-sync',
} as const

export type SyncTag = (typeof SYNC_TAGS)[keyof typeof SYNC_TAGS]

/**
 * Background sync status information
 */
export interface BackgroundSyncStatus {
  /** Whether Background Sync API is supported */
  isSupported: boolean
  /** Whether sync tags are currently registered */
  isRegistered: boolean
  /** List of currently registered sync tags */
  registeredTags: SyncTag[]
  /** Whether fallback periodic sync is active */
  isFallbackActive: boolean
  /** Timestamp of last successful sync */
  lastSyncedAt: Date | null
  /** Whether a sync is currently in progress */
  isSyncing: boolean
  /** Number of pending items in the queue */
  pendingCount: number
  /** Last error message if any */
  lastError: string | null
}

/**
 * Background sync event types
 */
export type BackgroundSyncEventType =
  | 'bg-sync:registered'
  | 'bg-sync:unregistered'
  | 'bg-sync:triggered'
  | 'bg-sync:fallback-start'
  | 'bg-sync:fallback-stop'
  | 'bg-sync:manual-trigger'
  | 'bg-sync:error'

/**
 * Background sync event payload
 */
export interface BackgroundSyncEvent {
  type: BackgroundSyncEventType
  timestamp: Date
  data?: {
    tag?: SyncTag
    error?: string
    pendingCount?: number
  }
}

/**
 * Background sync event listener callback
 */
export type BackgroundSyncEventListener = (event: BackgroundSyncEvent) => void

/**
 * Configuration for the background sync manager
 */
export interface BackgroundSyncConfig {
  /** Interval for fallback periodic sync in milliseconds (default: 60000 = 1 minute) */
  fallbackInterval: number
  /** Whether to auto-register sync tags on initialization (default: true) */
  autoRegister: boolean
  /** Sync tags to register (default: all tags) */
  tags: SyncTag[]
}

// ─── Default Configuration ───────────────────────────────────────────────────

const DEFAULT_CONFIG: BackgroundSyncConfig = {
  fallbackInterval: 60000, // 1 minute
  autoRegister: true,
  tags: [SYNC_TAGS.INSPECTION, SYNC_TAGS.DEFICIENCY, SYNC_TAGS.PHOTO],
}

// ─── BackgroundSyncManager Class ─────────────────────────────────────────────

/**
 * BackgroundSyncManager integrates the Background Sync API with the SyncEngine.
 *
 * Features:
 * - Registers sync events in the service worker
 * - Triggers queue processing on sync events
 * - Provides fallback for browsers without Background Sync
 * - Tracks sync status
 * - Allows manual sync trigger
 *
 * @example
 * ```typescript
 * import { backgroundSyncManager } from '@/lib/db/background-sync'
 *
 * // Initialize (auto-registers if supported)
 * await backgroundSyncManager.init()
 *
 * // Check status
 * const status = await backgroundSyncManager.getStatus()
 * console.log('Supported:', status.isSupported)
 *
 * // Manual sync trigger
 * await backgroundSyncManager.triggerSync()
 *
 * // Listen for events
 * backgroundSyncManager.on('bg-sync:triggered', (event) => {
 *   console.log('Background sync triggered:', event.data?.tag)
 * })
 * ```
 */
export class BackgroundSyncManager {
  private _config: BackgroundSyncConfig
  private _isSupported: boolean
  private _isRegistered: boolean
  private _registeredTags: Set<SyncTag>
  private _isFallbackActive: boolean
  private _fallbackInterval: ReturnType<typeof setInterval> | null
  private _lastSyncedAt: Date | null
  private _lastError: string | null
  private _listeners: Map<BackgroundSyncEventType, Set<BackgroundSyncEventListener>>
  private _syncEngineListener: SyncEventListener | null
  private _initialized: boolean

  constructor(config: Partial<BackgroundSyncConfig> = {}) {
    this._config = { ...DEFAULT_CONFIG, ...config }
    this._isSupported = this._checkSupport()
    this._isRegistered = false
    this._registeredTags = new Set()
    this._isFallbackActive = false
    this._fallbackInterval = null
    this._lastSyncedAt = null
    this._lastError = null
    this._listeners = new Map()
    this._syncEngineListener = null
    this._initialized = false
  }

  // ─── Public Methods ──────────────────────────────────────────────────────

  /**
   * Initialize the background sync manager.
   * Registers sync tags if supported, or starts fallback if not.
   */
  async init(): Promise<void> {
    if (this._initialized) {
      return
    }

    this._initialized = true

    // Listen for sync engine events to track status
    this._syncEngineListener = (event: SyncEvent) => {
      if (event.type === 'sync:complete') {
        this._lastSyncedAt = new Date()
        this._lastError = null
      } else if (event.type === 'sync:error') {
        this._lastError = event.data?.error || 'Unknown error'
      }
    }
    syncEngine.on('sync:complete', this._syncEngineListener)
    syncEngine.on('sync:error', this._syncEngineListener)

    if (this._isSupported && this._config.autoRegister) {
      await this.registerSyncTags()
    }

    // Start fallback if Background Sync is not supported
    if (!this._isSupported) {
      this.startFallbackSync()
    }
  }

  /**
   * Register sync tags with the service worker.
   * Only works if Background Sync API is supported.
   *
   * @returns true if registration was successful
   */
  async registerSyncTags(): Promise<boolean> {
    if (!this._isSupported) {
      console.warn('[BackgroundSync] Background Sync API not supported, using fallback')
      this.startFallbackSync()
      return false
    }

    try {
      const registration = await navigator.serviceWorker.ready

      for (const tag of this._config.tags) {
        await registration.sync.register(tag)
        this._registeredTags.add(tag)

        this._emit('bg-sync:registered', { tag })
        console.log(`[BackgroundSync] Registered sync tag: ${tag}`)
      }

      this._isRegistered = true
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this._lastError = errorMessage
      console.error('[BackgroundSync] Failed to register sync tags:', errorMessage)
      this._emit('bg-sync:error', { error: errorMessage })

      return false
    }
  }

  /**
   * Unregister all sync tags.
   */
  async unregisterSyncTags(): Promise<void> {
    this._registeredTags.clear()
    this._isRegistered = false

    this._emit('bg-sync:unregistered')
    console.log('[BackgroundSync] Unregistered all sync tags')
  }

  /**
   * Start fallback periodic sync for browsers without Background Sync support.
   * Checks the sync queue at regular intervals and triggers sync if needed.
   */
  startFallbackSync(): void {
    if (this._isSupported) {
      console.log('[BackgroundSync] Background Sync API supported; fallback timer not started')
      return
    }

    if (this._isFallbackActive) {
      return
    }

    this._isFallbackActive = true

    this._fallbackInterval = setInterval(async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const pendingCount = await syncEngine.getQueueSize()
        if (pendingCount > 0) {
          console.log(`[BackgroundSync] Fallback: ${pendingCount} items pending, triggering sync`)
          await syncEngine.sync()
        }
      }
    }, this._config.fallbackInterval)

    this._emit('bg-sync:fallback-start')
    console.log(
      `[BackgroundSync] Fallback sync started (interval: ${this._config.fallbackInterval}ms)`,
    )
  }

  /**
   * Stop fallback periodic sync.
   */
  stopFallbackSync(): void {
    if (this._fallbackInterval) {
      clearInterval(this._fallbackInterval)
      this._fallbackInterval = null
    }

    this._isFallbackActive = false

    this._emit('bg-sync:fallback-stop')
    console.log('[BackgroundSync] Fallback sync stopped')
  }

  /**
   * Manually trigger a sync operation.
   * Works regardless of Background Sync API support.
   *
   * @returns true if sync was triggered successfully
   */
  async triggerSync(): Promise<boolean> {
    this._emit('bg-sync:manual-trigger', {
      pendingCount: await syncEngine.getQueueSize(),
    })

    console.log('[BackgroundSync] Manual sync triggered')

    try {
      // If Background Sync is supported, re-register tags to trigger sync
      if (this._isSupported) {
        try {
          const registration = await navigator.serviceWorker.ready
          await registration.sync.register(SYNC_TAGS.ALL)
        } catch {
          // If registration fails, fall through to direct sync
        }
      }

      // Always also trigger direct sync via the engine
      await syncEngine.sync()
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this._lastError = errorMessage
      this._emit('bg-sync:error', { error: errorMessage })
      console.error('[BackgroundSync] Manual sync failed:', errorMessage)
      return false
    }
  }

  /**
   * Get the current background sync status.
   */
  async getStatus(): Promise<BackgroundSyncStatus> {
    const engineStatus = await syncEngine.getStatusAsync()

    return {
      isSupported: this._isSupported,
      isRegistered: this._isRegistered,
      registeredTags: Array.from(this._registeredTags),
      isFallbackActive: this._isFallbackActive,
      lastSyncedAt: this._lastSyncedAt,
      isSyncing: engineStatus.isSyncing,
      pendingCount: engineStatus.queueSize,
      lastError: this._lastError,
    }
  }

  /**
   * Check if Background Sync API is supported in the current browser.
   */
  isBackgroundSyncSupported(): boolean {
    return this._isSupported
  }

  /**
   * Add an event listener.
   */
  on(event: BackgroundSyncEventType, listener: BackgroundSyncEventListener): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set())
    }
    this._listeners.get(event)!.add(listener)
  }

  /**
   * Remove an event listener.
   */
  off(event: BackgroundSyncEventType, listener: BackgroundSyncEventListener): void {
    const listeners = this._listeners.get(event)
    if (listeners) {
      listeners.delete(listener)
    }
  }

  /**
   * Remove all event listeners.
   */
  removeAllListeners(event?: BackgroundSyncEventType): void {
    if (event) {
      this._listeners.delete(event)
    } else {
      this._listeners.clear()
    }
  }

  /**
   * Clean up resources and stop the background sync manager.
   */
  destroy(): void {
    this.stopFallbackSync()

    // Remove sync engine listener
    if (this._syncEngineListener) {
      syncEngine.off('sync:complete', this._syncEngineListener)
      syncEngine.off('sync:error', this._syncEngineListener)
      this._syncEngineListener = null
    }

    this._listeners.clear()
    this._registeredTags.clear()
    this._isRegistered = false
    this._initialized = false

    console.log('[BackgroundSync] Destroyed')
  }

  // ─── Private Methods ─────────────────────────────────────────────────────

  /**
   * Check if Background Sync API is supported.
   */
  private _checkSupport(): boolean {
    return (
      typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'SyncManager' in window
    )
  }

  /**
   * Emit a background sync event to all registered listeners.
   */
  private _emit(type: BackgroundSyncEventType, data?: BackgroundSyncEvent['data']): void {
    const event: BackgroundSyncEvent = {
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
          console.error('[BackgroundSync] Event listener error:', error)
        }
      })
    }
  }
}

// ─── Singleton Instance ──────────────────────────────────────────────────────

/**
 * Singleton BackgroundSyncManager instance.
 * Use this throughout the application for background sync operations.
 *
 * @example
 * ```typescript
 * import { backgroundSyncManager } from '@/lib/db/background-sync'
 *
 * // Initialize on app startup
 * await backgroundSyncManager.init()
 *
 * // Trigger manual sync
 * await backgroundSyncManager.triggerSync()
 * ```
 */
export const backgroundSyncManager = new BackgroundSyncManager()

// ─── Factory Function ────────────────────────────────────────────────────────

/**
 * Create a new BackgroundSyncManager instance with custom configuration.
 *
 * @param config - Custom configuration
 * @returns A new BackgroundSyncManager instance
 */
export function createBackgroundSyncManager(
  config: Partial<BackgroundSyncConfig> = {},
): BackgroundSyncManager {
  return new BackgroundSyncManager(config)
}

// ─── Service Worker Sync Handler ───────────────────────���─────────────────────

/**
 * Handle sync events in the service worker.
 * This function should be called from the service worker's sync event handler.
 *
 * @param tag - The sync tag that triggered the event
 * @returns Promise that resolves when sync is complete
 *
 * @example
 * ```typescript
 * // In sw.ts (service worker)
 * import { handleSyncEvent } from '@/lib/db/background-sync'
 *
 * self.addEventListener('sync', (event) => {
 *   event.waitUntil(handleSyncEvent(event.tag))
 * })
 * ```
 */
export async function handleSyncEvent(tag: string): Promise<void> {
  console.log(`[BackgroundSync] Sync event received for tag: ${tag}`)

  const validTags = Object.values(SYNC_TAGS) as string[]
  if (!validTags.includes(tag)) {
    console.warn(`[BackgroundSync] Unknown sync tag: ${tag}`)
    return
  }

  // Trigger the sync engine to process the queue
  await syncEngine.sync()
}
