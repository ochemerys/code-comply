/**
 * Mirrors auth tokens into the Cache API so the service worker can read them
 * (localStorage is not available in workers).
 */

export const AUTH_SESSION_CACHE_NAME = 'inspector-auth-session-v1'
export const AUTH_SESSION_CACHE_KEY = '/__inspector__/auth-session'

export type CachedAuthSession = {
  accessToken: string
  refreshToken: string
}

export async function persistAuthSessionCache(session: CachedAuthSession): Promise<void> {
  if (typeof caches === 'undefined') return
  const cache = await caches.open(AUTH_SESSION_CACHE_NAME)
  await cache.put(
    AUTH_SESSION_CACHE_KEY,
    new Response(JSON.stringify(session), {
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

export async function readAuthSessionCache(): Promise<CachedAuthSession | null> {
  if (typeof caches === 'undefined') return null
  try {
    const cache = await caches.open(AUTH_SESSION_CACHE_NAME)
    const res = await cache.match(AUTH_SESSION_CACHE_KEY)
    if (!res) return null
    const parsed = (await res.json()) as CachedAuthSession
    if (
      typeof parsed.accessToken === 'string' &&
      parsed.accessToken.length > 0 &&
      typeof parsed.refreshToken === 'string' &&
      parsed.refreshToken.length > 0
    ) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export async function clearAuthSessionCache(): Promise<void> {
  if (typeof caches === 'undefined') return
  try {
    await caches.delete(AUTH_SESSION_CACHE_NAME)
  } catch {
    /* ignore */
  }
}
