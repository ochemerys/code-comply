/**
 * Configures SyncEngine for service-worker context (no Pinia / localStorage).
 */

import { createInspectorSyncMutationProcessor } from '@/lib/db/inspector-sync-mutation-processor'
import { handleSyncEvent } from '@/lib/db/background-sync'
import { syncEngine } from '@/lib/db/sync-engine'
import { hydrateAuthTokensFromCache } from '@/lib/auth/token-access'

let swSyncInitialized = false

export async function ensureServiceWorkerSyncEngine(): Promise<boolean> {
  const tokens = await hydrateAuthTokensFromCache()
  if (!tokens?.accessToken) {
    console.warn('[sw-sync] No cached auth session — skipping queue drain')
    return false
  }

  if (!swSyncInitialized) {
    syncEngine.setAuthCheck(() => true)
    syncEngine.setMutationProcessor(createInspectorSyncMutationProcessor())
    swSyncInitialized = true
  }

  return true
}

export async function runBackgroundSyncInServiceWorker(tag: string): Promise<void> {
  const ready = await ensureServiceWorkerSyncEngine()
  if (!ready) return
  await handleSyncEvent(tag)
}
