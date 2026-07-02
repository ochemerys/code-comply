import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BG_SYNC_MESSAGE_TYPE } from './bg-sync-messages'
import { dispatchBackgroundSyncToClients, handleServiceWorkerSyncEvent } from './sw-background-sync'
import { SYNC_TAGS } from '@/lib/db/background-sync'

vi.mock('./sw-sync-runner', () => ({
  runBackgroundSyncInServiceWorker: vi.fn().mockResolvedValue(undefined),
}))

import { runBackgroundSyncInServiceWorker } from './sw-sync-runner'

describe('sw-background-sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('posts bg-sync message to open window clients', async () => {
    const postMessage = vi.fn()
    const clients = {
      matchAll: vi.fn().mockResolvedValue([{ postMessage }]),
    } as unknown as ServiceWorkerGlobalScope['clients']

    const notified = await dispatchBackgroundSyncToClients(SYNC_TAGS.DEFICIENCY, clients)

    expect(notified).toBe(true)
    expect(postMessage).toHaveBeenCalledWith({
      type: BG_SYNC_MESSAGE_TYPE,
      tag: SYNC_TAGS.DEFICIENCY,
    })
    expect(runBackgroundSyncInServiceWorker).not.toHaveBeenCalled()
  })

  it('runs SW queue drain when no clients are open', async () => {
    const clients = {
      matchAll: vi.fn().mockResolvedValue([]),
    } as unknown as ServiceWorkerGlobalScope['clients']

    await handleServiceWorkerSyncEvent(SYNC_TAGS.ALL, clients)

    expect(runBackgroundSyncInServiceWorker).toHaveBeenCalledWith(SYNC_TAGS.ALL)
  })

  it('does not run SW drain when a client was notified', async () => {
    const clients = {
      matchAll: vi.fn().mockResolvedValue([{ postMessage: vi.fn() }]),
    } as unknown as ServiceWorkerGlobalScope['clients']

    await handleServiceWorkerSyncEvent(SYNC_TAGS.PHOTO, clients)

    expect(runBackgroundSyncInServiceWorker).not.toHaveBeenCalled()
  })
})
