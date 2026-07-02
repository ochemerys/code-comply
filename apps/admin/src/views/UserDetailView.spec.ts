import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createRouter, createMemoryHistory } from 'vue-router'
import type { UserDTO } from '@codecomply/validators'
import UserDetailView from './UserDetailView.vue'
import { useAuthStore } from '../stores/auth'
import {
  configureAdminSessionExpiredRedirect,
  SessionExpiredRedirectError,
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

function targetUser(): UserDTO {
  return {
    id: 'u1',
    email: 'alice@test.com',
    name: 'Alice',
    role: 'SCO',
    disciplines: ['Plumbing'],
    isActive: true,
    certifications: [],
    createdAt: iso(),
    updatedAt: iso(),
  }
}

function createDetailRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: { template: '<div />' } },
      { path: '/users', name: 'users', component: { template: '<div />' } },
      { path: '/users/:id', name: 'user-detail', component: UserDetailView },
    ],
  })
}

describe('UserDetailView', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.setUser(adminUser())
    auth.updateTokens({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 })
    vi.restoreAllMocks()
  })

  it('loads user and shows profile fields', async () => {
    const user = targetUser()
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url
      const method = init?.method ?? 'GET'
      if (method === 'GET' && /\/api\/admin\/users\/u1(?:\?|$)/.test(url)) {
        return new Response(JSON.stringify(user), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('unexpected', { status: 500 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const router = createDetailRouter()
    await router.push({ name: 'user-detail', params: { id: 'u1' } })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const wrapper = mount(UserDetailView, {
      global: { plugins: [pinia, router, [VueQueryPlugin, { queryClient }]] },
    })

    await flushPromises()
    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="user-form-email"]').text()).toContain('alice@test.com'),
    )

    expect(wrapper.find('[data-testid="user-detail-basic"]').exists()).toBe(true)
    expect(fetchMock).toHaveBeenCalled()

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('keeps disciplines and authorities in one place (no separate section) (M9-S8-B2)', async () => {
    const user = targetUser()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(user), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )

    const router = createDetailRouter()
    await router.push({ name: 'user-detail', params: { id: 'u1' } })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const wrapper = mount(UserDetailView, {
      global: { plugins: [pinia, router, [VueQueryPlugin, { queryClient }]] },
    })

    await flushPromises()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="user-detail-basic"]').exists()).toBe(true),
    )

    expect(wrapper.find('[data-testid="user-form-disciplines"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="user-form-authorities"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="user-detail-disciplines-note"]').exists()).toBe(false)

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('submits profile patch when Save profile is clicked', async () => {
    const user = targetUser()
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url
      const method = init?.method ?? 'GET'
      if (method === 'GET' && /\/api\/admin\/users\/u1(?:\?|$)/.test(url)) {
        return new Response(JSON.stringify(user), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (method === 'PATCH' && url.includes('/api/admin/users/u1')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
        return new Response(JSON.stringify({ ...user, name: body.name }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('unexpected', { status: 500 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const router = createDetailRouter()
    await router.push({ name: 'user-detail', params: { id: 'u1' } })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const wrapper = mount(UserDetailView, {
      global: { plugins: [pinia, router, [VueQueryPlugin, { queryClient }]] },
    })

    await flushPromises()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="user-form-name"]').exists()).toBe(true),
    )

    await wrapper.get('[data-testid="user-form-name"]').setValue('Alice Updated')
    await wrapper.get('[data-testid="user-detail-save-profile"]').trigger('click')
    await flushPromises()

    const patchCalls = fetchMock.mock.calls.filter(
      (c) => (c[1] as RequestInit | undefined)?.method === 'PATCH',
    )
    expect(patchCalls.length).toBeGreaterThan(0)
    const body = JSON.parse(String((patchCalls[0]?.[1] as RequestInit)?.body ?? '{}')) as {
      name: string
    }
    expect(body.name).toBe('Alice Updated')

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('navigates back to users list', async () => {
    const user = targetUser()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(user), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )

    const router = createDetailRouter()
    const pushSpy = vi.spyOn(router, 'push').mockResolvedValue(undefined)
    await router.push({ name: 'user-detail', params: { id: 'u1' } })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const wrapper = mount(UserDetailView, {
      global: { plugins: [pinia, router, [VueQueryPlugin, { queryClient }]] },
    })

    await flushPromises()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="user-detail-back"]').exists()).toBe(true),
    )

    await wrapper.get('[data-testid="user-detail-back"]').trigger('click')
    expect(pushSpy).toHaveBeenCalledWith({ name: 'users' })

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('on 401 clears session, redirects to login, and hides generic load error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 401 })),
    )

    const router = createDetailRouter()
    await router.push({ name: 'user-detail', params: { id: 'u1' } })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const replaceSpy = vi.spyOn(router, 'replace').mockResolvedValue(undefined)

    configureAdminSessionExpiredRedirect(async () => {
      await router.replace({
        name: 'login',
        query: {
          reason: 'session_expired',
          redirect: router.currentRoute.value.fullPath,
        },
      })
      throw new SessionExpiredRedirectError()
    })

    const wrapper = mount(UserDetailView, {
      global: { plugins: [pinia, router, [VueQueryPlugin, { queryClient }]] },
    })

    await flushPromises()
    await vi.waitFor(() => expect(replaceSpy).toHaveBeenCalled())

    expect(replaceSpy).toHaveBeenCalledWith({
      name: 'login',
      query: expect.objectContaining({
        reason: 'session_expired',
        redirect: '/users/u1',
      }),
    })

    expect(useAuthStore().isAuthenticated).toBe(false)
    expect(wrapper.find('[data-testid="user-detail-error"]').exists()).toBe(false)

    wrapper.unmount()
    replaceSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('shows error when user fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: 'missing' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )

    const router = createDetailRouter()
    await router.push({ name: 'user-detail', params: { id: 'u1' } })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const wrapper = mount(UserDetailView, {
      global: { plugins: [pinia, router, [VueQueryPlugin, { queryClient }]] },
    })

    await flushPromises()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="user-detail-error"]').exists()).toBe(true),
    )

    expect(wrapper.get('[data-testid="user-detail-error"]').text()).toContain('not found')

    wrapper.unmount()
    vi.unstubAllGlobals()
  })
})
