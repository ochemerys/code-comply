/// <reference lib="webworker" />

import { BG_SYNC_MESSAGE_TYPE } from './bg-sync-messages'
import { runBackgroundSyncInServiceWorker } from './sw-sync-runner'

export async function dispatchBackgroundSyncToClients(
  tag: string,
  clients: ServiceWorkerGlobalScope['clients'],
): Promise<boolean> {
  const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true })
  if (windowClients.length === 0) return false

  for (const client of windowClients) {
    client.postMessage({ type: BG_SYNC_MESSAGE_TYPE, tag })
  }
  return true
}

export async function handleServiceWorkerSyncEvent(
  tag: string,
  clients: ServiceWorkerGlobalScope['clients'],
): Promise<void> {
  const notifiedClient = await dispatchBackgroundSyncToClients(tag, clients)
  if (!notifiedClient) {
    await runBackgroundSyncInServiceWorker(tag)
  }
}

export function registerBackgroundSyncHandlers(sw: ServiceWorkerGlobalScope): void {
  sw.addEventListener('sync', (event) => {
    const syncEvent = event as SyncEvent
    event.waitUntil(
      handleServiceWorkerSyncEvent(syncEvent.tag, sw.clients).catch((err) => {
        console.error('[sw] sync handler failed', err)
      }),
    )
  })

  sw.addEventListener('periodicsync', (event) => {
    const periodic = event as ExtendableEvent & { tag: string }
    periodic.waitUntil(
      handleServiceWorkerSyncEvent(periodic.tag, sw.clients).catch((err) => {
        console.error('[sw] periodicsync handler failed', err)
      }),
    )
  })
}
