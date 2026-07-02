import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserDTO, LoginDTO, TokenDTO } from '@codecomply/validators'
import { UserDTOSchema } from '@codecomply/validators'
import { syncEngine } from '../lib/db/sync-engine'
import {
  bootstrapEncryptionSession,
  teardownEncryptionSession,
} from '../lib/db/encryption-bootstrap'
import { getApiBaseUrl } from '../lib/api-base'
import { isDeviceIdleExceeded, touchLastSeenAt } from '../lib/auth/device-idle'
import { clearAuthTokens, persistAuthTokens, setAuthTokens } from '../lib/auth/token-access'
import { executeRemoteWipe } from '../lib/remote-wipe'
import { FIRST_ASSIGNED_SYNC_STORAGE_KEY } from '../lib/permit-orphan-sync'
import type { CertificationStatusDTO } from '@codecomply/validators'

/** Persisted so a full page reload can restore auth when /auth/me is temporarily unreachable. */
const USER_PROFILE_STORAGE_KEY = 'inspector_user_profile'
const OFFLINE_GRACE_PERIOD_MS = 8 * 60 * 60 * 1000

function parseCachedUserProfile(): UserDTO | null {
  try {
    const raw = localStorage.getItem(USER_PROFILE_STORAGE_KEY)
    if (!raw) return null
    const parsed = UserDTOSchema.safeParse(JSON.parse(raw))
    if (!parsed.success || parsed.data.role !== 'SCO') return null
    return parsed.data
  } catch {
    return null
  }
}

export type SessionRestoreResult = boolean | 'revoked' | 'device_stale'

export class CertificationRevokedError extends Error {
  constructor() {
    super('CERTIFICATION_REVOKED')
    this.name = 'CertificationRevokedError'
  }
}

