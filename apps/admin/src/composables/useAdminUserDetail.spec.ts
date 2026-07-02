import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { defineComponent, h, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import type { CertificationDTO, UserDTO } from '@codecomply/validators'
import {
  SessionExpiredRedirectError,
  fetchAdminUser,
  isSessionExpiredRedirectError,
  patchAdminUser,
  postAdminUserCertifications,
  postAdminUserDeactivate,
  postAdminUserRemoteWipe,
  useAdminUserDetail,
} from './useAdminUserDetail'
import { useAuthStore } from '../stores/auth'
import {
  configureAdminSessionExpiredRedirect,
  SessionExpiredRedirectError as ApiSessionExpiredRedirectError,
} from '../utils/admin-api-fetch'

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

const targetUser = (overrides: Partial<UserDTO> = {}): UserDTO => ({
  id: 'u1',
  email: 'alice@test.com',
  name: 'Alice',
  role: 'SCO',
  disciplines: ['Plumbing'],
  isActive: true,
  certifications: [],
  createdAt: iso(),
  updatedAt: iso(),
  ...overrides,
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('useAdminUserDetail helpers', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.setUser(adminUser())
    auth.updateTokens({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 })
    vi.restoreAllMocks()
    configureAdminSessionExpiredRedirect(async () => {
      throw new ApiSessionExpiredRedirectError()
    })
  })

  it('isSessionExpiredRedirectError narrows SessionExpiredRedirectError', () => {
    expect(isSessionExpiredRedirectError(new SessionExpiredRedirectError())).toBe(true)
    expect(isSessionExpiredRedirectError(new Error('Failed to load user (401)'))).toBe(false)
  })

  it('fetchAdminUser resolves the user on a successful load', async () => {
    const user = targetUser()
    const fetchMock = vi.fn(async () => jsonResponse(user))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchAdminUser('u1')).resolves.toEqual(user)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/users/u1'),
      expect.any(Object),
    )

    vi.unstubAllGlobals()
  })

  it('fetchAdminUser throws SessionExpiredRedirectError when refresh fails after 401', async () => {
    const auth = useAuthStore()
    auth.accessToken = 'expired'
    auth.refreshToken = 'invalid'

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 401 })),
    )

    await expect(fetchAdminUser('u1')).rejects.toThrow(SessionExpiredRedirectError)

    vi.unstubAllGlobals()
  })

  it('fetchAdminUser throws User not found on 404 without session redirect', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    )

    await expect(fetchAdminUser('missing')).rejects.toThrow('User not found')
    expect(useAuthStore().isAuthenticated).toBe(true)

    vi.unstubAllGlobals()
  })

  it('patchAdminUser sends the patch body and resolves the updated user', async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { name?: string }
      return jsonResponse(targetUser({ name: body.name }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await patchAdminUser('u1', { name: 'Alice Updated' })
    expect(result.name).toBe('Alice Updated')
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[1].method).toBe('PATCH')

    vi.unstubAllGlobals()
  })

  it('patchAdminUser throws SessionExpiredRedirectError when refresh fails after 401', async () => {
    const auth = useAuthStore()
    auth.accessToken = 'expired'
    auth.refreshToken = 'invalid'

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 401 })),
    )

    await expect(patchAdminUser('u1', { name: 'Alice' })).rejects.toThrow(
      SessionExpiredRedirectError,
    )

    vi.unstubAllGlobals()
  })

  it('patchAdminUser throws User not found on 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    )

    await expect(patchAdminUser('missing', { name: 'Alice' })).rejects.toThrow('User not found')

    vi.unstubAllGlobals()
  })

  it('postAdminUserCertifications posts the certifications payload', async () => {
    const certifications = [
      { name: 'Plumbing', issuer: 'ACME', issuedAt: iso() },
    ] as unknown as CertificationDTO[]
    const fetchMock = vi.fn(async () => jsonResponse(targetUser({ certifications })))
    vi.stubGlobal('fetch', fetchMock)

    const result = await postAdminUserCertifications('u1', certifications)
    expect(result.certifications).toEqual(certifications)
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[0]).toContain('/api/admin/users/u1/certifications')
    expect(call[1].method).toBe('POST')

    vi.unstubAllGlobals()
  })

  it('postAdminUserDeactivate posts to the deactivate endpoint and returns the user', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(targetUser({ isActive: false })))
    vi.stubGlobal('fetch', fetchMock)

    const result = await postAdminUserDeactivate('u1')
    expect(result.isActive).toBe(false)
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[0]).toContain('/api/admin/users/u1/deactivate')
    expect(call[1].method).toBe('POST')

    vi.unstubAllGlobals()
  })

  it('postAdminUserRemoteWipe returns the wipe acknowledgement shape', async () => {
    const ack = { message: 'Remote wipe requested', requestedAt: iso(), userId: 'u1' }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(ack)),
    )

    const result = await postAdminUserRemoteWipe('u1')
    expect(result).toEqual(ack)
    expect(result.userId).toBe('u1')
    expect(typeof result.requestedAt).toBe('string')

    vi.unstubAllGlobals()
  })

  it('postAdminUserDeactivate throws SessionExpiredRedirectError when refresh fails after 401', async () => {
    const auth = useAuthStore()
    auth.accessToken = 'expired'
    auth.refreshToken = 'invalid'

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 401 })),
    )

    await expect(postAdminUserDeactivate('u1')).rejects.toThrow(SessionExpiredRedirectError)

    vi.unstubAllGlobals()
  })
})

