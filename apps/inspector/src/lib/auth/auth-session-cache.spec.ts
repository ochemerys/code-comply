import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  AUTH_SESSION_CACHE_NAME,
  AUTH_SESSION_CACHE_KEY,
  clearAuthSessionCache,
  persistAuthSessionCache,
  readAuthSessionCache,
} from './auth-session-cache'

function installCachesStub(): void {
  const entries = new Map<string, Response>()

  vi.stubGlobal('caches', {
    open: vi.fn(async (name: string) => ({
      put: async (key: string, response: Response) => {
        entries.set(`${name}::${key}`, response)
      },
      match: async (key: string) => entries.get(`${name}::${key}`) ?? null,
      keys: async () =>
        [...entries.keys()]
          .filter((k) => k.startsWith(`${name}::`))
          .map((k) => ({ url: k.slice(name.length + 2) })),
    })),
    delete: vi.fn(async (name: string) => {
      for (const key of [...entries.keys()]) {
        if (key.startsWith(`${name}::`)) entries.delete(key)
      }
      return true
    }),
  })
}

describe('auth-session-cache', () => {
  beforeEach(async () => {
    installCachesStub()
    await clearAuthSessionCache()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('persists and reads tokens from Cache API', async () => {
    await persistAuthSessionCache({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    })

    const session = await readAuthSessionCache()
    expect(session).toEqual({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    })

    const cache = await caches.open(AUTH_SESSION_CACHE_NAME)
    const hit = await cache.match(AUTH_SESSION_CACHE_KEY)
    expect(hit).not.toBeNull()
  })

  it('clearAuthSessionCache removes stored session', async () => {
    await persistAuthSessionCache({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    })
    await clearAuthSessionCache()
    expect(await readAuthSessionCache()).toBeNull()
  })
})
