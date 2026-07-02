/**
 * Background Sync: OS `sync` event → queue drain (M-03 Sync Up).
 *
 * @see 09-P1-service-worker-missing-sync-event-listener
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { handleSyncEvent, SYNC_TAGS } from '@/lib/db/background-sync'
import { syncEngine } from '@/lib/db/sync-engine'
import { setAuthTokens, clearAuthTokens } from '@/lib/auth/token-access'
import { ensureServiceWorkerSyncEngine } from '@/lib/pwa/sw-sync-runner'

vi.mock('@/lib/db/sync-engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/sync-engine')>()
  return {
    ...actual,
    syncEngine: {
      ...actual.syncEngine,
      sync: vi.fn().mockResolvedValue(undefined),
      setAuthCheck: vi.fn(),
      setMutationProcessor: vi.fn(),
    },
  }
})

describe('service worker background sync integration', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await clearAuthTokens()
  })

  it.each([SYNC_TAGS.INSPECTION, SYNC_TAGS.DEFICIENCY, SYNC_TAGS.PHOTO, SYNC_TAGS.ALL] as const)(
    'handleSyncEvent("%s") triggers syncEngine.sync()',
    async (tag) => {
      setAuthTokens({ accessToken: 'test-access', refreshToken: 'test-refresh' })
      await ensureServiceWorkerSyncEngine()

      await handleSyncEvent(tag)

      expect(syncEngine.sync).toHaveBeenCalled()
    },
  )

  it('handleSyncEvent ignores unknown tags', async () => {
    setAuthTokens({ accessToken: 'test-access', refreshToken: 'test-refresh' })
    await ensureServiceWorkerSyncEngine()

    await handleSyncEvent('not-a-real-tag')

    expect(syncEngine.sync).not.toHaveBeenCalled()
  })
})
