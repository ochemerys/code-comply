import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuth } from '../useAuth'
import { useAuthStore } from '../../stores/auth'
import type { LoginDTO } from '@codecomply/validators'

// Mock sync engine
vi.mock('../../lib/db/sync-engine', () => ({
  syncEngine: {
    resumeSync: vi.fn().mockResolvedValue(undefined),
    pauseSync: vi.fn(),
    setAuthCheck: vi.fn(),
  },
}))

// Mock the router (spread real vue-router so router/index can load via permit-orphan-sync → api-error-handler)
const routerMocks = vi.hoisted(() => {
  const mockCurrentRoute = {
    value: {
      query: {} as Record<string, string>,
      fullPath: '/',
    },
  }
  return {
    mockPush: vi.fn(),
    mockCurrentRoute,
  }
})

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({
      push: routerMocks.mockPush,
      currentRoute: routerMocks.mockCurrentRoute,
    }),
  }
})

const { mockPush, mockCurrentRoute } = routerMocks

// Mock fetch globally
global.fetch = vi.fn()

describe('useAuth', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
    mockCurrentRoute.value.query = {}
  })

  it('should expose user and isAuthenticated from store', () => {
    const authStore = useAuthStore()
    const { user, isAuthenticated } = useAuth()

    expect(user.value).toBeNull()
    expect(isAuthenticated.value).toBe(false)

    authStore.user = {
      id: '1',
      name: 'Test',
      email: 'test@example.com',
      role: 'SCO',
      certifications: [],
      disciplines: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    authStore.accessToken = 'token'

    expect(user.value).toBeTruthy()
    expect(isAuthenticated.value).toBe(true)
  })

  it('should login successfully and redirect to home', async () => {
    const { login } = useAuth()

    const credentials: LoginDTO = {
      email: 'test@example.com',
      password: 'password123',
    }

    const mockTokens = {
      accessToken: 'test-token',
      refreshToken: 'test-refresh-token',
      expiresIn: 3600,
    }

    const mockUser = {
      id: '1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'SCO',
      certifications: [],
      disciplines: [],
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

    // Mock profile fetch
    vi.mocked(fetch).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockUser),
      } as Response),
    )

    await login(credentials)

    expect(fetch).toHaveBeenNthCalledWith(1, 'http://localhost:4000/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    })
    expect(fetch).toHaveBeenNthCalledWith(2, 'http://localhost:4000/auth/me', {
      headers: {
        Authorization: 'Bearer test-token',
      },
    })
    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('should redirect to intended route after login', async () => {
    const { login } = useAuth()

    mockCurrentRoute.value.query = { redirect: '/inspections' }

    const credentials: LoginDTO = {
      email: 'test@example.com',
      password: 'password123',
    }

    const mockTokens = {
      accessToken: 'test-token',
      refreshToken: 'test-refresh-token',
      expiresIn: 3600,
    }

    const mockUser = {
      id: '1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'SCO',
      certifications: [],
      disciplines: [],
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

    // Mock profile fetch
    vi.mocked(fetch).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockUser),
      } as Response),
    )

    await login(credentials)

    expect(mockPush).toHaveBeenCalledWith('/inspections')
  })

  it('should throw error on login failure', async () => {
    const { login } = useAuth()

    const credentials: LoginDTO = {
      email: 'test@example.com',
      password: 'wrong-password',
    }

    // Mock failed login
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response)

    await expect(login(credentials)).rejects.toThrow('Login failed')
  })

  it('should logout and redirect to login', async () => {
    const authStore = useAuthStore()
    const { logout } = useAuth()

    authStore.accessToken = 'test-token'

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
    expect(authStore.accessToken).toBeNull()
    expect(mockPush).toHaveBeenCalledWith({ path: '/login' })
  })

  it('should logout even if API call fails', async () => {
    const authStore = useAuthStore()
    const { logout } = useAuth()

    authStore.accessToken = 'test-token'

    // Mock failed logout
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

    await logout()

    expect(authStore.accessToken).toBeNull()
    expect(mockPush).toHaveBeenCalledWith({ path: '/login' })
  })

  it('should refresh token successfully', async () => {
    const authStore = useAuthStore()
    const { refreshToken } = useAuth()

    authStore.refreshToken = 'old-refresh-token'

    const mockNewTokens = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 3600,
    }

    // Mock successful refresh
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockNewTokens),
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

  it('should logout on refresh token failure', async () => {
    const authStore = useAuthStore()
    const { refreshToken } = useAuth()

    authStore.refreshToken = 'invalid-refresh-token'

    // Mock failed refresh
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response)

    await expect(refreshToken()).rejects.toThrow('Token refresh failed')
    expect(authStore.accessToken).toBeNull()
    expect(mockPush).toHaveBeenCalledWith({ path: '/login' })
  })

  it('should throw error if no refresh token available', async () => {
    const { refreshToken } = useAuth()

    await expect(refreshToken()).rejects.toThrow('No refresh token available')
  })

  it('should check offline grace period', () => {
    const authStore = useAuthStore()
    const { checkOfflineGracePeriod } = useAuth()

    expect(checkOfflineGracePeriod()).toBe(false)

    authStore.offlineGracePeriodExpiry = new Date(Date.now() + 1000 * 60 * 60)
    expect(checkOfflineGracePeriod()).toBe(true)
  })
})
