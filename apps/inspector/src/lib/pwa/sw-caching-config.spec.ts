import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  SW_CACHE_EXPIRATION,
  SW_CACHE_NAMES,
  SW_CACHING_STRATEGY_TARGETS,
  isApiRequest,
  isFontRequest,
  isImageRequest,
  isStaticAssetRequest,
  registerInspectorCachingRoutes,
} from './sw-caching-config'

const registerRouteMock = vi.hoisted(() => vi.fn())
const networkFirstMock = vi.hoisted(() => vi.fn())
const cacheFirstMock = vi.hoisted(() => vi.fn())
const staleWhileRevalidateMock = vi.hoisted(() => vi.fn())

vi.mock('workbox-routing', () => ({
  registerRoute: registerRouteMock,
}))

vi.mock('workbox-strategies', () => ({
  NetworkFirst: networkFirstMock,
  CacheFirst: cacheFirstMock,
  StaleWhileRevalidate: staleWhileRevalidateMock,
}))

vi.mock('workbox-background-sync', () => ({
  BackgroundSyncPlugin: vi.fn(),
}))

vi.mock('workbox-cacheable-response', () => ({
  CacheableResponsePlugin: vi.fn(),
}))

vi.mock('workbox-expiration', () => ({
  ExpirationPlugin: vi.fn(),
}))

describe('sw caching config (M11-S10)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    networkFirstMock.mockImplementation((opts: unknown) => ({ strategy: 'NetworkFirst', opts }))
    cacheFirstMock.mockImplementation((opts: unknown) => ({ strategy: 'CacheFirst', opts }))
    staleWhileRevalidateMock.mockImplementation((opts: unknown) => ({
      strategy: 'StaleWhileRevalidate',
      opts,
    }))
  })

  describe('story targets', () => {
    it('defines NetworkFirst API, CacheFirst images/fonts, StaleWhileRevalidate static', () => {
      expect(SW_CACHING_STRATEGY_TARGETS.api.handler).toBe('NetworkFirst')
      expect(SW_CACHING_STRATEGY_TARGETS.api.maxAgeSeconds).toBe(60 * 60 * 24)
      expect(SW_CACHING_STRATEGY_TARGETS.images.handler).toBe('CacheFirst')
      expect(SW_CACHING_STRATEGY_TARGETS.images.maxAgeSeconds).toBe(30 * 24 * 60 * 60)
      expect(SW_CACHING_STRATEGY_TARGETS.static.handler).toBe('StaleWhileRevalidate')
      expect(SW_CACHING_STRATEGY_TARGETS.fonts.handler).toBe('CacheFirst')
      expect(SW_CACHING_STRATEGY_TARGETS.fonts.maxAgeSeconds).toBe(365 * 24 * 60 * 60)
    })

    it('bounds cache size via expiration maxEntries', () => {
      expect(SW_CACHE_EXPIRATION.api.maxEntries).toBe(100)
      expect(SW_CACHE_EXPIRATION.images.maxEntries).toBe(50)
      expect(SW_CACHE_EXPIRATION.fonts.maxEntries).toBe(30)
      expect(SW_CACHE_EXPIRATION.static.maxEntries).toBe(80)
    })
  })

  describe('request matchers', () => {
    it('isApiRequest matches /api and /auth paths', () => {
      expect(isApiRequest(new URL('https://example.com/api/permits'))).toBe(true)
      expect(isApiRequest(new URL('https://example.com/auth/login'))).toBe(true)
      expect(isApiRequest(new URL('https://example.com/assets/app.js'))).toBe(false)
    })

    it('isImageRequest matches image destination and extensions', () => {
      expect(
        isImageRequest(
          new Request('https://example.com/photo.jpg', { destination: 'image' } as RequestInit),
        ),
      ).toBe(true)
      expect(isImageRequest(new Request('https://example.com/icons/logo.svg'))).toBe(true)
      expect(isImageRequest(new Request('https://example.com/app.js'))).toBe(false)
    })

    it('isFontRequest matches font destination and extensions', () => {
      expect(
        isFontRequest(
          new Request('https://example.com/font.woff2', { destination: 'font' } as RequestInit),
        ),
      ).toBe(true)
      expect(isFontRequest(new Request('https://example.com/type/inter.woff2'))).toBe(true)
    })

    it('isStaticAssetRequest matches script/style destinations and js/css paths', () => {
      expect(
        isStaticAssetRequest(
          new Request('https://example.com/assets/index.js', {
            destination: 'script',
          } as RequestInit),
        ),
      ).toBe(true)
      expect(isStaticAssetRequest(new Request('https://example.com/assets/app.css'))).toBe(true)
    })
  })

  describe('registerInspectorCachingRoutes', () => {
    it('registers four runtime routes with expected cache names', () => {
      registerInspectorCachingRoutes()

      expect(registerRouteMock).toHaveBeenCalledTimes(4)

      const strategies = registerRouteMock.mock.calls.map((call) => {
        const strategy = call[1] as { strategy: string; opts: { cacheName: string } }
        return { handler: strategy.strategy, cacheName: strategy.opts.cacheName }
      })

      expect(strategies).toEqual(
        expect.arrayContaining([
          { handler: 'NetworkFirst', cacheName: SW_CACHE_NAMES.api },
          { handler: 'CacheFirst', cacheName: SW_CACHE_NAMES.fonts },
          { handler: 'CacheFirst', cacheName: SW_CACHE_NAMES.images },
          { handler: 'StaleWhileRevalidate', cacheName: SW_CACHE_NAMES.static },
        ]),
      )
    })
  })
})
