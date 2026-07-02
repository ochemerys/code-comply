import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuth } from './useAuth'
import { useAuthStore } from '../stores/auth'
import type { LoginDTO } from '@codecomply/validators'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush,
    currentRoute: {
      value: {
        query: {},
      },
    },
  }),
}))

const mockAuthClient = {
  login: { $post: vi.fn() },
  logout: { $post: vi.fn() },
  me: { $get: vi.fn() },
}

vi.mock('@/api/client', () => ({
  getApiClient: () => ({
    auth: mockAuthClient,
  }),
  resetApiClientForTests: vi.fn(),
}))

vi.mock('@sentry/vue', () => ({
  addBreadcrumb: vi.fn(),
}))

import * as Sentry from '@sentry/vue'

vi.mock('../utils/admin-api-fetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/admin-api-fetch')>()
  return {
    ...actual,
    refreshAdminAccessToken: vi.fn(),
  }
})

import { refreshAdminAccessToken } from '../utils/admin-api-fetch'

describe('Admin useAuth Composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('login', () => {
    it('should successfully login with valid admin credentials', async () => {
      const { login } = useAuth()

      const credentials: LoginDTO = {
        email: 'admin@example.com',
        password: 'admin123',
      }

      const mockTokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 900,
      }

      const mockUserProfile = {
        id: 'user-1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'ADMIN' as const,
        certifications: [],
        disciplines: [],
        designationId: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      mockAuthClient.login.$post.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens,
      })

      mockAuthClient.me.$get.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserProfile,
      })

      await login(credentials)

      const authStore = useAuthStore()

      expect(authStore.accessToken).toBe('test-access-token')
      expect(authStore.user?.email).toBe('admin@example.com')
      expect(authStore.isAuthenticated).toBe(true)

      expect(mockAuthClient.login.$post).toHaveBeenCalledWith({ json: credentials })
      expect(mockAuthClient.me.$get).toHaveBeenCalledWith(
        {},
        { headers: { Authorization: 'Bearer test-access-token' } },
      )

      expect(mockPush).toHaveBeenCalledWith('/')
    })

    it('should throw error when login API fails', async () => {
      const { login } = useAuth()

      mockAuthClient.login.$post.mockResolvedValueOnce({ ok: false, status: 401 })

      await expect(
        login({ email: 'admin@example.com', password: 'wrong-password' }),
      ).rejects.toThrow('Login failed')
    })

    it('should throw error when profile fetch fails', async () => {
      const { login } = useAuth()

      mockAuthClient.login.$post.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          expiresIn: 900,
        }),
      })

      mockAuthClient.me.$get.mockResolvedValueOnce({ ok: false, status: 401 })

      await expect(login({ email: 'admin@example.com', password: 'admin123' })).rejects.toThrow(
        'Failed to fetch profile',
      )
    })

    it('should reject non-admin users', async () => {
      const { login } = useAuth()

      mockAuthClient.login.$post.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          expiresIn: 900,
        }),
      })

      mockAuthClient.me.$get.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'user-1',
          email: 'inspector@example.com',
          name: 'Inspector User',
          role: 'SCO',
          certifications: [],
          disciplines: [],
          designationId: 'SCO-001',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      })

      await expect(
        login({ email: 'inspector@example.com', password: 'password123' }),
      ).rejects.toThrow('Access denied: Admin privileges required')
    })
  })

  describe('logout', () => {
    it('should call logout API and clear session', async () => {
      const { logout } = useAuth()
      const authStore = useAuthStore()

      authStore.accessToken = 'test-token'
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

      mockAuthClient.logout.$post.mockResolvedValueOnce({ ok: true })

      await logout()

      expect(mockAuthClient.logout.$post).toHaveBeenCalled()
      expect(authStore.user).toBeNull()
      expect(authStore.accessToken).toBeNull()
      expect(mockPush).toHaveBeenCalledWith({ path: '/login' })
    })

    it('should clear session even if API call fails', async () => {
      const { logout } = useAuth()
      const authStore = useAuthStore()

      authStore.accessToken = 'test-token'
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

      mockAuthClient.logout.$post.mockRejectedValueOnce(new Error('Network error'))

      await logout()

      expect(authStore.user).toBeNull()
      expect(mockPush).toHaveBeenCalledWith({ path: '/login' })
    })

    it('redirects to login with idle reason and adds Sentry breadcrumb', async () => {
      const { logout } = useAuth()
      const authStore = useAuthStore()

      authStore.accessToken = 'test-token'
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

      mockAuthClient.logout.$post.mockResolvedValueOnce({ ok: true })

      await logout({ reason: 'idle' })

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'auth',
        message: 'Idle auto-logout',
        level: 'info',
        data: { reason: 'idle' },
      })
      expect(mockPush).toHaveBeenCalledWith({ path: '/login', query: { reason: 'idle' } })
    })
  })

  describe('refreshToken', () => {
    it('should refresh tokens successfully', async () => {
      const { refreshToken } = useAuth()
      const authStore = useAuthStore()

      authStore.refreshToken = 'old-refresh-token'
      authStore.accessToken = 'old-access'
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

      vi.mocked(refreshAdminAccessToken).mockResolvedValueOnce(true)
      authStore.updateTokens({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 900,
      })

      await refreshToken()

      expect(authStore.accessToken).toBe('new-access-token')
      expect(authStore.refreshToken).toBe('new-refresh-token')
    })

    it('should logout on refresh failure', async () => {
      const { refreshToken } = useAuth()
      const authStore = useAuthStore()

      authStore.refreshToken = 'invalid-refresh-token'
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

      vi.mocked(refreshAdminAccessToken).mockResolvedValueOnce(false)

      await expect(refreshToken()).rejects.toThrow('Token refresh failed')

      expect(authStore.user).toBeNull()
      expect(mockPush).toHaveBeenCalledWith({ path: '/login' })
    })

    it('should throw error when no refresh token available', async () => {
      const { refreshToken } = useAuth()
      const authStore = useAuthStore()

      authStore.refreshToken = null

      await expect(refreshToken()).rejects.toThrow('No refresh token available')
    })
  })

  describe('computed properties', () => {
    it('should expose user from store', () => {
      const { user } = useAuth()
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

      expect(user.value?.email).toBe('admin@example.com')
    })

    it('should expose isAuthenticated from store', () => {
      const { isAuthenticated } = useAuth()
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

      expect(isAuthenticated.value).toBe(true)
    })

    it('should expose isAdmin from store', () => {
      const { isAdmin } = useAuth()
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

      expect(isAdmin.value).toBe(true)
    })
  })
})
