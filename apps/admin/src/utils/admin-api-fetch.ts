/**
 * Authenticated fetch with silent token refresh on 401.
 * Mutex-protected refresh so concurrent 401s share one POST /auth/refresh.
 */

import type { TokenDTO } from '@codecomply/validators'
import { getActivePinia } from 'pinia'
import { getApiBaseUrl } from '@/lib/api-base'

/** Thrown after logout + redirect to login for expired/invalid token. */
export class SessionExpiredRedirectError extends Error {
  override readonly name = 'SessionExpiredRedirectError'

  constructor() {
    super('Your session has expired. Please sign in again.')
  }
}

export function isSessionExpiredRedirectError(e: unknown): e is SessionExpiredRedirectError {
  return e instanceof SessionExpiredRedirectError
}

/** Shared in-flight refresh so concurrent 401s trigger one POST /auth/refresh. */
let refreshInFlight: Promise<boolean> | null = null

type SessionExpiredRedirect = () => Promise<never>

let sessionExpiredRedirect: SessionExpiredRedirect | null = null

/** Wire session-expired navigation (e.g. from main.ts with the app router instance). */
export function configureAdminSessionExpiredRedirect(handler: SessionExpiredRedirect | null): void {
  sessionExpiredRedirect = handler
}

async function getAuthStore() {
  if (typeof window === 'undefined' || !getActivePinia()) return null
  const { useAuthStore } = await import('../stores/auth')
  return useAuthStore()
}

async function resolveRefreshToken(): Promise<string | null> {
  const authStore = await getAuthStore()
  if (authStore?.refreshToken) return authStore.refreshToken
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('admin_refreshToken')
  }
  return null
}

async function resolveAccessToken(): Promise<string | null> {
  const authStore = await getAuthStore()
  if (authStore?.accessToken) return authStore.accessToken
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('admin_accessToken')
  }
  return null
}

/** Refresh access token via POST /auth/refresh; updates auth store on success. */
export async function refreshAdminAccessToken(): Promise<boolean> {
  if (refreshInFlight) {
    return refreshInFlight
  }

  refreshInFlight = (async () => {
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
    const authStore = await getAuthStore()
    authStore?.updateTokens(tokens)
    return true
  })().finally(() => {
    refreshInFlight = null
  })

  return refreshInFlight
}

async function handleSessionExpired(): Promise<never> {
  const authStore = await getAuthStore()
  await authStore?.logout()

  if (sessionExpiredRedirect) {
    return sessionExpiredRedirect()
  }

  if (typeof window !== 'undefined') {
    const { default: router } = await import('../router')
    await router.replace({
      name: 'login',
      query: {
        reason: 'session_expired',
        redirect: router.currentRoute.value.fullPath,
      },
    })
  }

  throw new SessionExpiredRedirectError()
}

/**
 * Fetch wrapper for authenticated admin API calls.
 * On 401: refresh once, retry; if refresh fails, logout and redirect to login.
 */
export async function adminApiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  async function request(): Promise<Response> {
    const headers = new Headers(options.headers)
    const accessToken = await resolveAccessToken()
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
    const refreshed = await refreshAdminAccessToken()

    if (refreshed) {
      response = await request()
      if (response.status !== 401) {
        return response
      }
    }

    return handleSessionExpired()
  }

  return response
}

/** @internal Test-only reset for refresh mutex state between specs. */
export function resetAdminApiFetchStateForTests(): void {
  refreshInFlight = null
  sessionExpiredRedirect = null
}
