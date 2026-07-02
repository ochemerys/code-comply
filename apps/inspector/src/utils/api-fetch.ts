/**
 * Authenticated fetch with silent token refresh on 401.
 * Safe for service worker bundles — does not import vue-router or login views.
 */

import type { TokenDTO } from '@codecomply/validators'
import { getActivePinia } from 'pinia'
import { getApiBaseUrl } from '@/lib/api-base'
import {
  getAuthTokens,
  hydrateAuthTokensFromCache,
  persistAuthTokens,
  setAuthTokens,
} from '@/lib/auth/token-access'

/** Shared in-flight refresh so concurrent 401s trigger one POST /auth/refresh. */
let refreshInFlight: Promise<boolean> | null = null

async function getAuthStore() {
  if (typeof window === 'undefined' || !getActivePinia()) return null
  const { useAuthStore } = await import('../stores/auth')
  return useAuthStore()
}

async function resolveRefreshToken(): Promise<string | null> {
  const authStore = await getAuthStore()
  if (authStore?.refreshToken) return authStore.refreshToken

  const inMemory = getAuthTokens()?.refreshToken
  if (inMemory) return inMemory

  const cached = await hydrateAuthTokensFromCache()
  return cached?.refreshToken ?? null
}

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) {
    return refreshInFlight
  }

  refreshInFlight = (async () => {
    const authStore = await getAuthStore()
    if (authStore?.refreshToken) {
      return authStore.refreshSessionTokens()
    }

    const refreshToken = await resolveRefreshToken()
    if (!refreshToken) return false

    const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    })
    if (!response.ok) return false

    const tokens = (await response.json()) as TokenDTO

    setAuthTokens({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    })
    await persistAuthTokens({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    })

    const storeAfterRefresh = await getAuthStore()
    await storeAfterRefresh?.updateTokens(tokens)

    return true
  })().finally(() => {
    refreshInFlight = null
  })

  return refreshInFlight
}

async function shouldDeferLogoutOn401(): Promise<boolean> {
  if (typeof window === 'undefined') return true
  const authStore = await getAuthStore()
  if (!authStore) return true
  return authStore.isOfflineGracePeriodActive && !navigator.onLine
}

function resolveAccessToken(): string | null {
  // Sync read for SW path — tokens are set via setAuthTokens after hydrateAuthTokensFromCache.
  return getAuthTokens()?.accessToken ?? null
}

async function resolveAccessTokenWithStore(): Promise<string | null> {
  const authStore = await getAuthStore()
  if (authStore?.accessToken) return authStore.accessToken
  return resolveAccessToken()
}

/**
 * Fetch wrapper with automatic error handling.
 * Use this instead of native fetch for API calls.
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  async function request(): Promise<Response> {
    const headers = new Headers(options.headers)
    const accessToken =
      typeof window !== 'undefined' ? await resolveAccessTokenWithStore() : resolveAccessToken()
    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`)
    }

    return fetch(url, {
      ...options,
      headers,
    })
  }

  let response = await request()

  if (response.status === 401) {
    const unauthorizedResponse = response
    const refreshed = await refreshAccessToken()

    if (refreshed) {
      response = await request()
      if (response.status !== 401) {
        return response
      }
    }

    if (await shouldDeferLogoutOn401()) {
      return unauthorizedResponse
    }

    if (typeof window !== 'undefined') {
      const authStore = await getAuthStore()
      await authStore?.logout()
      const returnPath = `${window.location.pathname}${window.location.search}`
      const loginUrl = `/login?redirect=${encodeURIComponent(returnPath)}`
      window.location.assign(loginUrl)
    }
    throw new Error('Unauthorized - redirected to login')
  }

  return response
}
