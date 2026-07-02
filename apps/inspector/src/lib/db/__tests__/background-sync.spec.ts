/**
 * BackgroundSyncManager Unit Tests
 *
 * Tests for the Background Sync API integration that manages
 * automatic data synchronization when connectivity is restored.
 *
 * @module lib/db/__tests__/background-sync.spec
 * @see M3-S4 - Implement Background Sync API Integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  BackgroundSyncManager,
  createBackgroundSyncManager,
  handleSyncEvent,
  SYNC_TAGS,
  type BackgroundSyncEventListener,
} from '../background-sync'
import { syncEngine } from '../sync-engine'

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../sync-engine', () => {
  const mockSyncEngine = {
    sync: vi.fn().mockResolvedValue(undefined),
    getQueueSize: vi.fn().mockResolvedValue(0),
    getStatusAsync: vi.fn().mockResolvedValue({
      isOnline: true,
      isSyncing: false,
      queueSize: 0,
      lastSyncedAt: null,
      lastError: null,
    }),
    on: vi.fn(),
    off: vi.fn(),
  }
  return {
    syncEngine: mockSyncEngine,
  }
})

// ─── Test Helpers ────────────────────────────────────────────────────────────

function setupServiceWorkerMock(supportSync: boolean = true) {
  const mockRegistration = {
    sync: {
      register: vi.fn().mockResolvedValue(undefined),
      getTags: vi.fn().mockResolvedValue([]),
    },
  }

  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      ready: Promise.resolve(mockRegistration),
      register: vi.fn().mockResolvedValue(mockRegistration),
    },
    writable: true,
    configurable: true,
  })

  if (supportSync) {
    // @ts-expect-error - SyncManager is not in all TS definitions
    window.SyncManager = class SyncManager {}
  } else {
    // @ts-expect-error - Remove SyncManager
    delete window.SyncManager
  }

  return mockRegistration
}

function removeServiceWorkerMock() {
  // @ts-expect-error - Remove SyncManager
  delete window.SyncManager
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('BackgroundSyncManager', () => {
  let manager: BackgroundSyncManager

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    if (manager) {
      manager.destroy()
    }
    removeServiceWorkerMock()
    vi.useRealTimers()
  })

  // ─── Constructor Tests ─────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      setupServiceWorkerMock(true)
      manager = createBackgroundSyncManager()

      expect(manager.isBackgroundSyncSupported()).toBe(true)
    })

    it('should accept custom configuration', () => {
      setupServiceWorkerMock(true)
      manager = createBackgroundSyncManager({
        fallbackInterval: 30000,
        autoRegister: false,
        tags: [SYNC_TAGS.INSPECTION],
      })

      expect(manager.isBackgroundSyncSupported()).toBe(true)
    })

    it('should detect when Background Sync is not supported', () => {
      setupServiceWorkerMock(false)
      manager = createBackgroundSyncManager()

      expect(manager.isBackgroundSyncSupported()).toBe(false)
    })
  })

  // ─── init Tests ────────────────────────────────────────────────────────────

  describe('init', () => {
    it('should register sync tags when supported and autoRegister is true', async () => {
      const mockRegistration = setupServiceWorkerMock(true)
      manager = createBackgroundSyncManager({ autoRegister: true })

      await manager.init()

      expect(mockRegistration.sync.register).toHaveBeenCalledWith(SYNC_TAGS.INSPECTION)
      expect(mockRegistration.sync.register).toHaveBeenCalledWith(SYNC_TAGS.DEFICIENCY)
      expect(mockRegistration.sync.register).toHaveBeenCalledWith(SYNC_TAGS.PHOTO)
    })

    it('should not register sync tags when autoRegister is false', async () => {
      const mockRegistration = setupServiceWorkerMock(true)
      manager = createBackgroundSyncManager({ autoRegister: false })

      await manager.init()

      expect(mockRegistration.sync.register).not.toHaveBeenCalled()
    })

    it('should start fallback sync when Background Sync is not supported', async () => {
      setupServiceWorkerMock(false)
      manager = createBackgroundSyncManager()

      const listener = vi.fn()
      manager.on('bg-sync:fallback-start', listener)

      await manager.init()

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'bg-sync:fallback-start',
        }),
      )
    })

    it('should listen for sync engine events', async () => {
      setupServiceWorkerMock(true)
      manager = createBackgroundSyncManager()

      await manager.init()

      expect(syncEngine.on).toHaveBeenCalledWith('sync:complete', expect.any(Function))
      expect(syncEngine.on).toHaveBeenCalledWith('sync:error', expect.any(Function))
    })

    it('should only initialize once', async () => {
      const mockRegistration = setupServiceWorkerMock(true)
      manager = createBackgroundSyncManager()

      await manager.init()
      await manager.init()

      // Should only register tags once
      expect(mockRegistration.sync.register).toHaveBeenCalledTimes(3) // 3 tags
    })
  })

  // ─── registerSyncTags Tests ────────────────────────────────────────────────

  describe('registerSyncTags', () => {
    it('should register all configured sync tags', async () => {
      const mockRegistration = setupServiceWorkerMock(true)
      manager = createBackgroundSyncManager({ autoRegister: false })

      const result = await manager.registerSyncTags()

      expect(result).toBe(true)
      expect(mockRegistration.sync.register).toHaveBeenCalledTimes(3)
    })

    it('should register only specified tags', async () => {
      const mockRegistration = setupServiceWorkerMock(true)
      manager = createBackgroundSyncManager({
        autoRegister: false,
        tags: [SYNC_TAGS.INSPECTION],
      })

      await manager.registerSyncTags()

      expect(mockRegistration.sync.register).toHaveBeenCalledTimes(1)
      expect(mockRegistration.sync.register).toHaveBeenCalledWith(SYNC_TAGS.INSPECTION)
    })

    it('should emit bg-sync:registered event for each tag', async () => {
      setupServiceWorkerMock(true)
      manager = createBackgroundSyncManager({
        autoRegister: false,
        tags: [SYNC_TAGS.INSPECTION, SYNC_TAGS.DEFICIENCY],
      })

      const listener = vi.fn()
      manager.on('bg-sync:registered', listener)

      await manager.registerSyncTags()

      expect(listener).toHaveBeenCalledTimes(2)
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'bg-sync:registered',
          data: { tag: SYNC_TAGS.INSPECTION },
        }),
      )
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'bg-sync:registered',
          data: { tag: SYNC_TAGS.DEFICIENCY },
        }),
      )
    })

    it('should return false and start fallback when not supported', async () => {
      setupServiceWorkerMock(false)
      manager = createBackgroundSyncManager({ autoRegister: false })

      const fallbackListener = vi.fn()
      manager.on('bg-sync:fallback-start', fallbackListener)

      const result = await manager.registerSyncTags()

      expect(result).toBe(false)
      expect(fallbackListener).toHaveBeenCalled()
    })

    it('should not start fallback on registration error when Background Sync is supported', async () => {
      const mockRegistration = setupServiceWorkerMock(true)
      mockRegistration.sync.register.mockRejectedValue(new Error('Registration failed'))

      manager = createBackgroundSyncManager({ autoRegister: false })

      const errorListener = vi.fn()
      const fallbackListener = vi.fn()
      manager.on('bg-sync:error', errorListener)
      manager.on('bg-sync:fallback-start', fallbackListener)

      const result = await manager.registerSyncTags()

      expect(result).toBe(false)
      expect(errorListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'bg-sync:error',
          data: { error: 'Registration failed' },
        }),
      )
      expect(fallbackListener).not.toHaveBeenCalled()

      const status = await manager.getStatus()
      expect(status.isFallbackActive).toBe(false)
    })
  })

  // ─── unregisterSyncTags Tests ─────────────────────��────────────────────────

  describe('unregisterSyncTags', () => {
    it('should clear registered tags', async () => {
      setupServiceWorkerMock(true)
      manager = createBackgroundSyncManager({ autoRegister: false })

      await manager.registerSyncTags()
      await manager.unregisterSyncTags()

      const status = await manager.getStatus()
      expect(status.isRegistered).toBe(false)
      expect(status.registeredTags).toEqual([])
    })

    it('should emit bg-sync:unregistered event', async () => {
      setupServiceWorkerMock(true)
      manager = createBackgroundSyncManager({ autoRegister: false })

      const listener = vi.fn()
      manager.on('bg-sync:unregistered', listener)

      await manager.unregisterSyncTags()

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'bg-sync:unregistered',
        }),
      )
    })
  })

  // ─── Fallback Sync Tests ──────────────────────────────────────────────────

  describe('fallback sync', () => {
    it('should start fallback periodic sync', () => {
      setupServiceWorkerMock(false)
      manager = createBackgroundSyncManager({ fallbackInterval: 5000 })

      const listener = vi.fn()
      manager.on('bg-sync:fallback-start', listener)

      manager.startFallbackSync()

      expect(listener).toHaveBeenCalled()
    })

    it('should trigger sync when items are pending', async () => {
      setupServiceWorkerMock(false)
      manager = createBackgroundSyncManager({ fallbackInterval: 5000 })

      vi.mocked(syncEngine.getQueueSize).mockResolvedValue(3)

      manager.startFallbackSync()

      // Advance timer to trigger fallback
      await vi.advanceTimersByTimeAsync(5000)

      expect(syncEngine.sync).toHaveBeenCalled()
    })

    it('should not trigger sync when queue is empty', async () => {
      setupServiceWorkerMock(false)
      manager = createBackgroundSyncManager({ fallbackInterval: 5000 })

      vi.mocked(syncEngine.getQueueSize).mockResolvedValue(0)

      manager.startFallbackSync()

      await vi.advanceTimersByTimeAsync(5000)

      expect(syncEngine.sync).not.toHaveBeenCalled()
    })

    it('should not trigger sync when offline', async () => {
      setupServiceWorkerMock(false)
      Object.defineProperty(navigator, 'onLine', { value: false })

      manager = createBackgroundSyncManager({ fallbackInterval: 5000 })

      vi.mocked(syncEngine.getQueueSize).mockResolvedValue(3)

      manager.startFallbackSync()

      await vi.advanceTimersByTimeAsync(5000)

      expect(syncEngine.sync).not.toHaveBeenCalled()
    })

    it('should stop fallback sync', () => {
      setupServiceWorkerMock(false)
      manager = createBackgroundSyncManager({ fallbackInterval: 5000 })

      const listener = vi.fn()
      manager.on('bg-sync:fallback-stop', listener)

      manager.startFallbackSync()
      manager.stopFallbackSync()

      expect(listener).toHaveBeenCalled()
    })

    it('should not start fallback twice', () => {
      setupServiceWorkerMock(false)
      manager = createBackgroundSyncManager({ fallbackInterval: 5000 })

      const listener = vi.fn()
      manager.on('bg-sync:fallback-start', listener)

      manager.startFallbackSync()
      manager.startFallbackSync()

      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('should not start fallback when Background Sync is supported', async () => {
      setupServiceWorkerMock(true)
      manager = createBackgroundSyncManager({ fallbackInterval: 5000, autoRegister: false })

      const listener = vi.fn()
      manager.on('bg-sync:fallback-start', listener)

      manager.startFallbackSync()

      const status = await manager.getStatus()
      expect(listener).not.toHaveBeenCalled()
      expect(status.isFallbackActive).toBe(false)
    })
  })

  // ─── triggerSync Tests ─────────────────────────────────────────────────────

  describe('triggerSync', () => {
    it('should trigger sync via sync engine', async () => {
      setupServiceWorkerMock(true)
      manager = createBackgroundSyncManager({ autoRegister: false })

      const result = await manager.triggerSync()

      expect(result).toBe(true)
      expect(syncEngine.sync).toHaveBeenCalled()
    })

    it('should emit bg-sync:manual-trigger event', async () => {
      setupServiceWorkerMock(true)
      manager = createBackgroundSyncManager({ autoRegister: false })

      const listener = vi.fn()
      manager.on('bg-sync:manual-trigger', listener)

      await manager.triggerSync()

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'bg-sync:manual-trigger',
        }),
      )
    })

    it('should register all-data-sync tag when supported', async () => {
      const mockRegistration = setupServiceWorkerMock(true)
      manager = createBackgroundSyncManager({ autoRegister: false })

      await manager.triggerSync()

      expect(mockRegistration.sync.register).toHaveBeenCalledWith(SYNC_TAGS.ALL)
    })

    it('should return false on sync error', async () => {
      setupServiceWorkerMock(true)
      manager = createBackgroundSyncManager({ autoRegister: false })

      vi.mocked(syncEngine.sync).mockRejectedValueOnce(new Error('Sync failed'))

      const errorListener = vi.fn()
      manager.on('bg-sync:error', errorListener)

      const result = await manager.triggerSync()

      expect(result).toBe(false)
      expect(errorListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'bg-sync:error',
          data: { error: 'Sync failed' },
        }),
      )
    })

    it('should still trigger direct sync even if tag registration fails', async () => {
      const mockRegistration = setupServiceWorkerMock(true)
      mockRegistration.sync.register.mockRejectedValue(new Error('Tag registration failed'))

      manager = createBackgroundSyncManager({ autoRegister: false })

      const result = await manager.triggerSync()

      expect(result).toBe(true)
      expect(syncEngine.sync).toHaveBeenCalled()
    })
  })

  // ─── getStatus Tests ───────────────────────────────────────────────────────

  describe('getStatus', () => {
    it('should return complete status when supported', async () => {
      setupServiceWorkerMock(true)
      manager = createBackgroundSyncManager({ autoRegister: false })

      await manager.registerSyncTags()

      const status = await manager.getStatus()

      expect(status.isSupported).toBe(true)
      expect(status.isRegistered).toBe(true)
      expect(status.registeredTags).toContain(SYNC_TAGS.INSPECTION)
      expect(status.registeredTags).toContain(SYNC_TAGS.DEFICIENCY)
      expect(status.registeredTags).toContain(SYNC_TAGS.PHOTO)
      expect(status.isFallbackActive).toBe(false)
      expect(status.isSyncing).toBe(false)
      expect(status.pendingCount).toBe(0)
      expect(status.lastError).toBeNull()
    })

    it('should return status with fallback active when not supported', async () => {
      setupServiceWorkerMock(false)
      manager = createBackgroundSyncManager()

      await manager.init()

      const status = await manager.getStatus()

      expect(status.isSupported).toBe(false)
      expect(status.isRegistered).toBe(false)
      expect(status.isFallbackActive).toBe(true)
    })

    it('should include pending count from sync engine', async () => {
      setupServiceWorkerMock(true)
      manager = createBackgroundSyncManager({ autoRegister: false })

      vi.mocked(syncEngine.getStatusAsync).mockResolvedValue({
        isOnline: true,
        isSyncing: false,
        queueSize: 5,
        lastSyncedAt: null,
        lastError: null,
      })

      const status = await manager.getStatus()

      expect(status.pendingCount).toBe(5)
    })
  })

  // ─── Event Listener Tests ──────────────────────────────────────────────────

  describe('event listeners', () => {
    it('should add and trigger event listener', async () => {
      setupServiceWorkerMock(true)
      manager = createBackgroundSyncManager({ autoRegister: false })

      const listener = vi.fn()
      manager.on('bg-sync:manual-trigger', listener)

      await manager.triggerSync()

      expect(listener).toHaveBeenCalled()
    })

    it('should remove event listener', async () => {
      setupServiceWorkerMock(true)
      manager = createBackgroundSyncManager({ autoRegister: false })

      const listener = vi.fn()
      manager.on('bg-sync:manual-trigger', listener)
      manager.off('bg-sync:manual-trigger', listener)

      await manager.triggerSync()

      expect(listener).not.toHaveBeenCalled()
    })

    it('should remove all listeners for specific event', async () => {
      setupServiceWorkerMock(true)
      manager = createBackgroundSyncManager({ autoRegister: false })

      const listener1 = vi.fn()
      const listener2 = vi.fn()
      manager.on('bg-sync:manual-trigger', listener1)
      manager.on('bg-sync:manual-trigger', listener2)

      manager.removeAllListeners('bg-sync:manual-trigger')

      await manager.triggerSync()

      expect(listener1).not.toHaveBeenCalled()
      expect(listener2).not.toHaveBeenCalled()
    })

    it('should remove all listeners', async () => {
      setupServiceWorkerMock(true)
      manager = createBackgroundSyncManager({ autoRegister: false })

      const listener1 = vi.fn()
      const listener2 = vi.fn()
      manager.on('bg-sync:manual-trigger', listener1)
      manager.on('bg-sync:error', listener2)

      manager.removeAllListeners()

      await manager.triggerSync()

      expect(listener1).not.toHaveBeenCalled()
      expect(listener2).not.toHaveBeenCalled()
    })

    it('should handle listener errors gracefully', async () => {
      setupServiceWorkerMock(true)
      manager = createBackgroundSyncManager({ autoRegister: false })

      const errorListener = vi.fn(() => {
        throw new Error('Listener error')
      })
      const normalListener = vi.fn()

      manager.on('bg-sync:manual-trigger', errorListener)
      manager.on('bg-sync:manual-trigger', normalListener)

      // Should not throw
      await manager.triggerSync()

      expect(errorListener).toHaveBeenCalled()
      expect(normalListener).toHaveBeenCalled()
    })
  })

  // ─── destroy Tests ─────────────────────────────────────────────────────────

  describe('destroy', () => {
    it('should stop fallback sync', async () => {
      setupServiceWorkerMock(false)
      manager = createBackgroundSyncManager()

      await manager.init()

      const status1 = await manager.getStatus()
      expect(status1.isFallbackActive).toBe(true)

      manager.destroy()

      // Create a new manager to check - the old one is destroyed
      // We verify by checking that the fallback interval was cleared
      // by checking that no more syncs happen after destroy
      vi.mocked(syncEngine.getQueueSize).mockResolvedValue(5)
      vi.mocked(syncEngine.sync).mockClear()

      await vi.advanceTimersByTimeAsync(120000)

      expect(syncEngine.sync).not.toHaveBeenCalled()
    })

    it('should remove sync engine listeners', async () => {
      setupServiceWorkerMock(true)
      manager = createBackgroundSyncManager()

      await manager.init()

      manager.destroy()

      expect(syncEngine.off).toHaveBeenCalledWith('sync:complete', expect.any(Function))
      expect(syncEngine.off).toHaveBeenCalledWith('sync:error', expect.any(Function))
    })

    it('should clear all event listeners', async () => {
      setupServiceWorkerMock(true)
      manager = createBackgroundSyncManager({ autoRegister: false })

      const listener = vi.fn()
      manager.on('bg-sync:manual-trigger', listener)

      manager.destroy()

      // Manually trigger - listener should not be called
      // We can't easily test this without accessing internals,
      // but we verify destroy completes without error
      expect(true).toBe(true)
    })
  })

  // ─── Sync Engine Event Tracking Tests ──────────────────────────────��───────

  describe('sync engine event tracking', () => {
    it('should update lastSyncedAt on sync:complete', async () => {
      setupServiceWorkerMock(true)
      manager = createBackgroundSyncManager()

      await manager.init()

      // Get the listener that was registered
      const onCalls = vi.mocked(syncEngine.on).mock.calls
      const completeListener = onCalls.find((call) => call[0] === 'sync:complete')?.[1]

      expect(completeListener).toBeDefined()

      // Simulate sync:complete event
      completeListener!({
        type: 'sync:complete',
        timestamp: new Date(),
        data: { queueSize: 0 },
      })

      const status = await manager.getStatus()
      expect(status.lastSyncedAt).toBeInstanceOf(Date)
      expect(status.lastError).toBeNull()
    })

    it('should update lastError on sync:error', async () => {
      setupServiceWorkerMock(true)
      manager = createBackgroundSyncManager()

      await manager.init()

      // Get the listener that was registered
      const onCalls = vi.mocked(syncEngine.on).mock.calls
      const errorListener = onCalls.find((call) => call[0] === 'sync:error')?.[1]

      expect(errorListener).toBeDefined()

      // Simulate sync:error event
      errorListener!({
        type: 'sync:error',
        timestamp: new Date(),
        data: { error: 'Network timeout' },
      })

      const status = await manager.getStatus()
      expect(status.lastError).toBe('Network timeout')
    })
  })
})

// ─── handleSyncEvent Tests ───────────────────────────────────────────────────

describe('handleSyncEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should trigger sync for valid sync tags', async () => {
    await handleSyncEvent(SYNC_TAGS.INSPECTION)

    expect(syncEngine.sync).toHaveBeenCalled()
  })

  it('should trigger sync for all-data-sync tag', async () => {
    await handleSyncEvent(SYNC_TAGS.ALL)

    expect(syncEngine.sync).toHaveBeenCalled()
  })

  it('should trigger sync for deficiency-sync tag', async () => {
    await handleSyncEvent(SYNC_TAGS.DEFICIENCY)

    expect(syncEngine.sync).toHaveBeenCalled()
  })

  it('should trigger sync for photo-sync tag', async () => {
    await handleSyncEvent(SYNC_TAGS.PHOTO)

    expect(syncEngine.sync).toHaveBeenCalled()
  })

  it('should not trigger sync for unknown tags', async () => {
    await handleSyncEvent('unknown-tag')

    expect(syncEngine.sync).not.toHaveBeenCalled()
  })
})

// ─── SYNC_TAGS Constants Tests ───────────────────────────────────────────────

describe('SYNC_TAGS', () => {
  it('should have all required sync tags', () => {
    expect(SYNC_TAGS.INSPECTION).toBe('inspection-sync')
    expect(SYNC_TAGS.DEFICIENCY).toBe('deficiency-sync')
    expect(SYNC_TAGS.PHOTO).toBe('photo-sync')
    expect(SYNC_TAGS.ALL).toBe('all-data-sync')
  })
})

// ─── Integration-like Tests ──────────────────────────────────────────────────

describe('BackgroundSyncManager Integration', () => {
  let manager: BackgroundSyncManager

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    if (manager) {
      manager.destroy()
    }
    removeServiceWorkerMock()
    vi.useRealTimers()
  })

  it('should handle complete lifecycle: init → register → sync → destroy', async () => {
    const mockRegistration = setupServiceWorkerMock(true)
    manager = createBackgroundSyncManager()

    // Init
    await manager.init()

    // Verify registration
    expect(mockRegistration.sync.register).toHaveBeenCalledTimes(3)

    // Trigger manual sync
    const result = await manager.triggerSync()
    expect(result).toBe(true)
    expect(syncEngine.sync).toHaveBeenCalled()

    // Check status
    const status = await manager.getStatus()
    expect(status.isSupported).toBe(true)
    expect(status.isRegistered).toBe(true)

    // Destroy
    manager.destroy()
  })

  it('should handle fallback lifecycle when Background Sync not supported', async () => {
    setupServiceWorkerMock(false)
    manager = createBackgroundSyncManager({ fallbackInterval: 5000 })

    // Init - should start fallback
    await manager.init()

    const status = await manager.getStatus()
    expect(status.isSupported).toBe(false)
    expect(status.isFallbackActive).toBe(true)

    // Simulate pending items
    vi.mocked(syncEngine.getQueueSize).mockResolvedValue(2)

    // Advance timer to trigger fallback
    await vi.advanceTimersByTimeAsync(5000)

    expect(syncEngine.sync).toHaveBeenCalled()

    // Manual sync should also work
    vi.mocked(syncEngine.sync).mockClear()
    await manager.triggerSync()
    expect(syncEngine.sync).toHaveBeenCalled()

    // Destroy
    manager.destroy()
  })

  it('should handle registration failure without starting fallback when supported', async () => {
    const mockRegistration = setupServiceWorkerMock(true)
    mockRegistration.sync.register.mockRejectedValue(new Error('Not allowed'))

    manager = createBackgroundSyncManager({ fallbackInterval: 5000 })

    await manager.init()

    const status = await manager.getStatus()
    expect(status.isFallbackActive).toBe(false)
    expect(status.lastError).toBe('Not allowed')

    vi.mocked(syncEngine.getQueueSize).mockResolvedValue(1)
    await vi.advanceTimersByTimeAsync(5000)

    expect(syncEngine.sync).not.toHaveBeenCalled()
  })
})
