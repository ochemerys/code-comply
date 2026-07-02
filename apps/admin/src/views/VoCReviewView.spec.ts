import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createRouter, createMemoryHistory } from 'vue-router'
import type { UserDTO, VoCDTO } from '@codecomply/validators'
import VoCReviewView from './VoCReviewView.vue'
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

const samplePending: VoCDTO[] = [
  {
    id: 'voc-a',
    deficiencyId: 'def-a',
    verificationDate: iso(),
    sectionTitle: '9.8',
    title: 'Handrail height',
    name: 'Acme Ltd',
    method: 'WRITTEN_ASSURANCE',
    submittedAt: iso(),
    status: 'PENDING',
  },
  {
    id: 'voc-b',
    deficiencyId: 'def-b',
    verificationDate: iso(),
    sectionTitle: '3.2',
    title: 'Egress width',
    name: 'Site contact',
    method: 'SITE_VISIT',
    submittedAt: iso(),
    status: 'PENDING',
  },
]

describe('VoCReviewView', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.setUser(adminUser())
    auth.updateTokens({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 })
    vi.restoreAllMocks()
  })

  it('loads pending VoCs and shows list', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(samplePending), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/compliance/voc', name: 'voc-review', component: { template: '<div />' } }],
    })
    await router.push('/compliance/voc')

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const wrapper = mount(VoCReviewView, {
      global: { plugins: [pinia, router, [VueQueryPlugin, { queryClient }]] },
    })

    await flushPromises()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Handrail height'))

    expect(fetchMock).toHaveBeenCalled()
    const calls = fetchMock.mock.calls as unknown[][]
    const firstUrl = String(calls[0]?.[0] ?? '')
    expect(firstUrl).toContain('/api/voc/pending')

    expect(wrapper.find('[data-testid="voc-review-card-voc-a"]').exists()).toBe(true)

    vi.unstubAllGlobals()
  })

  it('selects a card and submits accept decision', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/pending')) {
        return new Response(JSON.stringify(samplePending), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('/review') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            ...samplePending[0],
            status: 'ACCEPTED',
            reviewedAt: iso(),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response('', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/compliance/voc', name: 'voc-review', component: { template: '<div />' } }],
    })
    await router.push('/compliance/voc')

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const wrapper = mount(VoCReviewView, {
      global: { plugins: [pinia, router, [VueQueryPlugin, { queryClient }]] },
    })

    await flushPromises()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Handrail height'))

    await wrapper.get('[data-testid="voc-review-card-voc-a"]').trigger('click')
    expect(wrapper.get('[data-testid="voc-review-deficiency-id"]').text()).toContain('def-a')

    await wrapper.get('[data-testid="voc-review-accept"]').trigger('click')
    expect(wrapper.find('[data-testid="voc-decision-dialog"]').exists()).toBe(true)

    await wrapper.get('[data-testid="voc-decision-confirm-accept"]').trigger('click')
    await flushPromises()

    const reviewCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/api/voc/voc-a/review'),
    )
    expect(reviewCalls.length).toBeGreaterThan(0)
    const [, init] = reviewCalls[0]!
    expect((init as RequestInit).method).toBe('POST')
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ decision: 'ACCEPTED' })

    vi.unstubAllGlobals()
  })

  it('submits reject with comments in body', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/pending')) {
        return new Response(JSON.stringify(samplePending), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('/review') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({ ...samplePending[0], status: 'REJECTED', reviewedAt: iso() }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response('', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/compliance/voc', name: 'voc-review', component: { template: '<div />' } }],
    })
    await router.push('/compliance/voc')

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const wrapper = mount(VoCReviewView, {
      global: { plugins: [pinia, router, [VueQueryPlugin, { queryClient }]] },
    })

    await flushPromises()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Handrail height'))

    await wrapper.get('[data-testid="voc-review-card-voc-a"]').trigger('click')
    await wrapper.get('[data-testid="voc-review-reject"]').trigger('click')
    await wrapper.get('[data-testid="voc-decision-comments"]').setValue('Need stamped drawings')
    await wrapper.get('[data-testid="voc-decision-confirm-reject"]').trigger('click')
    await flushPromises()

    const reviewCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/api/voc/voc-a/review'),
    )
    const [, init] = reviewCalls[0]!
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      decision: 'REJECTED',
      comments: 'Need stamped drawings',
    })

    vi.unstubAllGlobals()
  })

  it('on 401 clears session, redirects to login, and hides generic load error (M10-S14)', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', name: 'login', component: { template: '<div />' } },
        {
          path: '/compliance/voc',
          name: 'voc-review',
          component: VoCReviewView,
        },
      ],
    })
    await router.push('/compliance/voc')

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

    const wrapper = mount(VoCReviewView, {
      global: { plugins: [pinia, router, [VueQueryPlugin, { queryClient }]] },
    })

    await flushPromises()
    await vi.waitFor(() => expect(replaceSpy).toHaveBeenCalled())

    expect(replaceSpy).toHaveBeenCalledWith({
      name: 'login',
      query: expect.objectContaining({
        reason: 'session_expired',
        redirect: '/compliance/voc',
      }),
    })

    expect(useAuthStore().isAuthenticated).toBe(false)
    expect(wrapper.find('[data-testid="voc-review-error"]').exists()).toBe(false)

    wrapper.unmount()
    replaceSpy.mockRestore()
    vi.unstubAllGlobals()
  })
})
