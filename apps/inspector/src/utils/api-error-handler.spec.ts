import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { handleApiError, apiFetch } from './api-error-handler'
import { useAuthStore } from '../stores/auth'
import router from '../router'

// Mock router
vi.mock('../router', () => ({
  default: {
    push: vi.fn(),
    currentRoute: {
      value: {
        fullPath: '/permits',
      },
    },
  },
}))

// Mock fetch
global.fetch = vi.fn()

const locationAssign = vi.fn()

describe('API Error Handler', () => {
  let authStore: ReturnType<typeof useAuthStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    authStore = useAuthStore()
    vi.clearAllMocks()
    locationAssign.mockClear()
    vi.stubGlobal('location', {
      pathname: '/permits',
      search: '',
      assign: locationAssign,
    })
  })

  describe('handleApiError', () => {
    it('should handle 401 Unauthorized response', async () => {
      // Set up authenticated user
      authStore.user = {
        id: 'user-1',
        email: 'inspector@example.com',
        name: 'Test Inspector',
        role: 'SCO',
        certifications: [],
        disciplines: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any
      authStore.accessToken = 'expired-token'

      // Create 401 response
      const response = new Response(null, { status: 401 })

      // Handle the error
      await handleApiError(response)

      // Should clear session
      expect(authStore.user).toBeNull()
      expect(authStore.accessToken).toBeNull()

      // Should redirect to login with return path
      expect(router.push).toHaveBeenCalledWith({
        name: 'login',
        query: { redirect: '/permits' },
      })
    })

    it('should not handle non-401 responses', async () => {
      // Set up authenticated user
      authStore.user = {
        id: 'user-1',
        email: 'inspector@example.com',
        name: 'Test Inspector',
        role: 'SCO',
        certifications: [],
        disciplines: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any
      authStore.accessToken = 'valid-token'

      // Create 404 response
      const response = new Response(null, { status: 404 })

      // Handle the error
      await handleApiError(response)

      // Should NOT clear session
      expect(authStore.user).not.toBeNull()
      expect(authStore.accessToken).toBe('valid-token')

      // Should NOT redirect
      expect(router.push).not.toHaveBeenCalled()
    })

    it('should log 401 error to console', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const response = new Response(null, { status: 401 })
      await handleApiError(response)

      expect(consoleSpy).toHaveBeenCalledWith('[API] 401 Unauthorized - redirecting to login')

      consoleSpy.mockRestore()
    })
  })

  describe('apiFetch', () => {
    it('should add Authorization header when token exists', async () => {
      authStore.accessToken = 'valid-token'

      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ data: 'test' }), { status: 200 }),
      )

      await apiFetch('https://api.example.com/test')

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.any(Headers),
        }),
      )

      const callArgs = vi.mocked(fetch).mock.calls[0]
      const headers = callArgs[1]?.headers as Headers
      expect(headers.get('Authorization')).toBe('Bearer valid-token')
    })

    it('should not add Authorization header when token does not exist', async () => {
      authStore.accessToken = null

      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ data: 'test' }), { status: 200 }),
      )

      await apiFetch('https://api.example.com/test')

      const callArgs = vi.mocked(fetch).mock.calls[0]
      const headers = callArgs[1]?.headers as Headers
      expect(headers.get('Authorization')).toBeNull()
    })

    it('should not override existing Authorization header', async () => {
      authStore.accessToken = 'valid-token'

      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ data: 'test' }), { status: 200 }),
      )

      await apiFetch('https://api.example.com/test', {
        headers: {
          Authorization: 'Bearer custom-token',
        },
      })

      const callArgs = vi.mocked(fetch).mock.calls[0]
      const headers = callArgs[1]?.headers as Headers
      expect(headers.get('Authorization')).toBe('Bearer custom-token')
    })

    it('should handle 401 response and throw error when refresh fails', async () => {
      authStore.accessToken = 'expired-token'
      authStore.refreshToken = 'invalid-refresh'
      authStore.user = {
        id: 'user-1',
        email: 'inspector@example.com',
        name: 'Test Inspector',
        role: 'SCO',
        certifications: [],
        disciplines: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any

      vi.mocked(fetch).mockImplementation(async (url) => {
        if (String(url).includes('/auth/refresh')) {
          return new Response(null, { status: 401 })
        }
        return new Response(null, { status: 401 })
      })

      await expect(apiFetch('https://api.example.com/test')).rejects.toThrow(
        'Unauthorized - redirected to login',
      )

      // Should clear session
      expect(authStore.user).toBeNull()
      expect(authStore.accessToken).toBeNull()

      // Should redirect to login (full page — keeps SW bundle free of vue-router)
      expect(locationAssign).toHaveBeenCalledWith('/login?redirect=%2Fpermits')
    })

    it('given two parallel 401 responses, only one POST /auth/refresh is observed', async () => {
      authStore.accessToken = 'expired-token'
      authStore.refreshToken = 'refresh-token'

      let apiCallCount = 0
      vi.mocked(fetch).mockImplementation(async (url) => {
        const urlStr = String(url)
        if (urlStr.includes('/auth/refresh')) {
          return new Response(
            JSON.stringify({ accessToken: 'new-token', refreshToken: 'new-refresh' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }
        apiCallCount += 1
        if (apiCallCount <= 2) {
          return new Response(null, { status: 401 })
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      })

      const [response1, response2] = await Promise.all([
        apiFetch('https://api.example.com/test1'),
        apiFetch('https://api.example.com/test2'),
      ])

      expect(response1.status).toBe(200)
      expect(response2.status).toBe(200)

      const refreshCalls = vi
        .mocked(fetch)
        .mock.calls.filter((call) => String(call[0]).includes('/auth/refresh'))
      expect(refreshCalls).toHaveLength(1)
    })

    it('should retry the original request after a successful refresh without redirecting', async () => {
      authStore.accessToken = 'expired-token'
      authStore.refreshToken = 'refresh-token'
      authStore.user = {
        id: 'user-1',
        email: 'inspector@example.com',
        name: 'Test Inspector',
        role: 'SCO',
        certifications: [],
        disciplines: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any

      let apiCallCount = 0
      vi.mocked(fetch).mockImplementation(async (url) => {
        const urlStr = String(url)
        if (urlStr.includes('/auth/refresh')) {
          return new Response(
            JSON.stringify({ accessToken: 'new-token', refreshToken: 'new-refresh' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }
        apiCallCount += 1
        if (apiCallCount === 1) {
          return new Response(null, { status: 401 })
        }
        return new Response(JSON.stringify({ data: 'ok' }), { status: 200 })
      })

      const response = await apiFetch('https://api.example.com/test')

      expect(response.status).toBe(200)
      expect(authStore.accessToken).toBe('new-token')
      expect(authStore.user).not.toBeNull()
      expect(router.push).not.toHaveBeenCalled()
    })

    it('should not logout when offline grace period is active and navigator is offline', async () => {
      authStore.accessToken = 'expired-token'
      authStore.refreshToken = 'invalid-refresh'
      authStore.offlineGracePeriodExpiry = new Date(Date.now() + 8 * 60 * 60 * 1000)
      authStore.user = {
        id: 'user-1',
        email: 'inspector@example.com',
        name: 'Test Inspector',
        role: 'SCO',
        certifications: [],
        disciplines: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any

      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

      vi.mocked(fetch).mockImplementation(async (url) => {
        if (String(url).includes('/auth/refresh')) {
          return new Response(null, { status: 401 })
        }
        return new Response(null, { status: 401 })
      })

      const response = await apiFetch('https://api.example.com/test')

      expect(response.status).toBe(401)
      expect(authStore.user).not.toBeNull()
      expect(authStore.accessToken).toBe('expired-token')
      expect(router.push).not.toHaveBeenCalled()
    })

    it('should return response for successful requests', async () => {
      authStore.accessToken = 'valid-token'

      const mockResponse = new Response(JSON.stringify({ data: 'test' }), { status: 200 })
      vi.mocked(fetch).mockResolvedValue(mockResponse)

      const response = await apiFetch('https://api.example.com/test')

      expect(response).toBe(mockResponse)
      expect(response.status).toBe(200)
    })

    it('should return response for non-401 error responses', async () => {
      authStore.accessToken = 'valid-token'

      const mockResponse = new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
      vi.mocked(fetch).mockResolvedValue(mockResponse)

      const response = await apiFetch('https://api.example.com/test')

      expect(response).toBe(mockResponse)
      expect(response.status).toBe(404)
    })

    it('should preserve custom headers', async () => {
      authStore.accessToken = 'valid-token'

      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ data: 'test' }), { status: 200 }),
      )

      await apiFetch('https://api.example.com/test', {
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'custom-value',
        },
      })

      const callArgs = vi.mocked(fetch).mock.calls[0]
      const headers = callArgs[1]?.headers as Headers
      expect(headers.get('Content-Type')).toBe('application/json')
      expect(headers.get('X-Custom-Header')).toBe('custom-value')
      expect(headers.get('Authorization')).toBe('Bearer valid-token')
    })

    it('should preserve request options', async () => {
      authStore.accessToken = 'valid-token'

      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ data: 'test' }), { status: 200 }),
      )

      await apiFetch('https://api.example.com/test', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
      })

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ test: 'data' }),
        }),
      )
    })
  })

  describe('Integration: Token Expiration During API Call', () => {
    it('should handle token expiration mid-session', async () => {
      // User starts authenticated
      authStore.user = {
        id: 'user-1',
        email: 'inspector@example.com',
        name: 'Test Inspector',
        role: 'SCO',
        certifications: [],
        disciplines: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any
      authStore.accessToken = 'valid-token'

      expect(authStore.isAuthenticated).toBe(true)

      // First API call succeeds
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ data: 'success' }), { status: 200 }),
      )

      const response1 = await apiFetch('https://api.example.com/test1')
      expect(response1.status).toBe(200)
      expect(authStore.isAuthenticated).toBe(true)

      // Token expires, second API call returns 401 and refresh fails
      authStore.refreshToken = 'invalid-refresh'
      vi.mocked(fetch).mockImplementation(async (url) => {
        if (String(url).includes('/auth/refresh')) {
          return new Response(null, { status: 401 })
        }
        return new Response(null, { status: 401 })
      })

      await expect(apiFetch('https://api.example.com/test2')).rejects.toThrow(
        'Unauthorized - redirected to login',
      )

      // User should be logged out
      expect(authStore.isAuthenticated).toBe(false)
      expect(authStore.user).toBeNull()
      expect(authStore.accessToken).toBeNull()

      // Should be redirected to login
      expect(locationAssign).toHaveBeenCalledWith('/login?redirect=%2Fpermits')
    })
  })
})
