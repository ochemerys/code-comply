/**
 * SyncEngine Unit Tests
 *
 * Tests for the core SyncEngine class that manages offline queue,
 * retry logic, and synchronization with the server.
 *
 * @module lib/db/__tests__/sync-engine.spec
 * @see M3-S3 - Create SyncEngine Core Class
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import {
  SyncEngine,
  createSyncEngine,
  type SyncEventListener,
  type SyncEvent,
} from '../sync-engine'
import { db } from '../dexie'
import type { SyncQueueItem, SyncOperation } from '../types'
import * as Sentry from '@sentry/vue'

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../dexie', () => ({
  db: {
    syncQueue: {
      add: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      count: vi.fn(),
      bulkDelete: vi.fn(),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          count: vi.fn(),
          toArray: vi.fn(),
        })),
      })),
    },
    getNextSyncItems: vi.fn(),
  },
}))

vi.mock('@sentry/vue', () => ({
  addBreadcrumb: vi.fn(),
}))

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createMockQueueItem(overrides: Partial<SyncQueueItem> = {}): SyncQueueItem {
  return {
    id: `queue-${Math.random().toString(36).substr(2, 9)}`,
    clientId: `client-${Math.random().toString(36).substr(2, 9)}`,
    operation: 'deficiency.create',
    payload: { description: 'Test deficiency' },
    status: 'PENDING',
    attempts: 0,
    maxAttempts: 3,
    createdAt: new Date().toISOString(),
    priority: 10,
    ...overrides,
  }
}

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('SyncEngine', () => {
  let syncEngine: SyncEngine

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    })

    // Default mock implementations
    vi.mocked(db.syncQueue.add).mockResolvedValue('queue-id')
    vi.mocked(db.syncQueue.update).mockResolvedValue(1)
    vi.mocked(db.syncQueue.delete).mockResolvedValue(undefined)
    vi.mocked(db.syncQueue.clear).mockResolvedValue(undefined)
    vi.mocked(db.syncQueue.count).mockResolvedValue(0)
    vi.mocked(db.getNextSyncItems).mockResolvedValue([])

    const mockWhereEquals = vi.fn(() => ({
      count: vi.fn().mockResolvedValue(0),
      toArray: vi.fn().mockResolvedValue([]),
    }))
    vi.mocked(db.syncQueue.where).mockReturnValue({
      equals: mockWhereEquals,
    } as any)

    // Create a fresh instance for each test
    syncEngine = createSyncEngine()

    // Set authentication to true for tests (simulating logged-in user)
    syncEngine.setAuthCheck(() => true)
  })

  afterEach(() => {
    syncEngine.destroy()
    vi.useRealTimers()
  })

  // ─── Constructor Tests ─────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const status = syncEngine.getStatus()

      expect(status.isOnline).toBe(true)
      expect(status.isSyncing).toBe(false)
      expect(status.lastSyncedAt).toBeNull()
      expect(status.lastError).toBeNull()
    })

    it('should accept custom retry configuration', () => {
      const customEngine = createSyncEngine({
        initialDelay: 2000,
        maxDelay: 120000,
        maxAttempts: 5,
        backoffMultiplier: 3,
      })

      expect(customEngine).toBeInstanceOf(SyncEngine)
      customEngine.destroy()
    })

    it('should detect offline state from navigator', () => {
      Object.defineProperty(navigator, 'onLine', { value: false })
      const offlineEngine = createSyncEngine()

      expect(offlineEngine.getStatus().isOnline).toBe(false)
      offlineEngine.destroy()
    })
  })

  // ─── queueMutation Tests ───────────────────────────────────────────────────

  describe('queueMutation', () => {
    it('should add mutation to queue', async () => {
      const payload = {
        clientId: 'test-123',
        description: 'Test deficiency',
      }

      await syncEngine.queueMutation('deficiency.create', payload)

      expect(db.syncQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'deficiency.create',
          payload,
          status: 'PENDING',
          attempts: 0,
          maxAttempts: 3,
          priority: 10,
        }),
      )
    })

    it('should generate clientId if not provided', async () => {
      const payload = { description: 'Test deficiency' }

      await syncEngine.queueMutation('deficiency.create', payload)

      expect(db.syncQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: expect.any(String),
        }),
      )
    })

    it('should use provided clientId', async () => {
      const payload = {
        clientId: 'my-custom-id',
        description: 'Test',
      }

      await syncEngine.queueMutation('deficiency.create', payload)

      expect(db.syncQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'my-custom-id',
        }),
      )
    })

    it('should accept custom priority', async () => {
      await syncEngine.queueMutation('deficiency.create', { description: 'Test' }, 5)

      expect(db.syncQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 5,
        }),
      )
    })

    it('should return queue item ID', async () => {
      const id = await syncEngine.queueMutation('deficiency.create', { description: 'Test' })

      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })

    it('should emit sync:queue:add event', async () => {
      const listener = vi.fn()
      syncEngine.on('sync:queue:add', listener)

      await syncEngine.queueMutation('deficiency.create', { description: 'Test' })

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sync:queue:add',
          data: expect.objectContaining({
            operation: 'deficiency.create',
          }),
        }),
      )
    })

    it('should trigger sync when online', async () => {
      const syncSpy = vi.spyOn(syncEngine, 'sync')

      await syncEngine.queueMutation('deficiency.create', { description: 'Test' })

      // Advance timers to trigger the setTimeout
      await vi.advanceTimersByTimeAsync(0)

      expect(syncSpy).toHaveBeenCalled()
    })

    it('should not trigger sync when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false })
      const offlineEngine = createSyncEngine()
      const syncSpy = vi.spyOn(offlineEngine, 'sync')

      await offlineEngine.queueMutation('deficiency.create', { description: 'Test' })
      await vi.advanceTimersByTimeAsync(0)

      expect(syncSpy).not.toHaveBeenCalled()
      offlineEngine.destroy()
    })
  })

  // ─── sync Tests ────────────────────────────────────────────────────────────

  describe('sync', () => {
    it('should not sync when already syncing', async () => {
      // Setup processor that succeeds
      syncEngine.setMutationProcessor(async () => ({}))

      // Start a sync with items
      vi.mocked(db.getNextSyncItems).mockResolvedValue([createMockQueueItem()])

      const syncPromise = syncEngine.sync()

      // Try to start another sync immediately
      const secondSyncPromise = syncEngine.sync()

      // Wait for both to complete
      await Promise.all([syncPromise, secondSyncPromise])

      // Only one call to getNextSyncItems (second sync should have been skipped)
      expect(db.getNextSyncItems).toHaveBeenCalledTimes(1)
    })

    it('should not sync when offline', async () => {
      syncEngine.handleOffline()

      await syncEngine.sync()

      expect(db.getNextSyncItems).not.toHaveBeenCalled()
    })

    it('should emit sync:start event', async () => {
      const listener = vi.fn()
      syncEngine.on('sync:start', listener)

      await syncEngine.sync()

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sync:start',
        }),
      )
    })

    it('should emit sync:complete event on success', async () => {
      const listener = vi.fn()
      syncEngine.on('sync:complete', listener)

      await syncEngine.sync()

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sync:complete',
        }),
      )
    })

    it('should clear syncing state before emitting sync:complete', async () => {
      const listener = vi.fn(() => syncEngine.getStatus().isSyncing)
      syncEngine.on('sync:complete', listener)

      await syncEngine.sync()

      expect(listener).toHaveReturnedWith(false)
    })

    it('should update lastSyncedAt on success', async () => {
      await syncEngine.sync()

      const status = syncEngine.getStatus()
      expect(status.lastSyncedAt).toBeInstanceOf(Date)
    })

    it('should clear lastError on success', async () => {
      // First, cause an error
      vi.mocked(db.getNextSyncItems).mockRejectedValueOnce(new Error('Test error'))
      await syncEngine.sync()

      // Then succeed
      vi.mocked(db.getNextSyncItems).mockResolvedValue([])
      await syncEngine.sync()

      const status = syncEngine.getStatus()
      expect(status.lastError).toBeNull()
    })

    it('should add telemetry when sync runs with no pending items', async () => {
      vi.mocked(db.getNextSyncItems).mockResolvedValue([])

      await syncEngine.sync()

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'sync',
          message: 'Sync ran with no pending queue items',
          data: { pendingCount: 0 },
        }),
      )
    })

    it('should abort queue processing when the remote-wipe guard wipes the device', async () => {
      const remoteWipeCheck = vi.fn().mockResolvedValue(true)
      syncEngine.setRemoteWipeCheck(remoteWipeCheck)
      vi.mocked(db.getNextSyncItems).mockResolvedValue([createMockQueueItem()])

      await syncEngine.sync()

      expect(remoteWipeCheck).toHaveBeenCalled()
      expect(db.getNextSyncItems).not.toHaveBeenCalled()
    })

    it('should process the queue when the remote-wipe guard passes', async () => {
      const remoteWipeCheck = vi.fn().mockResolvedValue(false)
      syncEngine.setRemoteWipeCheck(remoteWipeCheck)
      vi.mocked(db.getNextSyncItems).mockResolvedValue([])

      await syncEngine.sync()

      expect(remoteWipeCheck).toHaveBeenCalled()
      expect(db.getNextSyncItems).toHaveBeenCalled()
    })
  })

  // ─── Periodic Sync Tests ───────────────────────────────────────────────────

  describe('periodic sync', () => {
    it('uses a five-minute interval', async () => {
      const mockWhereEquals = vi.fn(() => ({
        count: vi.fn().mockResolvedValue(1),
        toArray: vi.fn().mockResolvedValue([]),
      }))
      vi.mocked(db.syncQueue.where).mockReturnValue({
        equals: mockWhereEquals,
      } as any)
      const syncSpy = vi.spyOn(syncEngine, 'sync')

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000 - 1)
      expect(syncSpy).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)
      expect(syncSpy).toHaveBeenCalledTimes(1)
    })

    it('does not start the periodic timer while the document is hidden', async () => {
      syncEngine.destroy()
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      })
      syncEngine = createSyncEngine()
      syncEngine.setAuthCheck(() => true)
      vi.mocked(db.syncQueue.where).mockClear()
      const syncSpy = vi.spyOn(syncEngine, 'sync')

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000)

      expect(syncSpy).not.toHaveBeenCalled()
      expect(db.syncQueue.where).not.toHaveBeenCalled()
    })

    it('pauses while hidden and restarts with one visible sync attempt', async () => {
      const mockWhereEquals = vi.fn(() => ({
        count: vi.fn().mockResolvedValue(1),
        toArray: vi.fn().mockResolvedValue([]),
      }))
      vi.mocked(db.syncQueue.where).mockReturnValue({
        equals: mockWhereEquals,
      } as any)
      const syncSpy = vi.spyOn(syncEngine, 'sync')

      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000)

      expect(syncSpy).not.toHaveBeenCalled()

      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(0)

      expect(syncSpy).toHaveBeenCalledTimes(1)

      syncSpy.mockClear()
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000)

      expect(syncSpy).toHaveBeenCalledTimes(1)
    })
  })

  // ─── processQueue Tests ────────────────────────────────────────────────────

  describe('processQueue', () => {
    it('should process queue items in order', async () => {
      const items = [
        createMockQueueItem({ id: 'item-1', clientId: 'client-1' }),
        createMockQueueItem({ id: 'item-2', clientId: 'client-2' }),
      ]

      vi.mocked(db.getNextSyncItems).mockResolvedValue(items)

      // Set up a processor that succeeds
      syncEngine.setMutationProcessor(async () => ({}))

      await syncEngine.processQueue()

      // Both items should be deleted (processed successfully)
      expect(db.syncQueue.delete).toHaveBeenCalledWith('item-1')
      expect(db.syncQueue.delete).toHaveBeenCalledWith('item-2')
    })

    it('should stop processing when going offline', async () => {
      const items = [createMockQueueItem({ id: 'item-1' }), createMockQueueItem({ id: 'item-2' })]

      vi.mocked(db.getNextSyncItems).mockResolvedValue(items)

      // Processor that goes offline after first item
      let processCount = 0
      syncEngine.setMutationProcessor(async () => {
        processCount++
        if (processCount === 1) {
          syncEngine.handleOffline()
        }
        return {}
      })

      await syncEngine.processQueue()

      // Only first item should be processed
      expect(db.syncQueue.delete).toHaveBeenCalledTimes(1)
    })

    it('should handle empty queue', async () => {
      vi.mocked(db.getNextSyncItems).mockResolvedValue([])

      await syncEngine.processQueue()

      expect(db.syncQueue.delete).not.toHaveBeenCalled()
    })
  })

  // ─── Retry Logic Tests ─────────────────────────────────────────────────────

  describe('retry logic', () => {
    it('should retry failed items with exponential backoff', async () => {
      // Use zero delay for testing
      syncEngine.destroy()
      syncEngine = createSyncEngine({ initialDelay: 0 })

      const item = createMockQueueItem({ id: 'item-1', attempts: 0 })
      vi.mocked(db.getNextSyncItems).mockResolvedValue([item])

      // Processor that fails
      syncEngine.setMutationProcessor(async () => {
        throw new Error('Network error')
      })

      await syncEngine.processQueue()

      // Should update with incremented attempts
      expect(db.syncQueue.update).toHaveBeenCalledWith(
        'item-1',
        expect.objectContaining({
          status: 'PENDING',
          attempts: 1,
          lastError: 'Network error',
        }),
      )
    })

    it('should mark as failed after max attempts', async () => {
      const item = createMockQueueItem({ id: 'item-1', attempts: 2, maxAttempts: 3 })
      vi.mocked(db.getNextSyncItems).mockResolvedValue([item])

      syncEngine.setMutationProcessor(async () => {
        throw new Error('Network error')
      })

      await syncEngine.processQueue()

      // Should mark as FAILED
      expect(db.syncQueue.update).toHaveBeenCalledWith(
        'item-1',
        expect.objectContaining({
          status: 'FAILED',
          attempts: 3,
        }),
      )
    })

    it('should emit sync:item:retry event on retry', async () => {
      // Use zero delay for testing
      syncEngine.destroy()
      syncEngine = createSyncEngine({ initialDelay: 0 })

      const listener = vi.fn()
      syncEngine.on('sync:item:retry', listener)

      const item = createMockQueueItem({ id: 'item-1', attempts: 0 })
      vi.mocked(db.getNextSyncItems).mockResolvedValue([item])

      syncEngine.setMutationProcessor(async () => {
        throw new Error('Network error')
      })

      await syncEngine.processQueue()

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sync:item:retry',
          data: expect.objectContaining({
            itemId: 'item-1',
            attempt: 1,
          }),
        }),
      )
    })

    it('should emit sync:item:error event on max attempts', async () => {
      const listener = vi.fn()
      syncEngine.on('sync:item:error', listener)

      const item = createMockQueueItem({ id: 'item-1', attempts: 2, maxAttempts: 3 })
      vi.mocked(db.getNextSyncItems).mockResolvedValue([item])

      syncEngine.setMutationProcessor(async () => {
        throw new Error('Network error')
      })

      await syncEngine.processQueue()

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sync:item:error',
          data: expect.objectContaining({
            itemId: 'item-1',
            error: 'Network error',
          }),
        }),
      )
    })

    it('should calculate correct backoff delays', async () => {
      // Test with custom config
      const customEngine = createSyncEngine({
        initialDelay: 1000,
        maxDelay: 60000,
        backoffMultiplier: 2,
      })

      // Access private method through testing
      const calculateDelay = (customEngine as any)._calculateBackoffDelay.bind(customEngine)

      expect(calculateDelay(1)).toBe(1000) // 1000 * 2^0
      expect(calculateDelay(2)).toBe(2000) // 1000 * 2^1
      expect(calculateDelay(3)).toBe(4000) // 1000 * 2^2
      expect(calculateDelay(10)).toBe(60000) // Capped at maxDelay

      customEngine.destroy()
    })
  })

  // ─── Online/Offline Event Handling Tests ───────────────────────────────────

  describe('online/offline handling', () => {
    it('should handle online event', () => {
      syncEngine.handleOffline() // Start offline
      expect(syncEngine.getStatus().isOnline).toBe(false)

      syncEngine.handleOnline()
      expect(syncEngine.getStatus().isOnline).toBe(true)
    })

    it('should handle offline event', () => {
      expect(syncEngine.getStatus().isOnline).toBe(true)

      syncEngine.handleOffline()
      expect(syncEngine.getStatus().isOnline).toBe(false)
    })

    it('should emit online event', () => {
      const listener = vi.fn()
      syncEngine.on('online', listener)

      syncEngine.handleOffline()
      syncEngine.handleOnline()

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'online',
        }),
      )
    })

    it('should emit offline event', () => {
      const listener = vi.fn()
      syncEngine.on('offline', listener)

      syncEngine.handleOffline()

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'offline',
        }),
      )
    })

    it('should trigger sync when coming online', async () => {
      const syncSpy = vi.spyOn(syncEngine, 'sync')

      // Mock queue with pending items
      const mockWhereEquals = vi.fn(() => ({
        count: vi.fn().mockResolvedValue(1),
        toArray: vi.fn().mockResolvedValue([]),
      }))
      vi.mocked(db.syncQueue.where).mockReturnValue({
        equals: mockWhereEquals,
      } as any)

      syncEngine.handleOffline()
      await syncEngine.handleOnline()

      // Wait for async queue check
      await vi.advanceTimersByTimeAsync(0)

      expect(syncSpy).toHaveBeenCalled()
    })
  })

  // ─── Queue Management Tests ────────────────────────────────────────────────

  describe('queue management', () => {
    it('should get queue size', async () => {
      const mockWhereEquals = vi.fn(() => ({
        count: vi.fn().mockResolvedValue(5),
        toArray: vi.fn().mockResolvedValue([]),
      }))
      vi.mocked(db.syncQueue.where).mockReturnValue({
        equals: mockWhereEquals,
      } as any)

      const size = await syncEngine.getQueueSize()

      expect(size).toBe(5)
    })

    it('should get total queue size', async () => {
      vi.mocked(db.syncQueue.count).mockResolvedValue(10)

      const size = await syncEngine.getTotalQueueSize()

      expect(size).toBe(10)
    })

    it('should clear queue', async () => {
      await syncEngine.clearQueue()

      expect(db.syncQueue.clear).toHaveBeenCalled()
    })

    it('should emit sync:queue:clear event', async () => {
      const listener = vi.fn()
      syncEngine.on('sync:queue:clear', listener)

      await syncEngine.clearQueue()

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sync:queue:clear',
          data: { queueSize: 0 },
        }),
      )
    })

    it('should clear failed items', async () => {
      const failedItems = [
        createMockQueueItem({ id: 'failed-1', status: 'FAILED' }),
        createMockQueueItem({ id: 'failed-2', status: 'FAILED' }),
      ]

      const mockWhereEquals = vi.fn(() => ({
        count: vi.fn().mockResolvedValue(2),
        toArray: vi.fn().mockResolvedValue(failedItems),
      }))
      vi.mocked(db.syncQueue.where).mockReturnValue({
        equals: mockWhereEquals,
      } as any)

      const count = await syncEngine.clearFailedItems()

      expect(count).toBe(2)
      expect(db.syncQueue.bulkDelete).toHaveBeenCalledWith(['failed-1', 'failed-2'])
    })

    it('should retry failed items', async () => {
      const failedItems = [createMockQueueItem({ id: 'failed-1', status: 'FAILED', attempts: 3 })]

      const mockWhereEquals = vi.fn(() => ({
        count: vi.fn().mockResolvedValue(1),
        toArray: vi.fn().mockResolvedValue(failedItems),
      }))
      vi.mocked(db.syncQueue.where).mockReturnValue({
        equals: mockWhereEquals,
      } as any)

      const count = await syncEngine.retryFailedItems()

      expect(count).toBe(1)
      expect(db.syncQueue.update).toHaveBeenCalledWith('failed-1', {
        status: 'PENDING',
        attempts: 0,
        lastError: undefined,
        lastAttemptAt: undefined,
      })
    })
  })

  // ─── Event Listener Tests ──────────────────────────────────────────────────

  describe('event listeners', () => {
    it('should add event listener', () => {
      const listener = vi.fn()
      syncEngine.on('sync:start', listener)

      // Trigger event
      syncEngine.sync()

      expect(listener).toHaveBeenCalled()
    })

    it('should remove event listener', async () => {
      const listener = vi.fn()
      syncEngine.on('sync:start', listener)
      syncEngine.off('sync:start', listener)

      await syncEngine.sync()

      expect(listener).not.toHaveBeenCalled()
    })

    it('should remove all listeners for event type', async () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()
      syncEngine.on('sync:start', listener1)
      syncEngine.on('sync:start', listener2)

      syncEngine.removeAllListeners('sync:start')

      await syncEngine.sync()

      expect(listener1).not.toHaveBeenCalled()
      expect(listener2).not.toHaveBeenCalled()
    })

    it('should remove all listeners', async () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()
      syncEngine.on('sync:start', listener1)
      syncEngine.on('sync:complete', listener2)

      syncEngine.removeAllListeners()

      await syncEngine.sync()

      expect(listener1).not.toHaveBeenCalled()
      expect(listener2).not.toHaveBeenCalled()
    })

    it('should handle listener errors gracefully', async () => {
      const errorListener = vi.fn(() => {
        throw new Error('Listener error')
      })
      const normalListener = vi.fn()

      syncEngine.on('sync:start', errorListener)
      syncEngine.on('sync:start', normalListener)

      // Should not throw
      await syncEngine.sync()

      // Both listeners should have been called
      expect(errorListener).toHaveBeenCalled()
      expect(normalListener).toHaveBeenCalled()
    })
  })

  // ─── Mutation Processor Tests ──────────────────────────────────────────────

  describe('mutation processor', () => {
    it('should use registered mutation processor', async () => {
      const processor = vi.fn().mockResolvedValue({ id: 'server-id' })
      syncEngine.setMutationProcessor(processor)

      const item = createMockQueueItem({
        operation: 'deficiency.create',
        payload: { description: 'Test' },
      })
      vi.mocked(db.getNextSyncItems).mockResolvedValue([item])

      await syncEngine.processQueue()

      expect(processor).toHaveBeenCalledWith('deficiency.create', { description: 'Test' })
    })

    it('should throw error if no processor registered', async () => {
      // Use zero delay for testing
      syncEngine.destroy()
      syncEngine = createSyncEngine({ initialDelay: 0 })

      const item = createMockQueueItem()
      vi.mocked(db.getNextSyncItems).mockResolvedValue([item])

      await syncEngine.processQueue()

      // Should update with error
      expect(db.syncQueue.update).toHaveBeenCalledWith(
        item.id,
        expect.objectContaining({
          lastError: expect.stringContaining('No mutation processor registered'),
        }),
      )
    })
  })

  // ─── Status Tests ──────────────────────────────────────────────────────────

  describe('getStatus', () => {
    it('should return current status', () => {
      const status = syncEngine.getStatus()

      expect(status).toEqual({
        isOnline: true,
        isSyncing: false,
        queueSize: 0,
        lastSyncedAt: null,
        lastError: null,
        conflictCount: 0,
      })
    })
  })

  describe('getStatusAsync', () => {
    it('should return status with queue size', async () => {
      const mockWhereEquals = vi.fn(() => ({
        count: vi.fn().mockResolvedValue(5),
        toArray: vi.fn().mockResolvedValue([]),
      }))
      vi.mocked(db.syncQueue.where).mockReturnValue({
        equals: mockWhereEquals,
      } as any)

      const status = await syncEngine.getStatusAsync()

      expect(status.queueSize).toBe(5)
    })
  })

  // ─── Destroy Tests ─────────────────────────────────────────────────────────

  describe('destroy', () => {
    it('should clean up resources', () => {
      const listener = vi.fn()
      syncEngine.on('sync:start', listener)

      syncEngine.destroy()

      // Listeners should be cleared
      syncEngine.sync()
      expect(listener).not.toHaveBeenCalled()
    })
  })

  // ─── Periodic Sync Tests ───────────────────────────────────────────────────

  describe('periodic sync', () => {
    it('should trigger sync periodically when online', async () => {
      const syncSpy = vi.spyOn(syncEngine, 'sync')

      // Mock queue with pending items
      const mockWhereEquals = vi.fn(() => ({
        count: vi.fn().mockResolvedValue(1),
        toArray: vi.fn().mockResolvedValue([]),
      }))
      vi.mocked(db.syncQueue.where).mockReturnValue({
        equals: mockWhereEquals,
      } as any)

      // Advance time by the five-minute battery-friendly interval.
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000)

      expect(syncSpy).toHaveBeenCalled()
    })

    it('should not trigger sync periodically when offline', async () => {
      syncEngine.handleOffline()
      const syncSpy = vi.spyOn(syncEngine, 'sync')
      syncSpy.mockClear()

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000)

      expect(syncSpy).not.toHaveBeenCalled()
    })
  })

  // ─── Conflict Detection Tests ──────────────────────────────────────────────

  describe('conflict detection', () => {
    it('should log conflicts for audit', async () => {
      // Use zero delay for testing
      syncEngine.destroy()
      syncEngine = createSyncEngine({ initialDelay: 0 })

      const consoleSpy = vi.spyOn(console, 'error')

      const item = createMockQueueItem()
      vi.mocked(db.getNextSyncItems).mockResolvedValue([item])

      syncEngine.setMutationProcessor(async () => {
        throw new Error('Conflict: Resource has been modified')
      })

      await syncEngine.processQueue()

      // Verify that error was logged with conflict message
      expect(consoleSpy).toHaveBeenCalled()
      const calls = consoleSpy.mock.calls
      const hasConflictLog = calls.some(
        (call) =>
          call.some((arg) => typeof arg === 'string' && arg.includes('[SyncEngine]')) &&
          call.some((arg) => typeof arg === 'string' && arg.includes('Conflict')),
      )
      expect(hasConflictLog).toBe(true)
    })
  })
})

// ─── Integration-like Tests ──────────────────────────────────────────────────

describe('SyncEngine Integration', () => {
  let syncEngine: SyncEngine

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    })

    vi.mocked(db.syncQueue.add).mockResolvedValue('queue-id')
    vi.mocked(db.syncQueue.update).mockResolvedValue(1)
    vi.mocked(db.syncQueue.delete).mockResolvedValue(undefined)
    vi.mocked(db.getNextSyncItems).mockResolvedValue([])

    const mockWhereEquals = vi.fn(() => ({
      count: vi.fn().mockResolvedValue(0),
      toArray: vi.fn().mockResolvedValue([]),
    }))
    vi.mocked(db.syncQueue.where).mockReturnValue({
      equals: mockWhereEquals,
    } as any)

    syncEngine = createSyncEngine()

    // Set authentication to true for tests (simulating logged-in user)
    syncEngine.setAuthCheck(() => true)
  })

  afterEach(() => {
    syncEngine.destroy()
    vi.useRealTimers()
  })

  it('should handle complete offline-to-online workflow', async () => {
    // Start offline
    syncEngine.handleOffline()

    // Queue mutations while offline
    await syncEngine.queueMutation('deficiency.create', {
      clientId: 'def-1',
      description: 'Test 1',
    })
    await syncEngine.queueMutation('deficiency.create', {
      clientId: 'def-2',
      description: 'Test 2',
    })

    // Verify items were queued
    expect(db.syncQueue.add).toHaveBeenCalledTimes(2)

    // Setup mock for processing
    const items = [
      createMockQueueItem({ id: 'q-1', clientId: 'def-1' }),
      createMockQueueItem({ id: 'q-2', clientId: 'def-2' }),
    ]
    vi.mocked(db.getNextSyncItems).mockResolvedValue(items)

    // Mock queue with pending items for handleOnline check
    const mockWhereEquals = vi.fn(() => ({
      count: vi.fn().mockResolvedValue(2),
      toArray: vi.fn().mockResolvedValue([]),
    }))
    vi.mocked(db.syncQueue.where).mockReturnValue({
      equals: mockWhereEquals,
    } as any)

    // Setup processor
    syncEngine.setMutationProcessor(async () => ({ id: 'server-id' }))

    // Go online
    await syncEngine.handleOnline()

    // Wait for sync to complete
    await vi.advanceTimersByTimeAsync(0)

    // Verify items were processed
    expect(db.syncQueue.delete).toHaveBeenCalledWith('q-1')
    expect(db.syncQueue.delete).toHaveBeenCalledWith('q-2')
  })

  it('should handle network interruption during sync', async () => {
    const items = [
      createMockQueueItem({ id: 'q-1' }),
      createMockQueueItem({ id: 'q-2' }),
      createMockQueueItem({ id: 'q-3' }),
    ]
    vi.mocked(db.getNextSyncItems).mockResolvedValue(items)

    let processCount = 0
    syncEngine.setMutationProcessor(async () => {
      processCount++
      if (processCount === 2) {
        // Simulate going offline during second item
        syncEngine.handleOffline()
      }
      return {}
    })

    await syncEngine.sync()

    // Should have processed first item, started second, then stopped
    expect(db.syncQueue.delete).toHaveBeenCalledTimes(2)
  })
})