async function fetchCertificationStatus(
  apiBase: string,
  accessToken: string,
): Promise<CertificationStatusDTO | null> {
  try {
    const response = await fetch(`${apiBase}/auth/certification-status`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    if (!response.ok) return null
    return (await response.json()) as CertificationStatusDTO
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<UserDTO | null>(null)
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const lastLoginAt = ref<Date | null>(null)
  const offlineGracePeriodExpiry = ref<Date | null>(null)

  // Computed
  const isAuthenticated = computed(() => !!user.value && !!accessToken.value)

  const isOfflineGracePeriodActive = computed(() => {
    if (!offlineGracePeriodExpiry.value) return false
    return new Date() < offlineGracePeriodExpiry.value
  })

  const certifications = computed(() => user.value?.certifications || [])
  const disciplines = computed(() => user.value?.disciplines || [])

  function refreshOfflineGracePeriod(now = Date.now()): void {
    offlineGracePeriodExpiry.value = new Date(now + OFFLINE_GRACE_PERIOD_MS)
  }

  async function mirrorAuthTokensForServiceWorker(): Promise<void> {
    if (accessToken.value && refreshToken.value) {
      const tokens = {
        accessToken: accessToken.value,
        refreshToken: refreshToken.value,
      }
      setAuthTokens(tokens)
      await persistAuthTokens(tokens)
      return
    }
    setAuthTokens(null)
    await clearAuthTokens()
  }

  // Actions
  async function login(
    _credentials: LoginDTO,
    tokens: TokenDTO,
    userProfile: UserDTO,
  ): Promise<void> {
    accessToken.value = tokens.accessToken
    refreshToken.value = tokens.refreshToken
    user.value = userProfile
    lastLoginAt.value = new Date()

    // Set offline grace period (8 hours from now)
    refreshOfflineGracePeriod()

    // Store tokens in localStorage for persistence
    localStorage.setItem('accessToken', tokens.accessToken)
    localStorage.setItem('refreshToken', tokens.refreshToken)
    localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(userProfile))
    touchLastSeenAt()

    await bootstrapEncryptionSession(tokens.refreshToken, userProfile.id)
    await mirrorAuthTokensForServiceWorker()

    const certStatus = await fetchCertificationStatus(getApiBaseUrl(), tokens.accessToken)
    if (certStatus?.revoked) {
      await executeRemoteWipe(useAuthStore())
      throw new CertificationRevokedError()
    }

    // Resume sync engine after login
    await syncEngine.resumeSync()
  }

  async function logout(): Promise<void> {
    // Pause sync engine before logout
    syncEngine.pauseSync()
    teardownEncryptionSession()

    // Clear state
    user.value = null
    accessToken.value = null
    refreshToken.value = null
    lastLoginAt.value = null
    offlineGracePeriodExpiry.value = null

    // Clear localStorage
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem(USER_PROFILE_STORAGE_KEY)
    localStorage.removeItem(FIRST_ASSIGNED_SYNC_STORAGE_KEY)
    setAuthTokens(null)
    await clearAuthTokens()
  }

  /**
   * Check if session is still valid
   * Returns false if tokens exist but user is not authenticated
   */
  function isSessionValid(): boolean {
    // If no tokens, session is not valid
    if (!accessToken.value || !refreshToken.value) {
      return false
    }

    // If authenticated, session is valid
    if (isAuthenticated.value) {
      return true
    }

    // If offline grace period is active, session is valid
    if (isOfflineGracePeriodActive.value) {
      return true
    }

    // Otherwise, session is not valid
    return false
  }

  function setUser(userProfile: UserDTO): void {
    user.value = userProfile
  }

  async function updateTokens(tokens: TokenDTO): Promise<void> {
    const previousRefreshToken = refreshToken.value

    accessToken.value = tokens.accessToken
    refreshToken.value = tokens.refreshToken

    // Update localStorage
    localStorage.setItem('accessToken', tokens.accessToken)
    localStorage.setItem('refreshToken', tokens.refreshToken)

    if (user.value) {
      try {
        await bootstrapEncryptionSession(tokens.refreshToken, user.value.id, {
          previousRefreshToken,
        })
      } catch (err) {
        console.error('Failed to re-init encryption after token refresh:', err)
      }
    }

    await mirrorAuthTokensForServiceWorker()
  }

  /**
   * Obtain a new access token when the current one expired (JWT default 15m).
   */
  async function refreshSessionTokens(): Promise<boolean> {
    const rt = refreshToken.value
    if (!rt) return false
    const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: rt }),
      cache: 'no-store',
    })
    if (!response.ok) return false
    const tokens = (await response.json()) as TokenDTO
    await updateTokens(tokens)
    return true
  }

  async function restoreSession(): Promise<SessionRestoreResult> {
    const storedAccessToken = localStorage.getItem('accessToken')
    const storedRefreshToken = localStorage.getItem('refreshToken')

    if (storedAccessToken && storedRefreshToken) {
      if (isDeviceIdleExceeded()) {
        await logout()
        return 'device_stale'
      }
      accessToken.value = storedAccessToken
      refreshToken.value = storedRefreshToken
      await mirrorAuthTokensForServiceWorker()

      const apiBase = getApiBaseUrl()

      // Fetch user profile to verify token is still valid
      try {
        let tokensRefreshedDuringRestore = false
        let response = await fetch(`${apiBase}/auth/me`, {
          headers: {
            Authorization: `Bearer ${storedAccessToken}`,
          },
          cache: 'no-store',
        })

        if (response.status === 401) {
          const refreshed = await refreshSessionTokens()
          if (!refreshed) {
            await logout()
            return false
          }
          tokensRefreshedDuringRestore = true
          response = await fetch(`${apiBase}/auth/me`, {
            headers: {
              Authorization: `Bearer ${accessToken.value}`,
            },
            cache: 'no-store',
          })
        }

        if (!response.ok) {
          await logout()
          return false
        }

        const userProfile = await response.json()

        // Verify user is SCO (Safety Codes Officer)
        if (userProfile.role !== 'SCO') {
          await logout()
          return false
        }

        user.value = userProfile
        localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(userProfile))
        lastLoginAt.value = new Date()
        // Set offline grace period (8 hours from now)
        refreshOfflineGracePeriod()

        const certStatus = await fetchCertificationStatus(apiBase, accessToken.value!)
        if (certStatus?.revoked) {
          await executeRemoteWipe(useAuthStore())
          return 'revoked'
        }

        touchLastSeenAt()

        if (!tokensRefreshedDuringRestore) {
          await bootstrapEncryptionSession(refreshToken.value!, userProfile.id)
        }

        // Resume sync engine after successful session restore
        await syncEngine.resumeSync()

        return true
      } catch (error) {
        // Network error - preserve tokens in localStorage; rehydrate user from cache so refresh stays logged in
        console.error('Failed to restore session:', error)
        const cachedUser = parseCachedUserProfile()
        if (cachedUser) {
          user.value = cachedUser
          lastLoginAt.value = new Date()
          refreshOfflineGracePeriod()
          await bootstrapEncryptionSession(refreshToken.value!, cachedUser.id)
          await syncEngine.resumeSync()
          return true
        }
        return false
      }
    }

    return false
  }

  return {
    // State
    user,
    accessToken,
    refreshToken,
    lastLoginAt,
    offlineGracePeriodExpiry,
    // Computed
    isAuthenticated,
    isOfflineGracePeriodActive,
    certifications,
    disciplines,
    // Actions
    login,
    logout,
    setUser,
    updateTokens,
    restoreSession,
    refreshSessionTokens,
    isSessionValid,
    refreshOfflineGracePeriod,
  }
})
