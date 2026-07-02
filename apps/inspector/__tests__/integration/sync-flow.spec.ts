/**
 * Integration Tests for Sync Flow
 *
 * Tests the complete offline-first synchronization workflow including:
 * - Queue mutation when offline
 * - Process queue when online
 * - Retry logic with exponential backoff
 * - Conflict detection and resolution
 * - Data persistence across sync operations
 *
 * @see M3-S10 - Write Integration Tests for Sync Flow
 * @see M-03 (Offline Workflow) - Sync up, conflict resolution
 * @see testing-strategy.md - Integration Testing Guidelines
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createSyncEngine, type SyncEngine } from '@/lib/db/sync-engine'
import { db } from '@/lib/db/dexie'
import type { SyncQueueItem, LocalDeficiency, LocalInspection } from '@/lib/db/types'

// ─── Test Setup ──────────────────────────────────────────────────────────────

/**
 * Mock API client for testing sync operations
 */
class MockAPIClient {
  private _shouldFail: boolean = false
  private _failureCount: number = 0
  private _maxFailures: number = 0
  private _responses: Map<string, unknown> = new Map()
  private _conflicts: Set<string> = new Set()

  /**
   * Configure the mock to fail for a certain number of attempts
   */
  setFailureMode(maxFailures: number): void {
    this._shouldFail = true
    this._failureCount = 0
    this._maxFailures = maxFailures
  }

  /**
   * Configure the mock to return a conflict for a specific clientId
   */
  setConflict(clientId: string): void {
    this._conflicts.add(clientId)
  }

  /**
   * Clear all conflicts
   */
  clearConflicts(): void {
    this._conflicts.clear()
  }

  /**
   * Reset the mock to success mode
   */
  reset(): void {
    this._shouldFail = false
    this._failureCount = 0
    this._maxFailures = 0
    this._responses.clear()
    this._conflicts.clear()
  }

  /**
   * Simulate API call for mutation
   */
  async processMutation(
    operation: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Check if should fail
    if (this._shouldFail && this._failureCount < this._maxFailures) {
      this._failureCount++
      throw new Error(`Network error (attempt ${this._failureCount})`)
    }

    // Check for conflict
    const clientId = payload.clientId as string
    if (this._conflicts.has(clientId)) {
      throw new Error(`Conflict: Resource ${clientId} has been modified`)
    }

    // Success - return mock response
    const response = {
      id: payload.id || `server-${crypto.randomUUID()}`,
      clientId,
      ...payload,
      syncedAt: new Date().toISOString(),
      etag: `etag-${crypto.randomUUID()}`,
    }

    this._responses.set(clientId, response)
    return response
  }

  /**
   * Get a stored response by clientId
   */
  getResponse(clientId: string): unknown {
    return this._responses.get(clientId)
  }
}

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const createMockDeficiency = (overrides?: Partial<LocalDeficiency>): LocalDeficiency => ({
  id: `def-${crypto.randomUUID()}`,
  clientId: `client-${crypto.randomUUID()}`,
  inspectionId: 'insp-123',
  createdById: 'user-456',
  description: 'Test deficiency',
  location: 'Room 101',
  severity: 'MAJOR',
  status: 'OPEN',
  isStopWork: false,
  isUnsafe: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  isDirty: true,
  ...overrides,
})

/** Keep SyncEngine online flag in sync with navigator.onLine (handleOnline also auto-syncs). */
function setEngineOnlineState(engine: SyncEngine, online: boolean): void {
  Object.defineProperty(navigator, 'onLine', { writable: true, value: online })
  if (online) {
    ;(engine as unknown as { _isOnline: boolean })._isOnline = true
  } else {
    engine.handleOffline()
  }
}

/** Prevent auto-sync while queueing by simulating offline state. */
function goOffline(engine: SyncEngine): void {
  setEngineOnlineState(engine, false)
}

/** Restore online state without triggering auto-sync (call sync/handleOnline explicitly). */
function goOnlineWithoutSync(engine: SyncEngine): void {
  setEngineOnlineState(engine, true)
}

