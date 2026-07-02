import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { db } from '@/lib/db/dexie'
import { initEncryptionForSession, teardownEncryptionSession } from '@/lib/db/encryption-bootstrap'
import type { SyncQueueItem } from '@/lib/db/types'
import { useNetworkStore } from './network'

const TEST_REFRESH_TOKEN = 'vitest-refresh-token'
const TEST_USER_ID = 'vitest-user-id'

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createQueueItem(id: string): SyncQueueItem {
  return {
    id,
    clientId: `${id}-client`,
    operation: 'deficiency.create',
    payload: { description: 'Queued deficiency' },
    status: 'PENDING',
    attempts: 0,
    maxAttempts: 3,
    createdAt: new Date().toISOString(),
    priority: 10,
  }
}

describe('useNetworkStore', () => {
  let store: ReturnType<typeof useNetworkStore>

  beforeEach(async () => {
    setActivePinia(createPinia())
    await db.syncQueue.clear()
    store = useNetworkStore()
  })

  afterEach(async () => {
    store?.disposeNetworkListener()
    await db.syncQueue.clear()
    vi.restoreAllMocks()
  })

  it('updates queueSize from Dexie hooks without polling', async () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')

    store.initNetworkListener()
    await store.refreshQueueSize()

    expect(store.queueSize).toBe(0)

    await db.syncQueue.add(createQueueItem('queue-add'))
    await wait(275)

    expect(store.queueSize).toBe(1)

    await db.syncQueue.delete('queue-add')
    await wait(275)

    expect(store.queueSize).toBe(0)
    expect(setIntervalSpy).not.toHaveBeenCalled()
  })

  it('does not touch the encrypted queue before encryption is initialized', async () => {
    teardownEncryptionSession()

    await expect(store.refreshQueueSize()).resolves.toBeUndefined()
    expect(store.queueSize).toBe(0)

    expect(() => store.initNetworkListener()).not.toThrow()
    await wait(0)
    expect(store.queueSize).toBe(0)

    initEncryptionForSession(TEST_REFRESH_TOKEN, TEST_USER_ID)
  })

  it('attaches queue hooks after encryption becomes available', async () => {
    teardownEncryptionSession()

    store.initNetworkListener()
    initEncryptionForSession(TEST_REFRESH_TOKEN, TEST_USER_ID)
    store.initNetworkListener()

    await db.syncQueue.add(createQueueItem('queue-after-encryption'))
    await wait(275)

    expect(store.queueSize).toBe(1)
  })
})
