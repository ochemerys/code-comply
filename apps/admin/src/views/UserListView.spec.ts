import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createRouter, createMemoryHistory } from 'vue-router'
import type { UserDTO } from '@codecomply/validators'
import UserListView from './UserListView.vue'
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

const sampleUsers: UserDTO[] = [
  {
    id: 'u1',
    name: 'Alice',
    email: 'alice@test.com',
    role: 'SCO',
    disciplines: ['Building'],
    isActive: true,
    certifications: [],
    createdAt: iso(),
    updatedAt: iso(),
  },
  {
    id: 'u2',
    name: 'Bob',
    email: 'bob@test.com',
    role: 'ADMIN',
    disciplines: ['Plumbing'],
    isActive: false,
    certifications: [],
    createdAt: iso(),
    updatedAt: iso(),
  },
]

describe('UserListView', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.setUser(adminUser())
    auth.updateTokens({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 })
    vi.restoreAllMocks()
  })

  it('loads users and shows filters', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(sampleUsers), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/users', name: 'users', component: { template: '<div />' } }],
    })
    await router.push('/users')

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const wrapper = mount(UserListView, {
      global: { plugins: [pinia, router, [VueQueryPlugin, { queryClient }]] },
    })

    await flushPromises()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Alice'))

    expect(fetchMock).toHaveBeenCalled()
    const calls = fetchMock.mock.calls as unknown[][]
    const firstUrl = String(calls[0]?.[0] ?? '')
    expect(firstUrl).toContain('/api/admin/users')

    expect(wrapper.find('[data-testid="user-list-filter-role"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="user-list-search"]').exists()).toBe(true)

    vi.unstubAllGlobals()
  })

  it('on 401 clears session, redirects to login, and hides generic load error (M9-S8-B1)', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', name: 'login', component: { template: '<div />' } },
        { path: '/users', name: 'users', component: UserListView },
      ],
    })
    await router.push('/users')

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

    const wrapper = mount(UserListView, {
      global: { plugins: [pinia, router, [VueQueryPlugin, { queryClient }]] },
    })

    await flushPromises()
    await vi.waitFor(() => expect(replaceSpy).toHaveBeenCalled())

    expect(replaceSpy).toHaveBeenCalledWith({
      name: 'login',
      query: expect.objectContaining({
        reason: 'session_expired',
        redirect: '/users',
      }),
    })

    expect(useAuthStore().isAuthenticated).toBe(false)
    expect(wrapper.find('[data-testid="user-list-error"]').exists()).toBe(false)

    wrapper.unmount()
    replaceSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('applies server search after debounce', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/users', name: 'users', component: { template: '<div />' } }],
    })
    await router.push('/users')

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const wrapper = mount(UserListView, {
      attachTo: document.body,
      global: { plugins: [pinia, router, [VueQueryPlugin, { queryClient }]] },
    })

    await flushPromises()
    const initialCalls = fetchMock.mock.calls.length

    await wrapper.get('[data-testid="user-list-search"]').setValue('alice')

    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()

    expect(fetchMock.mock.calls.length).toBeGreaterThan(initialCalls)
    const calls = fetchMock.mock.calls as unknown[][]
    const lastCall = calls[calls.length - 1]
    const lastUrl = String(lastCall?.[0] ?? '')
    expect(lastUrl).toContain('search=alice')

    wrapper.unmount()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('navigates to user detail when View is clicked', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(sampleUsers), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/users', name: 'users', component: UserListView },
        {
          path: '/users/:id',
          name: 'user-detail',
          component: { template: '<div data-testid="detail" />' },
        },
      ],
    })
    await router.push('/users')

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const pushSpy = vi.spyOn(router, 'push').mockResolvedValue(undefined)

    const wrapper = mount(UserListView, {
      global: { plugins: [pinia, router, [VueQueryPlugin, { queryClient }]] },
    })

    await flushPromises()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Alice'))

    await wrapper.get('[data-testid="user-table-view-u1"]').trigger('click')
    expect(pushSpy).toHaveBeenCalledWith({ name: 'user-detail', params: { id: 'u1' } })

    wrapper.unmount()
    vi.unstubAllGlobals()
  })
})