const createMockInspection = (overrides?: Partial<LocalInspection>): LocalInspection => ({
  id: `insp-${crypto.randomUUID()}`,
  clientId: `client-${crypto.randomUUID()}`,
  permitId: 'permit-789',
  permitNumber: 'P-2024-001',
  permitAddress: '123 Main St',
  status: 'SCHEDULED',
  scheduledDate: new Date().toISOString(),
  assignedToId: 'user-101',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  isDirty: true,
  ...overrides,
})

// ─── Integration Tests ───────────────────────────────────────────────────────

describe('Sync Flow Integration Tests', () => {
  let syncEngine: SyncEngine
  let mockAPI: MockAPIClient

  beforeEach(async () => {
    // Clear database
    await db.syncQueue.clear()
    await db.deficiencies.clear()
    await db.inspections.clear()

    // Create fresh sync engine instance
    syncEngine = createSyncEngine({
      initialDelay: 10, // Fast retries for testing
      maxDelay: 100,
      maxAttempts: 3,
      backoffMultiplier: 2,
    })

    // Create mock API client
    mockAPI = new MockAPIClient()

    // Register mutation processor
    syncEngine.setMutationProcessor(async (operation, payload) => {
      return mockAPI.processMutation(operation, payload)
    })

    // Register auth check (always authenticated for tests)
    syncEngine.setAuthCheck(() => true)

    // Simulate online state
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    })
  })

  afterEach(async () => {
    // Cleanup
    syncEngine.destroy()
    mockAPI.reset()
    await db.syncQueue.clear()
    await db.deficiencies.clear()
    await db.inspections.clear()
  })

  // ─── Scenario 1: Create Item Offline, Sync When Online ────────────────────

  describe('Scenario 1: Create item offline, sync when online', () => {
    it('should queue deficiency when offline and sync when online', async () => {
      // Arrange: Go offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      })
      syncEngine.handleOffline()

      const deficiency = createMockDeficiency()

      // Act: Queue mutation while offline
      const queueId = await syncEngine.queueMutation('deficiency.create', deficiency)

      // Assert: Item is queued
      expect(queueId).toBeDefined()
      const queueSize = await syncEngine.getQueueSize()
      expect(queueSize).toBe(1)

      // Act: Go online and sync
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      })
      await syncEngine.handleOnline()

      // Wait for the queue to drain and the mutation to reach the API. Poll on
      // the real end-state instead of a fixed delay so the test stays
      // deterministic when the machine is saturated under parallel load.
      await vi.waitFor(async () => {
        expect(await syncEngine.getQueueSize()).toBe(0)
        expect(mockAPI.getResponse(deficiency.clientId)).toBeDefined()
      })

      // Assert: API received the mutation
      const response = mockAPI.getResponse(deficiency.clientId)
      expect((response as Record<string, unknown>).clientId).toBe(deficiency.clientId)
    })

    it('should sync inspection when coming online', async () => {
      // Arrange: Go offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      })
      syncEngine.handleOffline()

      const inspection = createMockInspection()

      // Act: Queue mutation while offline
      await syncEngine.queueMutation('inspection.update', inspection)

      // Assert: Item is queued
      const queueSize = await syncEngine.getQueueSize()
      expect(queueSize).toBe(1)

      // Act: Go online and sync
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      })
      await syncEngine.handleOnline()

      // Wait for the queue to drain (poll instead of a fixed delay).
      await vi.waitFor(async () => {
        expect(await syncEngine.getQueueSize()).toBe(0)
      })
    })
  })

  // ─── Scenario 2: Update Item Offline, Sync with Conflict ──────────────────

  describe('Scenario 2: Update item offline, sync with conflict', () => {
    it('should detect conflict and mark item as failed', async () => {
      // Arrange: Create deficiency with conflict
      const deficiency = createMockDeficiency()
      mockAPI.setConflict(deficiency.clientId)

      goOffline(syncEngine)

      // Act: Queue mutation
      await syncEngine.queueMutation('deficiency.update', deficiency)

      goOnlineWithoutSync(syncEngine)

      // Act: Sync
      await syncEngine.sync()

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Assert: Item should be marked as failed after max attempts
      const failedItems = await db.syncQueue.where('status').equals('FAILED').toArray()
      expect(failedItems.length).toBe(1)
      expect(failedItems[0].clientId).toBe(deficiency.clientId)
      expect(failedItems[0].lastError).toContain('Conflict')
    })

    it('should log conflict for audit', async () => {
      // Arrange: Create deficiency with conflict
      const deficiency = createMockDeficiency()
      mockAPI.setConflict(deficiency.clientId)

      // Setup event listener to capture conflict
      let conflictDetected = false
      syncEngine.on('sync:item:error', (event) => {
        if (event.data?.error?.includes('Conflict')) {
          conflictDetected = true
        }
      })

      goOffline(syncEngine)

      // Act: Queue and sync
      await syncEngine.queueMutation('deficiency.update', deficiency)

      goOnlineWithoutSync(syncEngine)
      await syncEngine.sync()

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Assert: Conflict was detected and logged
      expect(conflictDetected).toBe(true)
    })
  })

  // ─── Scenario 3: Delete Item Offline, Sync Successfully ───────────────────

  describe('Scenario 3: Delete item offline, sync successfully', () => {
    it('should queue delete operation and sync successfully', async () => {
      // Arrange: Create deficiency to delete
      const deficiency = createMockDeficiency()

      // Act: Queue delete mutation
      await syncEngine.queueMutation('deficiency.delete', {
        clientId: deficiency.clientId,
        id: deficiency.id,
      })

      // Assert: Item is queued
      const queueSize = await syncEngine.getQueueSize()
      expect(queueSize).toBe(1)

      // Act: Sync
      await syncEngine.sync()

      // Wait for the queue to drain and the delete to reach the API (poll).
      await vi.waitFor(async () => {
        expect(await syncEngine.getQueueSize()).toBe(0)
        expect(mockAPI.getResponse(deficiency.clientId)).toBeDefined()
      })
    })
  })

  // ─── Scenario 4: Multiple Items Sync in Order (FIFO) ──────────────────────

  describe('Scenario 4: Multiple items sync in order', () => {
    it('should process queue items in FIFO order within priority levels', async () => {
      // Arrange: Create multiple deficiencies with different priorities
      const deficiency1 = createMockDeficiency({ description: 'First (priority 10)' })
      const deficiency2 = createMockDeficiency({ description: 'Second (priority 10)' })
      const deficiency3 = createMockDeficiency({ description: 'Third (priority 1 - high)' })

      // Track processing order
      const processedOrder: string[] = []
      syncEngine.on('sync:item:success', (event) => {
        if (event.data?.itemId) {
          processedOrder.push(event.data.itemId)
        }
      })

      goOffline(syncEngine)

      // Act: Queue mutations with different priorities
      const id1 = await syncEngine.queueMutation('deficiency.create', deficiency1, 10)
      const id2 = await syncEngine.queueMutation('deficiency.create', deficiency2, 10)
      const id3 = await syncEngine.queueMutation('deficiency.create', deficiency3, 1) // High priority

      goOnlineWithoutSync(syncEngine)

      // Act: Sync
      await syncEngine.sync()

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Assert: High priority item processed first
      expect(processedOrder[0]).toBe(id3) // High priority first
      expect(processedOrder).toContain(id1)
      expect(processedOrder).toContain(id2)
      expect(processedOrder.length).toBe(3)
    })

    it('should process all items even if one fails', async () => {
      // Arrange: Create deficiencies, one will fail
      const deficiency1 = createMockDeficiency()
      const deficiency2 = createMockDeficiency()
      const deficiency3 = createMockDeficiency()

      // Make second one fail
      mockAPI.setConflict(deficiency2.clientId)

      // Track successes
      let successCount = 0
      syncEngine.on('sync:item:success', () => {
        successCount++
      })

      goOffline(syncEngine)

      // Act: Queue mutations
      await syncEngine.queueMutation('deficiency.create', deficiency1)
      await syncEngine.queueMutation('deficiency.create', deficiency2)
      await syncEngine.queueMutation('deficiency.create', deficiency3)

      goOnlineWithoutSync(syncEngine)

      // Act: Sync
      await syncEngine.sync()

      // Wait for processing (includes conflict retries)
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Assert: Two items succeeded, one failed
      expect(successCount).toBe(2)

      const failedItems = await db.syncQueue.where('status').equals('FAILED').toArray()
      expect(failedItems.length).toBe(1)
      expect(failedItems[0].clientId).toBe(deficiency2.clientId)
    })
  })

  // ─── Scenario 5: Retry Failed Sync with Exponential Backoff ───────────────

  describe('Scenario 5: Retry failed sync with exponential backoff', () => {
    it('should retry failed items with exponential backoff', async () => {
      // Arrange: Configure mock to fail twice, then succeed
      mockAPI.setFailureMode(2)

      const deficiency = createMockDeficiency()

      // Track retry attempts
      const retryAttempts: number[] = []
      syncEngine.on('sync:item:retry', (event) => {
        if (event.data?.attempt) {
          retryAttempts.push(event.data.attempt)
        }
      })

      goOffline(syncEngine)

      // Act: Queue mutation
      await syncEngine.queueMutation('deficiency.create', deficiency)

      goOnlineWithoutSync(syncEngine)

      // Act: Sync
      await syncEngine.sync()

      // Wait for retries to complete
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Assert: Item was retried
      expect(retryAttempts.length).toBeGreaterThan(0)

      // Assert: Eventually succeeded
      const queueSize = await syncEngine.getQueueSize()
      expect(queueSize).toBe(0)

      // Assert: API received the mutation
      const response = mockAPI.getResponse(deficiency.clientId)
      expect(response).toBeDefined()
    })

    it('should mark item as failed after max attempts', async () => {
      // Arrange: Configure mock to always fail
      mockAPI.setFailureMode(10) // More than max attempts

      const deficiency = createMockDeficiency()

      goOffline(syncEngine)

      // Act: Queue mutation
      await syncEngine.queueMutation('deficiency.create', deficiency)

      goOnlineWithoutSync(syncEngine)

      // Act: Sync
      await syncEngine.sync()

      // Wait for all retry attempts
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Assert: Item is marked as failed
      const failedItems = await db.syncQueue.where('status').equals('FAILED').toArray()
      expect(failedItems.length).toBe(1)
      expect(failedItems[0].attempts).toBe(3) // Max attempts
      expect(failedItems[0].lastError).toContain('Network error')
    })

    it('should allow manual retry of failed items', async () => {
      // Arrange: Configure mock to fail initially
      mockAPI.setFailureMode(10)

      const deficiency = createMockDeficiency()

      goOffline(syncEngine)

      // Act: Queue and sync (will fail)
      await syncEngine.queueMutation('deficiency.create', deficiency)

      goOnlineWithoutSync(syncEngine)
      await syncEngine.sync()
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Assert: Item is failed
      let failedCount = await db.syncQueue.where('status').equals('FAILED').count()
      expect(failedCount).toBe(1)

      // Act: Fix the issue and retry
      mockAPI.reset() // Now it will succeed
      const retriedCount = await syncEngine.retryFailedItems()

      expect(retriedCount).toBe(1)

      // Wait for retry to complete
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Assert: Item succeeded
      failedCount = await db.syncQueue.where('status').equals('FAILED').count()
      expect(failedCount).toBe(0)

      const queueSize = await syncEngine.getQueueSize()
      expect(queueSize).toBe(0)
    })
  })

  // ─── Scenario 6: Handle Network Errors Gracefully ─────────────────────────

  describe('Scenario 6: Handle network errors gracefully', () => {
    it('should handle network errors without crashing', async () => {
      // Arrange: Configure mock to throw network error
      mockAPI.setFailureMode(1)

      const deficiency = createMockDeficiency()

      // Track errors
      let errorCaught = false
      syncEngine.on('sync:item:retry', (event) => {
        if (event.data?.error?.includes('Network error')) {
          errorCaught = true
        }
      })

      // Act: Queue and sync
      await syncEngine.queueMutation('deficiency.create', deficiency)
      await syncEngine.sync()

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Assert: Error was caught and handled
      expect(errorCaught).toBe(true)

      // Assert: Sync engine is still functional
      const status = await syncEngine.getStatusAsync()
      expect(status.isOnline).toBe(true)
      expect(status.isSyncing).toBe(false)
    })

    it('should emit sync:item:error event when an item exhausts retries', async () => {
      // Arrange: Configure mock to always fail
      mockAPI.setFailureMode(10)

      const deficiency = createMockDeficiency()

      // Track per-item sync errors (sync:error is only for top-level processQueue failures)
      let itemErrorEmitted = false
      syncEngine.on('sync:item:error', (event) => {
        if (event.data?.error?.includes('Network error')) {
          itemErrorEmitted = true
        }
      })

      goOffline(syncEngine)

      // Act: Queue and sync
      await syncEngine.queueMutation('deficiency.create', deficiency)

      goOnlineWithoutSync(syncEngine)
      await syncEngine.sync()

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Assert: Item-level error event was emitted after max retries
      expect(itemErrorEmitted).toBe(true)
    })

    it('should continue processing queue after network recovery', async () => {
      // Arrange: Create multiple deficiencies
      const deficiency1 = createMockDeficiency()
      const deficiency2 = createMockDeficiency()

      goOffline(syncEngine)

      // Queue mutations
      await syncEngine.queueMutation('deficiency.create', deficiency1)
      await syncEngine.queueMutation('deficiency.create', deficiency2)

      // Simulate network failure
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      })
      syncEngine.handleOffline()

      // Try to sync (should not process)
      await syncEngine.sync()

      // Assert: Queue still has items
      let queueSize = await syncEngine.getQueueSize()
      expect(queueSize).toBe(2)

      // Simulate network recovery
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      })
      await syncEngine.handleOnline()

      // Wait for sync to complete
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Assert: Queue is empty after recovery
      queueSize = await syncEngine.getQueueSize()
      expect(queueSize).toBe(0)
    })
  })

  // ─── Data Persistence Tests ───────────────────────────────────────────────

  describe('Data Persistence', () => {
    it('should persist queue items across sync engine restarts', async () => {
      // Arrange: Queue items
      const deficiency = createMockDeficiency()
      await syncEngine.queueMutation('deficiency.create', deficiency)

      // Assert: Item is in queue
      let queueSize = await syncEngine.getQueueSize()
      expect(queueSize).toBe(1)

      // Act: Destroy and recreate sync engine
      syncEngine.destroy()

      const newSyncEngine = createSyncEngine()
      newSyncEngine.setMutationProcessor(async (operation, payload) => {
        return mockAPI.processMutation(operation, payload)
      })
      newSyncEngine.setAuthCheck(() => true)

      // Assert: Queue items are still there
      queueSize = await newSyncEngine.getQueueSize()
      expect(queueSize).toBe(1)

      // Cleanup
      newSyncEngine.destroy()
    })

    it('should maintain queue order after restart', async () => {
      // Arrange: Queue multiple items
      const deficiency1 = createMockDeficiency()
      const deficiency2 = createMockDeficiency()
      const deficiency3 = createMockDeficiency()

      goOffline(syncEngine)

      await syncEngine.queueMutation('deficiency.create', deficiency1, 10)
      await syncEngine.queueMutation('deficiency.create', deficiency2, 5)
      await syncEngine.queueMutation('deficiency.create', deficiency3, 1)

      // Act: Destroy and recreate sync engine
      syncEngine.destroy()

      const newSyncEngine = createSyncEngine()
      newSyncEngine.setMutationProcessor(async (operation, payload) => {
        return mockAPI.processMutation(operation, payload)
      })
      newSyncEngine.setAuthCheck(() => true)

      // Act: Get queue items
      const items = await db.getNextSyncItems(10)

      // Assert: Items are in priority order
      expect(items.length).toBe(3)
      expect(items[0].priority).toBe(1) // Highest priority first
      expect(items[1].priority).toBe(5)
      expect(items[2].priority).toBe(10)

      // Cleanup
      newSyncEngine.destroy()
    })
  })

  // ─── Authentication Tests ────────────────────────────────────────────────

  describe('Authentication', () => {
    it('should not sync when user is not authenticated', async () => {
      // Arrange: Set auth check to return false
      syncEngine.setAuthCheck(() => false)

      const deficiency = createMockDeficiency()

      // Act: Queue mutation
      await syncEngine.queueMutation('deficiency.create', deficiency)

      // Act: Try to sync
      await syncEngine.sync()

      // Wait
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Assert: Queue still has items (sync didn't run)
      const queueSize = await syncEngine.getQueueSize()
      expect(queueSize).toBe(1)
    })

    it('should pause sync on logout and resume on login', async () => {
      // Arrange: Queue items
      const deficiency = createMockDeficiency()

      goOffline(syncEngine)
      await syncEngine.queueMutation('deficiency.create', deficiency)

      goOnlineWithoutSync(syncEngine)

      // Act: Pause sync (simulate logout)
      syncEngine.pauseSync()

      // Try to sync
      await syncEngine.sync()
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Assert: Queue still has items
      let queueSize = await syncEngine.getQueueSize()
      expect(queueSize).toBe(1)

      // Act: Resume sync (simulate login)
      await syncEngine.resumeSync()
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Assert: Queue is empty after resume
      queueSize = await syncEngine.getQueueSize()
      expect(queueSize).toBe(0)
    })
  })

  // ─── Event Emission Tests ────────────────────────────────────────────────

  describe('Event Emission', () => {
    it('should emit sync:start and sync:complete events', async () => {
      // Arrange: Track events
      let startEmitted = false
      let completeEmitted = false

      syncEngine.on('sync:start', () => {
        startEmitted = true
      })

      syncEngine.on('sync:complete', () => {
        completeEmitted = true
      })

      goOffline(syncEngine)

      const deficiency = createMockDeficiency()
      await syncEngine.queueMutation('deficiency.create', deficiency)

      goOnlineWithoutSync(syncEngine)

      // Act: Sync
      await syncEngine.sync()

      // Wait for the sync lifecycle events (poll instead of a fixed delay).
      await vi.waitFor(() => {
        expect(startEmitted).toBe(true)
        expect(completeEmitted).toBe(true)
      })
    })

    it('should emit sync:item:success for each successful item', async () => {
      // Arrange: Track successes
      const successfulItems: string[] = []

      syncEngine.on('sync:item:success', (event) => {
        if (event.data?.itemId) {
          successfulItems.push(event.data.itemId)
        }
      })

      goOffline(syncEngine)

      const deficiency1 = createMockDeficiency()
      const deficiency2 = createMockDeficiency()

      const id1 = await syncEngine.queueMutation('deficiency.create', deficiency1)
      const id2 = await syncEngine.queueMutation('deficiency.create', deficiency2)

      goOnlineWithoutSync(syncEngine)

      // Act: Sync once with both items queued (avoids auto-sync races while online)
      await syncEngine.sync()
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Assert: Success events emitted for both items
      expect(successfulItems).toEqual(expect.arrayContaining([id1, id2]))
      expect(successfulItems.length).toBe(2)
    })

    it('should emit online/offline events', async () => {
      // Arrange: Track events
      let onlineEmitted = false
      let offlineEmitted = false

      syncEngine.on('online', () => {
        onlineEmitted = true
      })

      syncEngine.on('offline', () => {
        offlineEmitted = true
      })

      // Act: Simulate offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      })
      syncEngine.handleOffline()

      // Assert: Offline event emitted
      expect(offlineEmitted).toBe(true)

      // Act: Simulate online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      })
      await syncEngine.handleOnline()

      // Assert: Online event emitted
      expect(onlineEmitted).toBe(true)
    })
  })
})
