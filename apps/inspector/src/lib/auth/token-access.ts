/**
 * In-memory auth tokens shared by the page and service worker sync paths.
 */

import {
  clearAuthSessionCache,
  persistAuthSessionCache,
  readAuthSessionCache,
  type CachedAuthSession,
} from './auth-session-cache'

let session: CachedAuthSession | null = null

export function setAuthTokens(tokens: CachedAuthSession | null): void {
  session = tokens
}

export function getAuthTokens(): CachedAuthSession | null {
  return session
}

export async function hydrateAuthTokensFromCache(): Promise<CachedAuthSession | null> {
  if (session) return session
  const cached = await readAuthSessionCache()
  if (cached) session = cached
  return cached
}

export async function persistAuthTokens(tokens: CachedAuthSession): Promise<void> {
  session = tokens
  await persistAuthSessionCache(tokens)
}

export async function clearAuthTokens(): Promise<void> {
  session = null
  await clearAuthSessionCache()
}
