import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from './auth'
import type { TokenDTO, UserDTO } from '@codecomply/validators'

const mockAuthClient = {
  me: { $get: vi.fn() },
}

vi.mock('@/api/client', () => ({
  getApiClient: () => ({
    auth: mockAuthClient,
  }),
}))

vi.mock('../utils/admin-api-fetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/admin-api-fetch')>()
  return {
    ...actual,
    refreshAdminAccessToken: vi.fn(),
  }
})

import { refreshAdminAccessToken } from '../utils/admin-api-fetch'

global.fetch = vi.fn()

describe('Admin Auth Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('login', () => {
    it('should store tokens and user profile for admin users', async () => {
      const authStore = useAuthStore()

      const tokens: TokenDTO = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 900,
      }

      const userProfile: UserDTO = {
        id: 'user-1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'ADMIN',
        certifications: [],
        disciplines: [],
        designationId: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await authStore.login(
        { email: 'admin@example.com', password: 'admin123' },
        tokens,
        userProfile,
      )

      expect(authStore.accessToken).toBe('test-access-token')
      expect(authStore.refreshToken).toBe('test-refresh-token')
      expect(authStore.user).toEqual(userProfile)
      expect(authStore.isAuthenticated).toBe(true)
      expect(authStore.isAdmin).toBe(true)

      // Verify localStorage
      expect(localStorage.getItem('admin_accessToken')).toBe('test-access-token')
      expect(localStorage.getItem('admin_refreshToken')).toBe('test-refresh-token')
    })

    it('should reject non-admin users', async () => {
      const authStore = useAuthStore()

      const tokens: TokenDTO = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 900,
      }

      const userProfile: UserDTO = {
        id: 'user-1',
        email: 'inspector@example.com',
        name: 'Inspector User',
        role: 'SCO',
        certifications: [],
        disciplines: [],
        designationId: 'SCO-001',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await expect(
        authStore.login(
          { email: 'inspector@example.com', password: 'password123' },
          tokens,
          userProfile,
        ),
      ).rejects.toThrow('Access denied: Admin privileges required')

      expect(authStore.user).toBeNull()
      expect(authStore.accessToken).toBeNull()
      expect(authStore.isAuthenticated).toBe(false)
    })
  })

  describe('logout', () => {
    it('should clear all auth state and localStorage', async () => {
      const authStore = useAuthStore()

      // Set up authenticated state
      localStorage.setItem('admin_accessToken', 'test-token')
      localStorage.setItem('admin_refreshToken', 'test-refresh')
      authStore.accessToken = 'test-token'
      authStore.refreshToken = 'test-refresh'
      authStore.user = {
        id: 'user-1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'ADMIN',
        certifications: [],
        disciplines: [],
        designationId: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await authStore.logout()

      expect(authStore.user).toBeNull()
      expect(authStore.accessToken).toBeNull()
      expect(authStore.refreshToken).toBeNull()
      expect(authStore.isAuthenticated).toBe(false)
      expect(localStorage.getItem('admin_accessToken')).toBeNull()
      expect(localStorage.getItem('admin_refreshToken')).toBeNull()
    })
  })

  describe('restoreSession', () => {
    it('should restore session with valid tokens and fetch user profile', async () => {
      const authStore = useAuthStore()

      // Set up localStorage
      localStorage.setItem('admin_accessToken', 'valid-token')
      localStorage.setItem('admin_refreshToken', 'valid-refresh')

      const mockUserProfile: UserDTO = {
        id: 'user-1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'ADMIN',
        certifications: [],
        disciplines: [],
        designationId: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      mockAuthClient.me.$get.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserProfile,
      })

      const result = await authStore.restoreSession()

      expect(result).toBe(true)
      expect(authStore.user).toEqual(mockUserProfile)
      expect(authStore.accessToken).toBe('valid-token')
      expect(authStore.refreshToken).toBe('valid-refresh')
      expect(authStore.isAuthenticated).toBe(true)
      expect(authStore.sessionStatus).toBe('authenticated')
      expect(mockAuthClient.me.$get).toHaveBeenCalled()
    })

    it('should clear session if token is invalid and refresh fails', async () => {
      const authStore = useAuthStore()

      localStorage.setItem('admin_accessToken', 'invalid-token')
      localStorage.setItem('admin_refreshToken', 'invalid-refresh')

      mockAuthClient.me.$get.mockResolvedValueOnce({ ok: false, status: 401 })
      vi.mocked(refreshAdminAccessToken).mockResolvedValueOnce(false)

      const result = await authStore.restoreSession()

      expect(result).toBe(false)
      expect(authStore.user).toBeNull()
      expect(authStore.accessToken).toBeNull()
      expect(authStore.refreshToken).toBeNull()
      expect(authStore.sessionStatus).toBe('anonymous')
      expect(localStorage.getItem('admin_accessToken')).toBeNull()
      expect(localStorage.getItem('admin_refreshToken')).toBeNull()
    })

    it('should restore session with expired access token when refresh succeeds', async () => {
      const authStore = useAuthStore()

      localStorage.setItem('admin_accessToken', 'expired-token')
      localStorage.setItem('admin_refreshToken', 'valid-refresh')

      const mockUserProfile: UserDTO = {
        id: 'user-1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'ADMIN',
        certifications: [],
        disciplines: [],
        designationId: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      mockAuthClient.me.$get
        .mockResolvedValueOnce({ ok: false, status: 401 })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUserProfile,
        })
      vi.mocked(refreshAdminAccessToken).mockImplementation(async () => {
        authStore.updateTokens({
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          expiresIn: 900,
        })
        return true
      })

      const result = await authStore.restoreSession()

      expect(result).toBe(true)
      expect(authStore.user).toEqual(mockUserProfile)
      expect(authStore.accessToken).toBe('new-access-token')
      expect(authStore.refreshToken).toBe('new-refresh-token')
      expect(authStore.isAuthenticated).toBe(true)
    })

    it('should reject non-admin users during session restore', async () => {
      const authStore = useAuthStore()

      localStorage.setItem('admin_accessToken', 'valid-token')
      localStorage.setItem('admin_refreshToken', 'valid-refresh')

      const mockUserProfile: UserDTO = {
        id: 'user-1',
        email: 'inspector@example.com',
        name: 'Inspector User',
        role: 'SCO',
        certifications: [],
        disciplines: [],
        designationId: 'SCO-001',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      mockAuthClient.me.$get.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserProfile,
      })

      const result = await authStore.restoreSession()

      expect(result).toBe(false)
      expect(authStore.user).toBeNull()
      expect(localStorage.getItem('admin_accessToken')).toBeNull()
    })

    it('should return false when no tokens are stored', async () => {
      const authStore = useAuthStore()

      const result = await authStore.restoreSession()

      expect(result).toBe(false)
      expect(authStore.user).toBeNull()
      expect(authStore.sessionStatus).toBe('anonymous')
      expect(mockAuthClient.me.$get).not.toHaveBeenCalled()
    })

    it('should handle network errors gracefully and preserve tokens', async () => {
      const authStore = useAuthStore()

      localStorage.setItem('admin_accessToken', 'valid-token')
      localStorage.setItem('admin_refreshToken', 'valid-refresh')

      mockAuthClient.me.$get.mockRejectedValueOnce(new Error('Network error'))

      const result = await authStore.restoreSession()

      expect(result).toBe(false)
      expect(authStore.user).toBeNull()
      expect(authStore.sessionStatus).toBe('restore_error')
      expect(authStore.sessionRestoreError).toBeTruthy()
      // Tokens should be preserved in localStorage on network errors
      // so the user can retry on next refresh
      expect(localStorage.getItem('admin_accessToken')).toBe('valid-token')
      expect(localStorage.getItem('admin_refreshToken')).toBe('valid-refresh')
      // In-memory tokens should also be preserved
      expect(authStore.accessToken).toBe('valid-token')
      expect(authStore.refreshToken).toBe('valid-refresh')
    })
  })

  describe('updateTokens', () => {
    it('should update tokens in state and localStorage', () => {
      const authStore = useAuthStore()

      const newTokens: TokenDTO = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 900,
      }

      authStore.updateTokens(newTokens)

      expect(authStore.accessToken).toBe('new-access-token')
      expect(authStore.refreshToken).toBe('new-refresh-token')
      expect(localStorage.getItem('admin_accessToken')).toBe('new-access-token')
      expect(localStorage.getItem('admin_refreshToken')).toBe('new-refresh-token')
    })
  })

  describe('computed properties', () => {
    it('isAuthenticated should be true when user and token exist', () => {
      const authStore = useAuthStore()

      authStore.user = {
        id: 'user-1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'ADMIN',
        certifications: [],
        disciplines: [],
        designationId: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      authStore.accessToken = 'test-token'

      expect(authStore.isAuthenticated).toBe(true)
    })

    it('isAuthenticated should be false when user is null', () => {
      const authStore = useAuthStore()

      authStore.accessToken = 'test-token'
      authStore.user = null

      expect(authStore.isAuthenticated).toBe(false)
    })

    it('isAdmin should be true for ADMIN role', () => {
      const authStore = useAuthStore()

      authStore.user = {
        id: 'user-1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'ADMIN',
        certifications: [],
        disciplines: [],
        designationId: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      expect(authStore.isAdmin).toBe(true)
    })

    it('isAdmin should be false for non-ADMIN roles', () => {
      const authStore = useAuthStore()

      authStore.user = {
        id: 'user-1',
        email: 'inspector@example.com',
        name: 'Inspector User',
        role: 'SCO',
        certifications: [],
        disciplines: [],
        designationId: 'SCO-001',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      expect(authStore.isAdmin).toBe(false)
    })
  })
})