describe('useAdminUserDetail hook', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.setUser(adminUser())
    auth.updateTokens({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 })
    vi.restoreAllMocks()
    configureAdminSessionExpiredRedirect(async () => {
      throw new ApiSessionExpiredRedirectError()
    })
  })

  function mountHook(userId = 'u1') {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    let detail!: ReturnType<typeof useAdminUserDetail>
    const TestComponent = defineComponent({
      setup() {
        detail = useAdminUserDetail(ref(userId))
        return () => h('div')
      },
    })
    const wrapper = mount(TestComponent, {
      global: { plugins: [pinia, [VueQueryPlugin, { queryClient }]] },
    })
    return { wrapper, queryClient, getDetail: () => detail }
  }

  it('loads the user through userQuery', async () => {
    const user = targetUser()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(user)),
    )

    const { wrapper, getDetail } = mountHook()
    await flushPromises()
    await vi.waitFor(() => expect(getDetail().userQuery.data.value).toEqual(user))

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('patch mutation invalidates the admin users list query key', async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { name?: string }
      return jsonResponse(targetUser({ name: body.name ?? 'Alice' }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const { wrapper, queryClient, getDetail } = mountHook()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const setDataSpy = vi.spyOn(queryClient, 'setQueryData')

    await getDetail().patchUser.mutateAsync({ name: 'Alice Updated' })
    await flushPromises()

    expect(setDataSpy).toHaveBeenCalledWith(
      ['admin', 'user', 'u1'],
      expect.objectContaining({ name: 'Alice Updated' }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'users'] })

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('deactivate mutation invalidates the admin users list query key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(targetUser({ isActive: false }))),
    )

    const { wrapper, queryClient, getDetail } = mountHook()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const result = await getDetail().deactivateUser.mutateAsync()
    await flushPromises()

    expect(result.isActive).toBe(false)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'users'] })

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('remote wipe mutation resolves the acknowledgement without touching the list cache', async () => {
    const ack = { message: 'Remote wipe requested', requestedAt: iso(), userId: 'u1' }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(ack)),
    )

    const { wrapper, queryClient, getDetail } = mountHook()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const result = await getDetail().remoteWipeUser.mutateAsync()
    await flushPromises()

    expect(result).toEqual(ack)
    expect(invalidateSpy).not.toHaveBeenCalled()

    wrapper.unmount()
    vi.unstubAllGlobals()
  })
})
