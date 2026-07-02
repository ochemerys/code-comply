import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { UserDTO } from '@codecomply/validators'
import { useAuthStore } from '../stores/auth'
import {
  configureAdminSessionExpiredRedirect,
  SessionExpiredRedirectError,
} from '../utils/admin-api-fetch'
import { fetchPendingVoCs, postVoCReview } from './useAdminVoC'

const iso = () => new Date().toISOString()

const adminUser = (): UserDTO => ({
  id: 'admin',
  email: 'admin@test.com',
  name: 'Admin',
  role: 'ADMIN',
  disciplines: [],
  certifications: [],
  createdAt: iso(),
  updatedAt: iso(),
})

describe('useAdminVoC fetch helpers', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.setUser(adminUser())
    auth.updateTokens({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 })
    vi.restoreAllMocks()
    configureAdminSessionExpiredRedirect(async () => {
      throw new SessionExpiredRedirectError()
    })
  })

  it('fetchPendingVoCs calls pending endpoint with bearer token', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await fetchPendingVoCs()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/voc/pending'),
      expect.any(Object),
    )
    const firstCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(firstCall[1].headers).toBeInstanceOf(Headers)
    expect((firstCall[1].headers as Headers).get('Authorization')).toBe('Bearer tok')

    vi.unstubAllGlobals()
  })

  it('postVoCReview posts JSON body', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: 'voc-1', status: 'ACCEPTED' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await postVoCReview('voc-1', { decision: 'ACCEPTED', comments: 'ok' })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/voc/voc-1/review'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ decision: 'ACCEPTED', comments: 'ok' }),
      }),
    )

    vi.unstubAllGlobals()
  })

  it('postVoCReview throws with API error message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'not pending' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )

    await expect(postVoCReview('voc-1', { decision: 'REJECTED' })).rejects.toThrow('not pending')

    vi.unstubAllGlobals()
  })

  it('fetchPendingVoCs throws SessionExpiredRedirectError when refresh fails after 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 401 })),
    )

    await expect(fetchPendingVoCs()).rejects.toThrow(SessionExpiredRedirectError)

    vi.unstubAllGlobals()
  })

  it('postVoCReview throws SessionExpiredRedirectError when refresh fails after 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 401 })),
    )

    await expect(postVoCReview('voc-1', { decision: 'ACCEPTED' })).rejects.toThrow(
      SessionExpiredRedirectError,
    )

    vi.unstubAllGlobals()
  })

  it('postVoCReview surfaces non-JSON error body text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not json', { status: 502, statusText: 'Bad Gateway' })),
    )

    await expect(postVoCReview('voc-1', { decision: 'ACCEPTED' })).rejects.toThrow('not json')

    vi.unstubAllGlobals()
  })
})
