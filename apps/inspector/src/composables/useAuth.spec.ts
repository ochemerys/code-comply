import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { InspectorAccessDeniedError, useAuth } from './useAuth'
import { useAuthStore } from '../stores/auth'
import type { LoginDTO } from '@codecomply/validators'

// Mock sync engine
vi.mock('../lib/db/sync-engine', () => ({
  syncEngine: {
    resumeSync: vi.fn().mockResolvedValue(undefined),
    pauseSync: vi.fn(),
    setAuthCheck: vi.fn(),
  },
}))

// Mock router (spread real vue-router so router/index can load via permit-orphan-sync → api-error-handler)
const routerMocks = vi.hoisted(() => ({
  mockPush: vi.fn(),
}))

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({
      push: routerMocks.mockPush,
      currentRoute: {
        value: {
          query: {},
        },
      },
    }),
  }
})

const mockPush = routerMocks.mockPush

// Mock fetch globally
global.fetch = vi.fn()

describe('Inspector useAuth Composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('login', () => {
    it('should successfully login with valid SCO credentials', async () => {
      const { login } = useAuth()

      const credentials: LoginDTO = {
        email: 'inspector1@example.com',
        password: 'password123',
      }

      const mockTokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 900,
      }

      const mockUserProfile = {
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

      // Mock login API response
      vi.mocked(fetch).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTokens),
        } as Response),
      )

      // Mock profile fetch with Authorization header
      vi.mocked(fetch).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUserProfile),
        } as Response),
      )

      await login(credentials)

      const authStore = useAuthStore()

      // Verify tokens and user are stored
      expect(authStore.accessToken).toBe('test-access-token')
      expect(authStore.user?.email).toBe('inspector1@example.com')
      expect(authStore.isAuthenticated).toBe(true)
      expect(authStore.offlineGracePeriodExpiry).toBeInstanceOf(Date)

      // Verify fetch calls
      expect(fetch).toHaveBeenNthCalledWith(1, 'http://localhost:4000/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })

      expect(fetch).toHaveBeenNthCalledWith(2, 'http://localhost:4000/auth/me', {
        headers: {
          Authorization: 'Bearer test-access-token',
        },
      })

      // Verify redirect
      expect(mockPush).toHaveBeenCalledWith('/')
    })

    it('should reject login when user is not SCO (e.g. admin)', async () => {
      const { login } = useAuth()

      const credentials: LoginDTO = {
        email: 'admin@example.com',
        password: 'password123',
      }

      const mockTokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 900,
      }

      const mockAdminProfile = {
        id: 'admin-1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'ADMIN',
        certifications: [],
        disciplines: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      vi.mocked(fetch).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTokens),
        } as Response),
      )

      vi.mocked(fetch).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAdminProfile),
        } as Response),
      )

      await expect(login(credentials)).rejects.toThrow(InspectorAccessDeniedError)

      const authStore = useAuthStore()
      expect(authStore.isAuthenticated).toBe(false)
      expect(authStore.accessToken).toBeNull()
      expect(localStorage.getItem('accessToken')).toBeNull()
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('should throw error when login API fails', async () => {
      const { login } = useAuth()

      const credentials: LoginDTO = {
        email: 'inspector1@example.com',
        password: 'wrong-password',
      }

      // Mock failed login response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response)

      await expect(login(credentials)).rejects.toThrow('Login failed')
    })

    it('should throw error when profile fetch fails', async () => {
      const { login } = useAuth()

      const credentials: LoginDTO = {
        email: 'inspector1@example.com',
        password: 'password123',
      }

      const mockTokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 900,
      }

      // Mock successful login
      vi.mocked(fetch).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTokens),
        } as Response),
      )

      // Mock failed profile fetch
      vi.mocked(fetch).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 401,
        } as Response),
      )

      await expect(login(credentials)).rejects.toThrow('Failed to fetch profile')
    })
  })

  describe('logout', () => {
    it('should call logout API and clear session', async () => {
      const { logout } = useAuth()
      const authStore = useAuthStore()

      // Set up authenticated state
      authStore.accessToken = 'test-token'
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

      // Mock successful logout
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
      } as Response)

      await logout()

      expect(fetch).toHaveBeenCalledWith('http://localhost:4000/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
        },
      })

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
        email: 'inspector1@example.com',
        name: 'Jane Smith',
        role: 'SCO',
        certifications: [],
        disciplines: [],
        designationId: 'SCO-001',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // Mock failed logout
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      await logout()

      expect(authStore.user).toBeNull()
      expect(mockPush).toHaveBeenCalledWith({ path: '/login' })
    })
  })

  describe('refreshToken', () => {
    it('should refresh tokens successfully', async () => {
      const { refreshToken } = useAuth()
      const authStore = useAuthStore()

      authStore.refreshToken = 'old-refresh-token'

      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 900,
      }

      // Mock successful refresh
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(newTokens),
      } as Response)

      await refreshToken()

      expect(fetch).toHaveBeenCalledWith('http://localhost:4000/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: 'old-refresh-token' }),
      })

      expect(authStore.accessToken).toBe('new-access-token')
      expect(authStore.refreshToken).toBe('new-refresh-token')
    })

    it('should logout on refresh failure', async () => {
      const { refreshToken } = useAuth()
      const authStore = useAuthStore()

      authStore.refreshToken = 'invalid-refresh-token'
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

      // Mock failed refresh
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response)

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

  describe('checkOfflineGracePeriod', () => {
    it('should return true when within grace period', () => {
      const { checkOfflineGracePeriod } = useAuth()
      const authStore = useAuthStore()

      authStore.offlineGracePeriodExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000)

      expect(checkOfflineGracePeriod()).toBe(true)
    })

    it('should return false when grace period expired', () => {
      const { checkOfflineGracePeriod } = useAuth()
      const authStore = useAuthStore()

      authStore.offlineGracePeriodExpiry = new Date(Date.now() - 1000)

      expect(checkOfflineGracePeriod()).toBe(false)
    })
  })

  describe('computed properties', () => {
    it('should expose user from store', () => {
      const { user } = useAuth()
      const authStore = useAuthStore()

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

      expect(user.value?.email).toBe('inspector1@example.com')
    })

    it('should expose isAuthenticated from store', () => {
      const { isAuthenticated } = useAuth()
      const authStore = useAuthStore()

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
      authStore.accessToken = 'test-token'

      expect(isAuthenticated.value).toBe(true)
    })

    it('should expose isOfflineGracePeriodActive from store', () => {
      const { isOfflineGracePeriodActive } = useAuth()
      const authStore = useAuthStore()

      authStore.offlineGracePeriodExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000)

      expect(isOfflineGracePeriodActive.value).toBe(true)
    })
  })
})
