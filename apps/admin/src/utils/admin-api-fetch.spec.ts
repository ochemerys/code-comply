import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  adminApiFetch,
  configureAdminSessionExpiredRedirect,
  refreshAdminAccessToken,
  resetAdminApiFetchStateForTests,
  SessionExpiredRedirectError,
} from './admin-api-fetch'
import { useAuthStore } from '../stores/auth'

describe('adminApiFetch', () => {
  const mockReplace = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
    resetAdminApiFetchStateForTests()
    global.fetch = vi.fn()
    configureAdminSessionExpiredRedirect(async () => {
      await mockReplace({
        name: 'login',
        query: {
          reason: 'session_expired',
          redirect: '/users',
        },
      })
      throw new SessionExpiredRedirectError()
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    resetAdminApiFetchStateForTests()
  })

  it('two parallel 401 responses trigger only one POST /auth/refresh', async () => {
    const authStore = useAuthStore()
    authStore.accessToken = 'expired-access'
    authStore.refreshToken = 'valid-refresh'
    localStorage.setItem('admin_accessToken', 'expired-access')
    localStorage.setItem('admin_refreshToken', 'valid-refresh')

    const newTokens = {
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      expiresIn: 900,
    }

    let refreshCallCount = 0

    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.includes('/auth/refresh')) {
        refreshCallCount += 1
        await new Promise((r) => setTimeout(r, 10))
        return new Response(JSON.stringify(newTokens), { status: 200 })
      }
      const headers = init?.headers as Headers | undefined
      const authHeader = headers?.get?.('Authorization')
      if (authHeader === 'Bearer expired-access') {
        return new Response('', { status: 401 })
      }
      if (authHeader === 'Bearer new-access') {
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      return new Response('', { status: 500 })
    })

    const [resA, resB] = await Promise.all([
      adminApiFetch('http://localhost:4000/api/admin/users'),
      adminApiFetch('http://localhost:4000/api/admin/compliance-search'),
    ])

    expect(refreshCallCount).toBe(1)
    expect(resA.status).toBe(200)
    expect(resB.status).toBe(200)
    expect(authStore.accessToken).toBe('new-access')
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('401 then successful refresh retries without router navigation', async () => {
    const authStore = useAuthStore()
    authStore.accessToken = 'expired-access'
    authStore.refreshToken = 'valid-refresh'

    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessToken: 'new-access',
            refreshToken: 'new-refresh',
            expiresIn: 900,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'u1' }]), { status: 200 }))

    const res = await adminApiFetch('http://localhost:4000/api/admin/users')

    expect(res.status).toBe(200)
    expect(mockReplace).not.toHaveBeenCalled()
    expect(authStore.accessToken).toBe('new-access')
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('logout and redirect when refresh fails after 401', async () => {
    const authStore = useAuthStore()
    authStore.accessToken = 'expired-access'
    authStore.refreshToken = 'invalid-refresh'
    localStorage.setItem('admin_accessToken', 'expired-access')
    localStorage.setItem('admin_refreshToken', 'invalid-refresh')

    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response('', { status: 401 }))

    await expect(adminApiFetch('http://localhost:4000/api/admin/users')).rejects.toThrow(
      SessionExpiredRedirectError,
    )

    expect(mockReplace).toHaveBeenCalledWith({
      name: 'login',
      query: {
        reason: 'session_expired',
        redirect: '/users',
      },
    })
    expect(authStore.accessToken).toBeNull()
    expect(localStorage.getItem('admin_accessToken')).toBeNull()
  })
})

describe('refreshAdminAccessToken', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
    resetAdminApiFetchStateForTests()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    resetAdminApiFetchStateForTests()
  })

  it('returns false when no refresh token is available', async () => {
    expect(await refreshAdminAccessToken()).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })
})
