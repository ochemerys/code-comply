/**
 * M11-S10 — Service worker caching strategies integration checks.
 */
import { describe, it, expect } from 'vitest'
import { SW_CACHE_EXPIRATION, SW_CACHE_NAMES } from '@/lib/pwa/sw-caching-config'

describe('service worker caching (M11-S10 integration)', () => {
  it('exposes stable cache bucket names for offline debugging', () => {
    expect(SW_CACHE_NAMES.api).toBe('api-cache')
    expect(SW_CACHE_NAMES.images).toBe('images-cache')
    expect(SW_CACHE_NAMES.static).toBe('static-assets-cache')
    expect(SW_CACHE_NAMES.fonts).toBe('fonts-cache')
  })

  it('keeps total cached entries bounded across buckets', () => {
    const totalMaxEntries =
      SW_CACHE_EXPIRATION.api.maxEntries +
      SW_CACHE_EXPIRATION.images.maxEntries +
      SW_CACHE_EXPIRATION.fonts.maxEntries +
      SW_CACHE_EXPIRATION.static.maxEntries

    expect(totalMaxEntries).toBeLessThanOrEqual(260)
    expect(SW_CACHE_EXPIRATION.api.maxAgeSeconds).toBe(60 * 60 * 24)
    expect(SW_CACHE_EXPIRATION.images.maxAgeSeconds).toBe(30 * 24 * 60 * 60)
    expect(SW_CACHE_EXPIRATION.fonts.maxAgeSeconds).toBe(365 * 24 * 60 * 60)
  })
})
