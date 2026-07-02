import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserDTO, LoginDTO, TokenDTO } from '@codecomply/validators'
import { refreshAdminAccessToken } from '../utils/admin-api-fetch'
import { getApiClient } from '@/api/client'
import { parseRpcJson } from '@/api/rpc-json'

export type SessionStatus =
  | 'unknown'
  | 'restoring'
  | 'authenticated'
  | 'anonymous'
  | 'restore_error'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserDTO | null>(null)
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const sessionStatus = ref<SessionStatus>('unknown')
  const sessionRestoreError = ref<string | null>(null)

  const isAuthenticated = computed(() => !!user.value && !!accessToken.value)
  const isAdmin = computed(() => user.value?.role === 'ADMIN')
  const isSessionHydrating = computed(() => {
    if (sessionStatus.value === 'restoring') return true
    return sessionStatus.value === 'unknown' && !!accessToken.value && !!refreshToken.value
  })
  const isSessionRestoreError = computed(() => sessionStatus.value === 'restore_error')

  function syncSessionStatusFromState(): void {
    if (user.value && accessToken.value && refreshToken.value) {
      if (sessionStatus.value !== 'restoring') {
        sessionStatus.value = 'authenticated'
        sessionRestoreError.value = null
      }
      return
    }
    if (!accessToken.value && !refreshToken.value && sessionStatus.value !== 'restoring') {
      sessionStatus.value = 'anonymous'
    }
  }

  async function login(
    _credentials: LoginDTO,
    tokens: TokenDTO,
    userProfile: UserDTO,
  ): Promise<void> {
    accessToken.value = tokens.accessToken
    refreshToken.value = tokens.refreshToken
    user.value = userProfile

    if (!isAdmin.value) {
      await logout()
      throw new Error('Access denied: Admin privileges required')
    }

    localStorage.setItem('admin_accessToken', tokens.accessToken)
    localStorage.setItem('admin_refreshToken', tokens.refreshToken)
    sessionStatus.value = 'authenticated'
    sessionRestoreError.value = null
  }

  async function logout(): Promise<void> {
    user.value = null
    accessToken.value = null
    refreshToken.value = null
    sessionStatus.value = 'anonymous'
    sessionRestoreError.value = null

    localStorage.removeItem('admin_accessToken')
    localStorage.removeItem('admin_refreshToken')
  }

  function setUser(userProfile: UserDTO): void {
    user.value = userProfile
    syncSessionStatusFromState()
  }

  function updateTokens(tokens: TokenDTO): void {
    accessToken.value = tokens.accessToken
    refreshToken.value = tokens.refreshToken

    localStorage.setItem('admin_accessToken', tokens.accessToken)
    localStorage.setItem('admin_refreshToken', tokens.refreshToken)
    syncSessionStatusFromState()
  }

  async function restoreSession(): Promise<boolean> {
    sessionRestoreError.value = null
    const storedAccessToken = localStorage.getItem('admin_accessToken')
    const storedRefreshToken = localStorage.getItem('admin_refreshToken')

    if (!storedAccessToken || !storedRefreshToken) {
      sessionStatus.value = 'anonymous'
      return false
    }

    accessToken.value = storedAccessToken
    refreshToken.value = storedRefreshToken
    sessionStatus.value = 'restoring'

    try {
      let res = await getApiClient().auth.me.$get()

      if (res.status === 401) {
        const refreshed = await refreshAdminAccessToken()
        if (refreshed && accessToken.value) {
          res = await getApiClient().auth.me.$get()
        }
      }

      if (!res.ok) {
        await logout()
        return false
      }

      const userProfile = await parseRpcJson<UserDTO>(res, 'Failed to load profile')

      if (userProfile.role !== 'ADMIN') {
        await logout()
        return false
      }

      user.value = userProfile
      sessionStatus.value = 'authenticated'
      return true
    } catch (error) {
      console.error('Failed to restore session:', error)
      user.value = null
      sessionRestoreError.value =
        error instanceof Error ? error.message : 'Failed to restore session'
      sessionStatus.value = 'restore_error'
      return false
    }
  }

  async function retryRestoreSession(): Promise<boolean> {
    return restoreSession()
  }

  return {
    user,
    accessToken,
    refreshToken,
    sessionStatus,
    sessionRestoreError,
    isAuthenticated,
    isAdmin,
    isSessionHydrating,
    isSessionRestoreError,
    login,
    logout,
    setUser,
    updateTokens,
    restoreSession,
    retryRestoreSession,
  }
})
