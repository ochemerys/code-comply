/**
 * Unit tests for useSyncStatus composable
 *
 * @see M3-S5 - Create Sync Status Indicator Components
 * @see Testing Strategy §4.4 - Frontend Composable Testing
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { nextTick, defineComponent } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'

const encryptionState = vi.hoisted(() => ({
  isReady: true,
}))

// Mock sync engine BEFORE importing the composable
vi.mock('@/lib/db/sync-engine', () => {
  type EventHandler = (event: unknown) => void
  const mockHandlers: Record<string, EventHandler[]> = {}

  return {
    syncEngine: {
      getStatus: vi.fn(() => ({
        isOnline: true,
        isSyncing: false,
        queueSize: 0,
        conflictCount: 0,
        lastSyncedAt: null,
        lastError: null,
      })),
      getStatusAsync: vi.fn(async () => ({
        isOnline: true,
        isSyncing: false,
        queueSize: 0,
        conflictCount: 0,
        lastSyncedAt: null,
        lastError: null,
      })),
      getTotalQueueSize: vi.fn(async () => 0),
      sync: vi.fn(async () => undefined),
      retryFailedItems: vi.fn(async () => 0),
      clearFailedItems: vi.fn(async () => 0),
      on: vi.fn((event: string, handler: EventHandler) => {
        if (!mockHandlers[event]) {
          mockHandlers[event] = []
        }
        mockHandlers[event].push(handler)
      }),
      off: vi.fn((event: string, handler: EventHandler) => {
        if (mockHandlers[event]) {
          mockHandlers[event] = mockHandlers[event].filter((h) => h !== handler)
        }
      }),
      _mockHandlers: mockHandlers,
    },
  }
})

vi.mock('@/lib/db/encryption', () => ({
  isEncryptionServiceInitialized: vi.fn(() => encryptionState.isReady),
}))

// Import after mocking
import { useSyncStatus } from './useSyncStatus'
import { syncEngine } from '@/lib/db/sync-engine'
import type { SyncEvent, SyncEventType } from '@/lib/db/sync-engine'

function latestHandler(event: SyncEventType): (event: SyncEvent) => void {
  const handlers = (
    syncEngine as unknown as { _mockHandlers: Record<string, Array<(event: SyncEvent) => void>> }
  )._mockHandlers[event]
  const handler = handlers?.[handlers.length - 1]
  if (!handler) {
    throw new Error(`No handler registered for ${event}`)
  }
  return handler
}

function emitSyncEvent(type: SyncEventType, data?: SyncEvent['data']): void {
  latestHandler(type)({
    type,
    timestamp: new Date('2026-01-01T12:00:00.000Z'),
    data,
  })
}

// Test wrapper component
const TestComponent = defineComponent({
  setup() {
    const syncStatus = useSyncStatus()
    // Return all properties from the composable
    return {
      ...syncStatus,
    }
  },
  template: '<div></div>',
})

describe('useSyncStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    encryptionState.isReady = true

    // Default mock implementations
    vi.mocked(syncEngine.getStatus).mockReturnValue({
      isOnline: true,
      isSyncing: false,
      queueSize: 0,
      conflictCount: 0,
      lastSyncedAt: null,
      lastError: null,
    })

    vi.mocked(syncEngine.getStatusAsync).mockResolvedValue({
      isOnline: true,
      isSyncing: false,
      queueSize: 0,
      conflictCount: 0,
      lastSyncedAt: null,
      lastError: null,
    })

    vi.mocked(syncEngine.getTotalQueueSize).mockResolvedValue(0)
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('initialization', () => {
    it('should initialize with default values', async () => {
      const wrapper = mount(TestComponent)

      await nextTick()
      await flushPromises()

      // Access properties directly from wrapper.vm
      expect(wrapper.vm.isOnline).toBe(true)
      expect(wrapper.vm.isSyncing).toBe(false)
      expect(wrapper.vm.pendingCount).toBe(0)
      expect(wrapper.vm.failedCount).toBe(0)
      expect(wrapper.vm.status).toBe('online')
    })

    it('should fetch initial status on mount', async () => {
      mount(TestComponent)
      await nextTick()
      await flushPromises()

      expect(syncEngine.getStatusAsync).toHaveBeenCalled()
      expect(syncEngine.getTotalQueueSize).toHaveBeenCalled()
    })

    it('should skip encrypted queue reads before encryption is initialized', async () => {
      encryptionState.isReady = false
      vi.mocked(syncEngine.getStatus).mockReturnValue({
        isOnline: false,
        isSyncing: false,
        queueSize: 0,
        conflictCount: 0,
        lastSyncedAt: null,
        lastError: null,
      })

      const wrapper = mount(TestComponent)
      await nextTick()
      await flushPromises()

      expect(syncEngine.getStatus).toHaveBeenCalled()
      expect(syncEngine.getStatusAsync).not.toHaveBeenCalled()
      expect(syncEngine.getTotalQueueSize).not.toHaveBeenCalled()
      expect(wrapper.vm.status).toBe('offline')
      expect(wrapper.vm.pendingCount).toBe(0)
      expect(wrapper.vm.failedCount).toBe(0)
    })

    it('should not start a queue polling interval', async () => {
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')

      mount(TestComponent)
      await nextTick()
      await flushPromises()

      expect(setIntervalSpy).not.toHaveBeenCalled()
      setIntervalSpy.mockRestore()
    })

    it('should register event listeners on mount', async () => {
      mount(TestComponent)
      await nextTick()
      await flushPromises()

      expect(syncEngine.on).toHaveBeenCalledWith('sync:start', expect.any(Function))
      expect(syncEngine.on).toHaveBeenCalledWith('sync:complete', expect.any(Function))
      expect(syncEngine.on).toHaveBeenCalledWith('sync:error', expect.any(Function))
      expect(syncEngine.on).toHaveBeenCalledWith('online', expect.any(Function))
      expect(syncEngine.on).toHaveBeenCalledWith('offline', expect.any(Function))
      expect(syncEngine.on).toHaveBeenCalledWith('sync:queue:add', expect.any(Function))
      expect(syncEngine.on).toHaveBeenCalledWith('sync:queue:clear', expect.any(Function))
      expect(syncEngine.on).toHaveBeenCalledWith('sync:item:error', expect.any(Function))
    })
  })

  describe('status computed', () => {
    it('should return "offline" when not online', async () => {
      vi.mocked(syncEngine.getStatusAsync).mockResolvedValue({
        isOnline: false,
        isSyncing: false,
        queueSize: 0,
        conflictCount: 0,
        lastSyncedAt: null,
        lastError: null,
      })

      const wrapper = mount(TestComponent)

      await nextTick()
      await flushPromises()

      expect(wrapper.vm.status).toBe('offline')
    })

    it('should return "error" when there is an error', async () => {
      vi.mocked(syncEngine.getStatusAsync).mockResolvedValue({
        isOnline: true,
        isSyncing: false,
        queueSize: 0,
        conflictCount: 0,
        lastSyncedAt: null,
        lastError: 'Network error',
      })

      const wrapper = mount(TestComponent)

      await nextTick()
      await flushPromises()

      expect(wrapper.vm.status).toBe('error')
    })

    it('should return "syncing" when sync is in progress', async () => {
      vi.mocked(syncEngine.getStatusAsync).mockResolvedValue({
        isOnline: true,
        isSyncing: true,
        queueSize: 5,
        conflictCount: 0,
        lastSyncedAt: null,
        lastError: null,
      })

      const wrapper = mount(TestComponent)

      await nextTick()
      await flushPromises()

      expect(wrapper.vm.status).toBe('syncing')
    })

    it('should return "online" when online and not syncing', async () => {
      vi.mocked(syncEngine.getStatusAsync).mockResolvedValue({
        isOnline: true,
        isSyncing: false,
        queueSize: 0,
        conflictCount: 0,
        lastSyncedAt: new Date(),
        lastError: null,
      })

      const wrapper = mount(TestComponent)

      // Wait for updateStatus to complete
      await nextTick()
      await flushPromises()

      expect(wrapper.vm.status).toBe('online')
    })
  })

  describe('triggerSync', () => {
    it('should call syncEngine.sync when online', async () => {
      const wrapper = mount(TestComponent)

      await nextTick()
      await flushPromises()
      await wrapper.vm.triggerSync()

      expect(syncEngine.sync).toHaveBeenCalled()
    })

    it('should not call syncEngine.sync when offline', async () => {
      vi.mocked(syncEngine.getStatusAsync).mockClear()
      vi.mocked(syncEngine.getStatusAsync).mockResolvedValue({
        isOnline: false,
        isSyncing: false,
        queueSize: 0,
        conflictCount: 0,
        lastSyncedAt: null,
        lastError: null,
      })

      const wrapper = mount(TestComponent)

      // Wait for updateStatus to complete
      await nextTick()
      await flushPromises()

      // Verify state is offline
      expect(wrapper.vm.isOnline).toBe(false)

      vi.mocked(syncEngine.sync).mockClear()
      await wrapper.vm.triggerSync()

      expect(syncEngine.sync).not.toHaveBeenCalled()
    })

    it('should not call syncEngine.sync when already syncing', async () => {
      vi.mocked(syncEngine.getStatusAsync).mockClear()
      vi.mocked(syncEngine.getStatusAsync).mockResolvedValue({
        isOnline: true,
        isSyncing: true,
        queueSize: 0,
        conflictCount: 0,
        lastSyncedAt: null,
        lastError: null,
      })

      const wrapper = mount(TestComponent)

      // Wait for updateStatus to complete
      await nextTick()
      await flushPromises()

      // Verify state is syncing
      expect(wrapper.vm.isSyncing).toBe(true)

      vi.mocked(syncEngine.sync).mockClear()
      await wrapper.vm.triggerSync()

      expect(syncEngine.sync).not.toHaveBeenCalled()
    })

    it('should handle sync errors gracefully', async () => {
      vi.mocked(syncEngine.sync).mockRejectedValue(new Error('Sync failed'))

      const wrapper = mount(TestComponent)

      await nextTick()
      await flushPromises()

      // Should not throw
      await expect(wrapper.vm.triggerSync()).resolves.toBeUndefined()
    })
  })

  describe('retryFailed', () => {
    it('should call syncEngine.retryFailedItems', async () => {
      vi.mocked(syncEngine.retryFailedItems).mockResolvedValue(3)

      const wrapper = mount(TestComponent)

      await nextTick()
      await flushPromises()
      await wrapper.vm.retryFailed()

      expect(syncEngine.retryFailedItems).toHaveBeenCalled()
    })

    it('should update status after retry', async () => {
      vi.mocked(syncEngine.retryFailedItems).mockResolvedValue(3)

      const wrapper = mount(TestComponent)

      await nextTick()
      await flushPromises()
      await wrapper.vm.retryFailed()

      expect(syncEngine.getStatusAsync).toHaveBeenCalledTimes(2) // Initial + after retry
    })

    it('should handle retry errors gracefully', async () => {
      vi.mocked(syncEngine.retryFailedItems).mockRejectedValue(new Error('Retry failed'))

      const wrapper = mount(TestComponent)

      await nextTick()
      await flushPromises()

      // Should not throw
      await expect(wrapper.vm.retryFailed()).resolves.toBeUndefined()
    })
  })

  describe('clearFailed', () => {
    it('should call syncEngine.clearFailedItems', async () => {
      vi.mocked(syncEngine.clearFailedItems).mockResolvedValue(3)

      const wrapper = mount(TestComponent)

      await nextTick()
      await flushPromises()
      await wrapper.vm.clearFailed()

      expect(syncEngine.clearFailedItems).toHaveBeenCalled()
    })

    it('should update status after clear', async () => {
      vi.mocked(syncEngine.clearFailedItems).mockResolvedValue(3)

      const wrapper = mount(TestComponent)

      await nextTick()
      await flushPromises()
      await wrapper.vm.clearFailed()

      expect(syncEngine.getStatusAsync).toHaveBeenCalledTimes(2) // Initial + after clear
    })

    it('should handle clear errors gracefully', async () => {
      vi.mocked(syncEngine.clearFailedItems).mockRejectedValue(new Error('Clear failed'))

      const wrapper = mount(TestComponent)

      await nextTick()
      await flushPromises()

      // Should not throw
      await expect(wrapper.vm.clearFailed()).resolves.toBeUndefined()
    })
  })

  describe('event handling', () => {
    it('should register event listeners on mount', async () => {
      mount(TestComponent)
      await nextTick()
      await flushPromises()

      // Verify all event listeners are registered
      expect(syncEngine.on).toHaveBeenCalledWith('sync:start', expect.any(Function))
      expect(syncEngine.on).toHaveBeenCalledWith('sync:complete', expect.any(Function))
      expect(syncEngine.on).toHaveBeenCalledWith('sync:error', expect.any(Function))
      expect(syncEngine.on).toHaveBeenCalledWith('online', expect.any(Function))
      expect(syncEngine.on).toHaveBeenCalledWith('offline', expect.any(Function))
      expect(syncEngine.on).toHaveBeenCalledWith('sync:queue:add', expect.any(Function))
      expect(syncEngine.on).toHaveBeenCalledWith('sync:queue:clear', expect.any(Function))
      expect(syncEngine.on).toHaveBeenCalledWith('sync:item:error', expect.any(Function))
    })

    it('should ignore stale async status updates after sync completes', async () => {
      let resolveStatus: (
        value: Awaited<ReturnType<typeof syncEngine.getStatusAsync>>,
      ) => void = () => {}
      vi.mocked(syncEngine.getStatusAsync).mockReturnValue(
        new Promise((resolve) => {
          resolveStatus = resolve
        }),
      )
      vi.mocked(syncEngine.getTotalQueueSize).mockResolvedValue(0)

      const wrapper = mount(TestComponent)
      await nextTick()

      emitSyncEvent('sync:item:success', { queueSize: 0 })
      emitSyncEvent('sync:complete', { queueSize: 0 })

      resolveStatus({
        isOnline: true,
        isSyncing: true,
        queueSize: 0,
        conflictCount: 0,
        lastSyncedAt: null,
        lastError: null,
      })
      await flushPromises()

      expect(wrapper.vm.isSyncing).toBe(false)
      expect(wrapper.vm.status).toBe('online')
    })
  })

  describe('cleanup', () => {
    it('should unregister event listeners on unmount', async () => {
      const wrapper = mount(TestComponent)

      await nextTick()
      await flushPromises()

      // Explicitly unmount the component
      wrapper.unmount()

      // Wait for cleanup to complete
      await nextTick()

      // Verify all event listeners are unregistered
      expect(syncEngine.off).toHaveBeenCalledWith('sync:start', expect.any(Function))
      expect(syncEngine.off).toHaveBeenCalledWith('sync:complete', expect.any(Function))
      expect(syncEngine.off).toHaveBeenCalledWith('sync:error', expect.any(Function))
      expect(syncEngine.off).toHaveBeenCalledWith('online', expect.any(Function))
      expect(syncEngine.off).toHaveBeenCalledWith('offline', expect.any(Function))
      expect(syncEngine.off).toHaveBeenCalledWith('sync:queue:add', expect.any(Function))
      expect(syncEngine.off).toHaveBeenCalledWith('sync:queue:clear', expect.any(Function))
      expect(syncEngine.off).toHaveBeenCalledWith('sync:item:error', expect.any(Function))
    })
  })
})
