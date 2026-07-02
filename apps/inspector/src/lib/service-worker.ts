/**
 * Service Worker Registration Utilities
 *
 * Handles service worker registration and Background Sync integration.
 *
 * @module lib/service-worker
 * @see M3-S4 - Implement Background Sync API Integration
 */

import { backgroundSyncManager } from './db/background-sync'
import { isBgSyncMessage } from './pwa/bg-sync-messages'
import { syncEngine } from './db/sync-engine'
import { isPwaDevEnabled, warnIfLegacyPwaDevFlagIsSet } from './pwa/env'

/**
 * Register the service worker and initialize background sync.
 *
 * This function:
 * 1. Registers the service worker
 * 2. Initializes the BackgroundSyncManager
 * 3. Sets up Background Sync API or fallback
 */
function registerBackgroundSyncMessageListener(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  const container = navigator.serviceWorker
  if (typeof container.addEventListener !== 'function') return

  container.addEventListener('message', (event) => {
    if (!isBgSyncMessage(event.data)) return
    void syncEngine.sync().catch((err) => {
      console.error('[BackgroundSync] Client sync after SW message failed:', err)
    })
  })
}

function hasServiceWorkerSupport(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator
  )
}

function isSecureServiceWorkerContext(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext === true
}

function isSecurityRegistrationError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'SecurityError') return true
  if (!(error instanceof Error)) return false
  return /operation is insecure|securityerror|secure origin|secure context/i.test(error.message)
}

export async function registerServiceWorker(): Promise<void> {
  /**
   * In local dev, the Workbox dev service worker can aggressively cache assets and cause “blank”
   * screens after hot reload / lazy-route changes (stale chunk loads).
   *
   * Enable explicitly when you intentionally want to test SW behavior in dev:
   * `VITE_ENABLE_PWA_DEV=true pnpm dev`
   */
  warnIfLegacyPwaDevFlagIsSet(import.meta.env)
  if (!isPwaDevEnabled(import.meta.env)) {
    return
  }

  if (!hasServiceWorkerSupport()) {
    return
  }

  if (!isSecureServiceWorkerContext()) {
    console.warn('[PWA] Service worker registration skipped: page is not in a secure context.')
    return
  }

  registerBackgroundSyncMessageListener()

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      // eslint-disable-next-line no-console
      console.log('ServiceWorker registration successful:', registration.scope)

      // Initialize background sync after service worker is ready
      await backgroundSyncManager.init()
      // eslint-disable-next-line no-console
      console.log('BackgroundSync initialized')
    } catch (err) {
      if (isSecurityRegistrationError(err)) {
        console.warn('[PWA] Service worker registration skipped: browser rejected this origin.')
        return
      }
      console.error('ServiceWorker registration failed:', err)
    }
  })
}
