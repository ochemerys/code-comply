/// <reference lib="webworker" />
/**
 * Inspector PWA service worker — precache app shell + runtime caching (M11-S10).
 */
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { registerInspectorCachingRoutes } from './lib/pwa/sw-caching-config'
import { registerPushHandlers } from './lib/pwa/sw-push-handlers'
import { registerBackgroundSyncHandlers } from './lib/pwa/sw-background-sync'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerInspectorCachingRoutes()
registerPushHandlers(self)
registerBackgroundSyncHandlers(self)

self.skipWaiting()
clientsClaim()
