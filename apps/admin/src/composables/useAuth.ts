import { computed } from 'vue'
import * as Sentry from '@sentry/vue'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import type { LoginDTO } from '@codecomply/validators'
import { refreshAdminAccessToken } from '../utils/admin-api-fetch'
import { getApiClient } from '@/api/client'

export interface LogoutOptions {
  reason?: 'idle'
}

export function useAuth() {
  const authStore = useAuthStore()
  const router = useRouter()

  const user = computed(() => authStore.user)
  const isAuthenticated = computed(() => authStore.isAuthenticated)
  const isAdmin = computed(() => authStore.isAdmin)

  async function login(credentials: LoginDTO): Promise<void> {
    try {
      const client = getApiClient()
      const loginRes = await client.auth.login.$post({ json: credentials })
      if (!loginRes.ok) {
        throw new Error('Login failed')
      }
      const tokens = await loginRes.json()

      const profileRes = await client.auth.me.$get(
        {},
        { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
      )
      if (!profileRes.ok) {
        throw new Error('Failed to fetch profile')
      }
      const userProfile = await profileRes.json()

      await authStore.login(credentials, tokens, userProfile)

      const redirect = router.currentRoute.value.query.redirect as string
      router.push(redirect || '/')
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
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
        await getApiClient().auth.logout.$post()
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

    const refreshed = await refreshAdminAccessToken()
    if (!refreshed) {
      await logout()
      throw new Error('Token refresh failed')
    }
  }

  return {
    user,
    isAuthenticated,
    isAdmin,
    login,
    logout,
    refreshToken,
  }
}
