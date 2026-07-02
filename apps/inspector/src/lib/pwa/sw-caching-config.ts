/**
 * Service worker runtime caching configuration (M11-S10).
 * Extracted for unit testing; registered from `src/sw.ts`.
 */
import { registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { BackgroundSyncPlugin } from 'workbox-background-sync'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'

/** Cache bucket names — kept stable for predictable offline upgrades. */
export const SW_CACHE_NAMES = {
  api: 'api-cache',
  images: 'images-cache',
  fonts: 'fonts-cache',
  static: 'static-assets-cache',
} as const

/** Expiration limits to keep total cache storage bounded (M11-S10). */
export const SW_CACHE_EXPIRATION = {
  api: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
  images: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 },
  fonts: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 },
  static: { maxEntries: 80, maxAgeSeconds: 7 * 24 * 60 * 60 },
} as const

const ONE_DAY_SECONDS = 60 * 60 * 24
const THIRTY_DAYS_SECONDS = 30 * ONE_DAY_SECONDS
const ONE_YEAR_SECONDS = 365 * ONE_DAY_SECONDS

/** Story targets — exported for tests and documentation parity. */
export const SW_CACHING_STRATEGY_TARGETS = {
  api: { handler: 'NetworkFirst' as const, maxAgeSeconds: ONE_DAY_SECONDS },
  images: { handler: 'CacheFirst' as const, maxAgeSeconds: THIRTY_DAYS_SECONDS },
  static: { handler: 'StaleWhileRevalidate' as const },
  fonts: { handler: 'CacheFirst' as const, maxAgeSeconds: ONE_YEAR_SECONDS },
} as const

export function isApiRequest(url: URL): boolean {
  return url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')
}

export function isImageRequest(request: Request): boolean {
  if (request.destination === 'image') return true
  try {
    return /\.(?:png|jpe?g|gif|webp|svg|ico)$/i.test(new URL(request.url).pathname)
  } catch {
    return false
  }
}

export function isFontRequest(request: Request): boolean {
  if (request.destination === 'font') return true
  try {
    return /\.(?:woff2?|ttf|otf)$/i.test(new URL(request.url).pathname)
  } catch {
    return false
  }
}

export function isStaticAssetRequest(request: Request): boolean {
  if (request.destination === 'script' || request.destination === 'style') {
    return true
  }
  try {
    return /\.(?:js|css)$/i.test(new URL(request.url).pathname)
  } catch {
    return false
  }
}

/**
 * Register runtime caching routes. Order matters: API and fonts before broad image/static rules.
 */
export function registerInspectorCachingRoutes(): void {
  const apiBackgroundSync = new BackgroundSyncPlugin('api-queue', {
    maxRetentionTime: 24 * 60,
  })

  registerRoute(
    ({ url, request }) => request.method === 'GET' && isApiRequest(url),
    new NetworkFirst({
      cacheName: SW_CACHE_NAMES.api,
      networkTimeoutSeconds: 10,
      plugins: [
        apiBackgroundSync,
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin(SW_CACHE_EXPIRATION.api),
      ],
    }),
  )

  registerRoute(
    ({ request }) => isFontRequest(request),
    new CacheFirst({
      cacheName: SW_CACHE_NAMES.fonts,
      plugins: [new ExpirationPlugin(SW_CACHE_EXPIRATION.fonts)],
    }),
  )

  registerRoute(
    ({ request }) => isImageRequest(request),
    new CacheFirst({
      cacheName: SW_CACHE_NAMES.images,
      plugins: [new ExpirationPlugin(SW_CACHE_EXPIRATION.images)],
    }),
  )

  registerRoute(
    ({ request }) => isStaticAssetRequest(request),
    new StaleWhileRevalidate({
      cacheName: SW_CACHE_NAMES.static,
      plugins: [new ExpirationPlugin(SW_CACHE_EXPIRATION.static)],
    }),
  )
}
