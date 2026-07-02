import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore, CertificationRevokedError } from './auth'
import { FIRST_ASSIGNED_SYNC_STORAGE_KEY } from '@/lib/permit-orphan-sync'
import { LAST_SEEN_AT_STORAGE_KEY } from '@/lib/auth/device-idle'
import { executeRemoteWipe } from '@/lib/remote-wipe'
import type { TokenDTO, UserDTO } from '@codecomply/validators'

vi.mock('../lib/remote-wipe', () => ({
  executeRemoteWipe: vi.fn(async (authStore: ReturnType<typeof useAuthStore>) => {
    await authStore.logout()
  }),
}))

// Mock sync engine
vi.mock('../lib/db/sync-engine', () => ({
  syncEngine: {
    resumeSync: vi.fn().mockResolvedValue(undefined),
    pauseSync: vi.fn(),
    setAuthCheck: vi.fn(),
  },
}))

// Mock fetch globally
global.fetch = vi.fn()

describe('Inspector Auth Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('login', () => {
    it('should store tokens, user profile, and set offline grace period', async () => {
      const authStore = useAuthStore()

      const tokens: TokenDTO = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 900,
      }

      const userProfile: UserDTO = {
        id: 'user-1',
        email: 'inspector1@example.com',
        name: 'Jane Smith',
        role: 'SCO',
        certifications: [],
        disciplines: ['Building', 'Electrical'],
        designationId: 'SCO-001',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ revoked: false }),
      } as Response)

      await authStore.login(
        { email: 'inspector1@example.com', password: 'password123' },
        tokens,
        userProfile,
      )

      expect(authStore.accessToken).toBe('test-access-token')
      expect(authStore.refreshToken).toBe('test-refresh-token')
      expect(authStore.user).toEqual(userProfile)
      expect(authStore.isAuthenticated).toBe(true)
      expect(authStore.lastLoginAt).toBeInstanceOf(Date)
      expect(authStore.offlineGracePeriodExpiry).toBeInstanceOf(Date)

      // Verify offline grace period is set to 8 hours from now
      const gracePeriod = authStore.offlineGracePeriodExpiry!.getTime() - Date.now()
      expect(gracePeriod).toBeGreaterThan(7.9 * 60 * 60 * 1000) // ~8 hours
      expect(gracePeriod).toBeLessThan(8.1 * 60 * 60 * 1000)

      // Verify localStorage
      expect(localStorage.getItem('accessToken')).toBe('test-access-token')
      expect(localStorage.getItem('refreshToken')).toBe('test-refresh-token')
      expect(JSON.parse(localStorage.getItem('inspector_user_profile')!)).toMatchObject({
        id: 'user-1',
        role: 'SCO',
      })
    })

    it('should wipe and reject login when certification-status reports revoked', async () => {
      const authStore = useAuthStore()

      const tokens: TokenDTO = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 900,
      }

      const userProfile: UserDTO = {
        id: 'user-1',
        email: 'pat.nguyen@example.com',
        name: 'Pat Nguyen',
        role: 'SCO',
        certifications: [],
        disciplines: ['Building'],
        designationId: 'SCO-002',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          revoked: true,
          reasonCode: 'CERTIFICATION_REVOKED',
        }),
      } as Response)

      await expect(
        authStore.login(
          { email: 'pat.nguyen@example.com', password: 'password123' },
          tokens,
          userProfile,
        ),
      ).rejects.toBeInstanceOf(CertificationRevokedError)

      expect(executeRemoteWipe).toHaveBeenCalled()
      expect(authStore.isAuthenticated).toBe(false)
      expect(localStorage.getItem('accessToken')).toBeNull()
    })
  })

  describe('logout', () => {
    it('should clear all auth state including offline grace period', async () => {
      const authStore = useAuthStore()

      // Set up authenticated state
      localStorage.setItem('accessToken', 'test-token')
      localStorage.setItem('refreshToken', 'test-refresh')
      authStore.accessToken = 'test-token'
      authStore.refreshToken = 'test-refresh'
      authStore.user = {
        id: 'user-1',
        email: 'inspector1@example.com',
        name: 'Jane Smith',
        role: 'SCO',
        certifications: [],
        disciplines: [],
        designationId: 'SCO-001',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      authStore.lastLoginAt = new Date()
      authStore.offlineGracePeriodExpiry = new Date(Date.now() + 8 * 60 * 60 * 1000)
      localStorage.setItem(FIRST_ASSIGNED_SYNC_STORAGE_KEY, '1')

      await authStore.logout()

      expect(authStore.user).toBeNull()
      expect(authStore.accessToken).toBeNull()
      expect(authStore.refreshToken).toBeNull()
      expect(authStore.lastLoginAt).toBeNull()
      expect(authStore.offlineGracePeriodExpiry).toBeNull()
      expect(authStore.isAuthenticated).toBe(false)
      expect(localStorage.getItem('accessToken')).toBeNull()
      expect(localStorage.getItem('refreshToken')).toBeNull()
      expect(localStorage.getItem('inspector_user_profile')).toBeNull()
      expect(localStorage.getItem(FIRST_ASSIGNED_SYNC_STORAGE_KEY)).toBeNull()
    })
  })

  describe('restoreSession', () => {
    it('should restore session with valid tokens and fetch user profile', async () => {
      const authStore = useAuthStore()

      // Set up localStorage
      localStorage.setItem('accessToken', 'valid-token')
      localStorage.setItem('refreshToken', 'valid-refresh')

      const mockUserProfile: UserDTO = {
        id: 'user-1',
        email: 'inspector1@example.com',
        name: 'Jane Smith',
        role: 'SCO',
        certifications: [],
        disciplines: ['Building', 'Electrical'],
        designationId: 'SCO-001',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // Mock successful fetch (/auth/me, then /auth/certification-status)
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUserProfile,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ revoked: false }),
        } as Response)

      const result = await authStore.restoreSession()

      expect(result).toBe(true)
      expect(authStore.user).toEqual(mockUserProfile)
      expect(authStore.accessToken).toBe('valid-token')
      expect(authStore.refreshToken).toBe('valid-refresh')
      expect(authStore.isAuthenticated).toBe(true)
      expect(authStore.lastLoginAt).toBeInstanceOf(Date)
      expect(authStore.offlineGracePeriodExpiry).toBeInstanceOf(Date)

      // Verify fetch was called with correct headers
      expect(fetch).toHaveBeenCalledWith('http://localhost:4000/auth/me', {
        headers: {
          Authorization: 'Bearer valid-token',
        },
        cache: 'no-store',
      })
    })

    it('should refresh access token and restore session when /auth/me returns 401', async () => {
      const authStore = useAuthStore()

      localStorage.setItem('accessToken', 'expired-access')
      localStorage.setItem('refreshToken', 'valid-refresh')

      const mockUserProfile: UserDTO = {
        id: 'user-1',
        email: 'inspector1@example.com',
        name: 'Jane Smith',
        role: 'SCO',
        certifications: [],
        disciplines: [],
        designationId: 'SCO-001',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 900,
      }

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => newTokens,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUserProfile,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ revoked: false }),
        } as Response)

      const result = await authStore.restoreSession()

      expect(result).toBe(true)
      expect(authStore.user).toEqual(mockUserProfile)
      expect(authStore.accessToken).toBe('new-access-token')
      expect(authStore.refreshToken).toBe('new-refresh-token')
      expect(localStorage.getItem('accessToken')).toBe('new-access-token')
      expect(localStorage.getItem('refreshToken')).toBe('new-refresh-token')

      expect(fetch).toHaveBeenNthCalledWith(1, 'http://localhost:4000/auth/me', {
        headers: { Authorization: 'Bearer expired-access' },
        cache: 'no-store',
      })
      expect(fetch).toHaveBeenNthCalledWith(2, 'http://localhost:4000/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: 'valid-refresh' }),
        cache: 'no-store',
      })
      expect(fetch).toHaveBeenNthCalledWith(3, 'http://localhost:4000/auth/me', {
        headers: { Authorization: 'Bearer new-access-token' },
        cache: 'no-store',
      })
    })

    it('should clear session if token is invalid', async () => {
      const authStore = useAuthStore()

      localStorage.setItem('accessToken', 'invalid-token')
      localStorage.setItem('refreshToken', 'invalid-refresh')

      // Expired access → 401 on /auth/me, then refresh also fails
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response)
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response)

      const result = await authStore.restoreSession()

      expect(result).toBe(false)
      expect(authStore.user).toBeNull()
      expect(authStore.accessToken).toBeNull()
      expect(authStore.refreshToken).toBeNull()
      expect(localStorage.getItem('accessToken')).toBeNull()
      expect(localStorage.getItem('refreshToken')).toBeNull()
    })

    it('should reject non-SCO users during session restore', async () => {
      const authStore = useAuthStore()

      localStorage.setItem('accessToken', 'valid-token')
      localStorage.setItem('refreshToken', 'valid-refresh')

      const mockUserProfile: UserDTO = {
        id: 'user-1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'ADMIN',
        certifications: [],
        disciplines: [],
        designationId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserProfile,
      } as Response)

      const result = await authStore.restoreSession()

      expect(result).toBe(false)
      expect(authStore.user).toBeNull()
      expect(localStorage.getItem('accessToken')).toBeNull()
    })

    it('should return false when no tokens are stored', async () => {
      const authStore = useAuthStore()

      const result = await authStore.restoreSession()

      expect(result).toBe(false)
      expect(authStore.user).toBeNull()
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should handle network errors gracefully and preserve tokens when no cached profile', async () => {
      const authStore = useAuthStore()

      localStorage.setItem('accessToken', 'valid-token')
      localStorage.setItem('refreshToken', 'valid-refresh')

      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      const result = await authStore.restoreSession()

      expect(result).toBe(false)
      expect(authStore.user).toBeNull()
      // Tokens should be preserved in localStorage on network errors
      // so the user can retry on next refresh
      expect(localStorage.getItem('accessToken')).toBe('valid-token')
      expect(localStorage.getItem('refreshToken')).toBe('valid-refresh')
      // In-memory tokens should also be preserved for offline grace period
      expect(authStore.accessToken).toBe('valid-token')
      expect(authStore.refreshToken).toBe('valid-refresh')
    })

    it('should restore session from cached user profile when /auth/me fails (e.g. offline)', async () => {
      const authStore = useAuthStore()

      const cachedProfile: UserDTO = {
        id: 'user-1',
        email: 'inspector1@example.com',
        name: 'Jane Smith',
        role: 'SCO',
        certifications: [],
        disciplines: [],
        designationId: 'SCO-001',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      localStorage.setItem('accessToken', 'valid-token')
      localStorage.setItem('refreshToken', 'valid-refresh')
      localStorage.setItem('inspector_user_profile', JSON.stringify(cachedProfile))

      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      const result = await authStore.restoreSession()

      expect(result).toBe(true)
      expect(authStore.user).toEqual(cachedProfile)
      expect(authStore.isAuthenticated).toBe(true)
      expect(authStore.offlineGracePeriodExpiry).toBeInstanceOf(Date)
    })

    it('should wipe and return revoked when certification-status reports revoked', async () => {
      const authStore = useAuthStore()

      localStorage.setItem('accessToken', 'valid-token')
      localStorage.setItem('refreshToken', 'valid-refresh')

      const mockUserProfile: UserDTO = {
        id: 'user-1',
        email: 'inspector1@example.com',
        name: 'Jane Smith',
        role: 'SCO',
        certifications: [],
        disciplines: [],
        designationId: 'SCO-001',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUserProfile,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            revoked: true,
            reasonCode: 'CERTIFICATION_REVOKED',
          }),
        } as Response)

      const result = await authStore.restoreSession()

      expect(result).toBe('revoked')
      expect(executeRemoteWipe).toHaveBeenCalled()
    })

    it('should force re-auth when device idle exceeds max offline days', async () => {
      const authStore = useAuthStore()

      localStorage.setItem('accessToken', 'valid-token')
      localStorage.setItem('refreshToken', 'valid-refresh')
      localStorage.setItem(LAST_SEEN_AT_STORAGE_KEY, String(Date.now() - 31 * 86_400_000))

      const result = await authStore.restoreSession()

      expect(result).toBe('device_stale')
      expect(fetch).not.toHaveBeenCalled()
      expect(localStorage.getItem('accessToken')).toBeNull()
    })

    it('should clear tokens on explicit auth failure (401)', async () => {
      const authStore = useAuthStore()

      localStorage.setItem('accessToken', 'expired-token')
      localStorage.setItem('refreshToken', 'expired-refresh')

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response)
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response)

      const result = await authStore.restoreSession()

      expect(result).toBe(false)
      expect(authStore.user).toBeNull()
      expect(authStore.accessToken).toBeNull()
      expect(authStore.refreshToken).toBeNull()
      expect(localStorage.getItem('accessToken')).toBeNull()
      expect(localStorage.getItem('refreshToken')).toBeNull()
    })
  })

  describe('offline grace period', () => {
    it('isOfflineGracePeriodActive should be true when within grace period', () => {
      const authStore = useAuthStore()

      authStore.offlineGracePeriodExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours from now

      expect(authStore.isOfflineGracePeriodActive).toBe(true)
    })

    it('isOfflineGracePeriodActive should be false when grace period expired', () => {
      const authStore = useAuthStore()

      authStore.offlineGracePeriodExpiry = new Date(Date.now() - 1000) // 1 second ago

      expect(authStore.isOfflineGracePeriodActive).toBe(false)
    })

    it('isOfflineGracePeriodActive should be false when no grace period set', () => {
      const authStore = useAuthStore()

      authStore.offlineGracePeriodExpiry = null

      expect(authStore.isOfflineGracePeriodActive).toBe(false)
    })
  })

  describe('computed properties', () => {
    it('certifications should return user certifications', () => {
      const authStore = useAuthStore()

      authStore.user = {
        id: 'user-1',
        email: 'inspector1@example.com',
        name: 'Jane Smith',
        role: 'SCO',
        certifications: [
          {
            id: 'cert-1',
            discipline: 'Building',
            authority: 'Building Code Certification',
            issuedDate: new Date().toISOString(),
            status: 'ACTIVE',
          },
        ],
        disciplines: [],
        designationId: 'SCO-001',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      expect(authStore.certifications).toHaveLength(1)
      expect(authStore.certifications[0].authority).toBe('Building Code Certification')
    })

    it('disciplines should return user disciplines', () => {
      const authStore = useAuthStore()

      authStore.user = {
        id: 'user-1',
        email: 'inspector1@example.com',
        name: 'Jane Smith',
        role: 'SCO',
        certifications: [],
        disciplines: ['Building', 'Electrical'],
        designationId: 'SCO-001',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      expect(authStore.disciplines).toEqual(['Building', 'Electrical'])
    })

    it('should return empty arrays when user is null', () => {
      const authStore = useAuthStore()

      authStore.user = null

      expect(authStore.certifications).toEqual([])
      expect(authStore.disciplines).toEqual([])
    })
  })
})
