import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  SessionExpiredRedirectError,
  fetchAdminUsers,
  isSessionExpiredRedirectError,
} from './useAdminUsersList'
import { useAuthStore } from '../stores/auth'
import {
  configureAdminSessionExpiredRedirect,
  SessionExpiredRedirectError as ApiSessionExpiredRedirectError,
} from '../utils/admin-api-fetch'

describe('useAdminUsersList helpers (M9-S8-B1)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    configureAdminSessionExpiredRedirect(async () => {
      throw new ApiSessionExpiredRedirectError()
    })
  })

  it('isSessionExpiredRedirectError narrows SessionExpiredRedirectError', () => {
    expect(isSessionExpiredRedirectError(new SessionExpiredRedirectError())).toBe(true)
    expect(isSessionExpiredRedirectError(new Error('Failed to load users (401)'))).toBe(false)
  })

  it('fetchAdminUsers throws SessionExpiredRedirectError when refresh fails after 401', async () => {
    const auth = useAuthStore()
    auth.accessToken = 'expired'
    auth.refreshToken = 'invalid'

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 401 })),
    )

    await expect(fetchAdminUsers({ role: '', isActive: 'all', search: '' })).rejects.toThrow(
      SessionExpiredRedirectError,
    )

    vi.unstubAllGlobals()
  })
})
