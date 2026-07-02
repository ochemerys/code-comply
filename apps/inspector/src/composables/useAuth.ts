import { computed } from 'vue'
import * as Sentry from '@sentry/vue'
import { useAuthStore, CertificationRevokedError } from '../stores/auth'
import { useRouter } from 'vue-router'
import type { LoginDTO, TokenDTO } from '@codecomply/validators'
import { getApiBaseUrl } from '../lib/api-base'
import { ssoCallbackRedirectUri } from './useSsoConfig'

const SSO_STATE_KEY = 'inspector_sso_oauth_state'

export type LogoutOptions = {
  reason?: 'idle'
}

/** Thrown when credentials are valid but the account is not an SCO (Inspector PWA). */
export class InspectorAccessDeniedError extends Error {
  constructor() {
    super('INSPECTOR_ACCESS_DENIED')
    this.name = 'InspectorAccessDeniedError'
  }
}

function authPrefix(): string {
  const base = getApiBaseUrl()
  return base ? `${base}/auth` : '/auth'
}

async function fetchUserProfile(accessToken: string) {
  const profileResponse = await fetch(`${authPrefix()}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!profileResponse.ok) {
    throw new Error('Failed to fetch profile')
  }

  const userProfile = await profileResponse.json()
  if (userProfile.role !== 'SCO') {
    throw new InspectorAccessDeniedError()
  }
  return userProfile
}

async function establishSession(tokens: TokenDTO): Promise<void> {
  const authStore = useAuthStore()
  const userProfile = await fetchUserProfile(tokens.accessToken)
  await authStore.login({ email: userProfile.email, password: 'sso-session' }, tokens, userProfile)
}

export function useAuth() {
  const authStore = useAuthStore()
  const router = useRouter()

  const user = computed(() => authStore.user)
  const isAuthenticated = computed(() => authStore.isAuthenticated)
  const isOfflineGracePeriodActive = computed(() => authStore.isOfflineGracePeriodActive)

  const apiUrl = getApiBaseUrl()

  async function login(credentials: LoginDTO): Promise<void> {
    try {
      // Call login API
      const loginResponse = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })

      if (!loginResponse.ok) {
        throw new Error('Login failed')
      }

      const tokens = await loginResponse.json()

      await establishSession(tokens)

      // Redirect to home or intended route
      const redirect = router.currentRoute.value.query.redirect as string
      await router.push(redirect || '/')
    } catch (error) {
      if (error instanceof CertificationRevokedError) {
        await router.push({ path: '/login', query: { reason: 'revoked' } })
      }
      console.error('Login error:', error)
      throw error
    }
  }

  async function loginWithSso(
    authorizationEndpoint: string,
    clientId: string,
    scopes: string[],
  ): Promise<void> {
    const redirectUri = ssoCallbackRedirectUri()
    const state = crypto.randomUUID()
    sessionStorage.setItem(SSO_STATE_KEY, state)

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state,
    })

    window.location.assign(`${authorizationEndpoint}?${params.toString()}`)
  }

  async function completeSsoCallback(code: string, state: string): Promise<void> {
    const expectedState = sessionStorage.getItem(SSO_STATE_KEY)
    sessionStorage.removeItem(SSO_STATE_KEY)
    if (!expectedState || expectedState !== state) {
      throw new Error('Invalid SSO state')
    }

    const redirectUri = ssoCallbackRedirectUri()
    const tokenResponse = await fetch(`${authPrefix()}/sso/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirectUri, state }),
    })

    if (!tokenResponse.ok) {
      throw new Error('SSO token exchange failed')
    }

    const tokens = (await tokenResponse.json()) as TokenDTO
    await establishSession(tokens)

    const redirect = router.currentRoute.value.query.redirect as string
    await router.push(redirect || '/')
  }

  async function logout(options?: LogoutOptions): Promise<void> {
    const reason = options?.reason
    if (reason === 'idle') {
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Idle auto-logout',
        level: 'info',
        data: { reason: 'idle' },
      })
    }

    try {
      if (authStore.accessToken) {
        await fetch(`${apiUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authStore.accessToken}`,
          },
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      await authStore.logout()
      router.push(reason ? { path: '/login', query: { reason } } : { path: '/login' })
    }
  }

  async function refreshToken(): Promise<void> {
    if (!authStore.refreshToken) {
      throw new Error('No refresh token available')
    }

    try {
      const response = await fetch(`${apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: authStore.refreshToken }),
      })

      if (!response.ok) {
        throw new Error('Token refresh failed')
      }

      const tokens = await response.json()
      await authStore.updateTokens(tokens)
    } catch (error) {
      console.error('Token refresh failed:', error)
      await logout()
      throw error
    }
  }

  function checkOfflineGracePeriod(): boolean {
    return authStore.isOfflineGracePeriodActive
  }

  return {
    user,
    isAuthenticated,
    isOfflineGracePeriodActive,
    login,
    loginWithSso,
    completeSsoCallback,
    logout,
    refreshToken,
    checkOfflineGracePeriod,
  }
}
