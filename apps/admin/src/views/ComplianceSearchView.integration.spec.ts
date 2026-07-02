import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createRouter, createMemoryHistory } from 'vue-router'
import type { UserDTO } from '@codecomply/validators'
import ComplianceSearchView from './ComplianceSearchView.vue'
import { useAuthStore } from '../stores/auth'

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

function createFetchMock() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/api/admin/users')) {
      return new Response(JSON.stringify([{ id: 'u1', name: 'Alice' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (url.includes('/api/admin/compliance-search')) {
      return new Response(JSON.stringify({ results: [], total: 0, searchAuditId: 'audit-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response('[]', { status: 200 })
  })
}

describe('ComplianceSearchView integration fetch (M10-S16)', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.setUser(adminUser())
    auth.updateTokens({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 })
    vi.restoreAllMocks()
  })

  it('M10-S16-B1: search button is enabled before first search', async () => {
    vi.stubGlobal('fetch', createFetchMock())

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/compliance/search',
          name: 'compliance-search',
          component: { template: '<div />' },
        },
        {
          path: '/inspections/:id',
          name: 'inspection-detail',
          component: { template: '<div />' },
        },
        {
          path: '/compliance/records/:id',
          name: 'inspection-record',
          component: { template: '<div />' },
        },
      ],
    })
    await router.push('/compliance/search')

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const wrapper = mount(ComplianceSearchView, {
      global: { plugins: [pinia, router, [VueQueryPlugin, { queryClient }]] },
    })

    await flushPromises()

    const submit = wrapper.get('[data-testid="advanced-search-submit"]')
    expect(submit.text()).toBe('Search')
    expect((submit.element as HTMLButtonElement).disabled).toBe(false)

    vi.unstubAllGlobals()
  })

  it('calls compliance search API with permit number', async () => {
    const fetchMock = createFetchMock()
    vi.stubGlobal('fetch', fetchMock)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/compliance/search',
          name: 'compliance-search',
          component: { template: '<div />' },
        },
        {
          path: '/inspections/:id',
          name: 'inspection-detail',
          component: { template: '<div />' },
        },
      ],
    })
    await router.push('/compliance/search')

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const wrapper = mount(ComplianceSearchView, {
      global: { plugins: [pinia, router, [VueQueryPlugin, { queryClient }]] },
    })

    await flushPromises()
    await wrapper.find('[data-testid="advanced-search-permit"]').setValue('P-2025-001')
    await flushPromises()
    await wrapper.find('[data-testid="advanced-search-form"]').trigger('submit.prevent')
    await flushPromises()
    await vi.waitFor(() => {
      expect(
        (fetchMock.mock.calls as unknown[][]).some((c) =>
          String(c[0]).includes('/api/admin/compliance-search'),
        ),
      ).toBe(true)
    })

    const searchCall = (fetchMock.mock.calls as unknown[][]).find((c) =>
      String(c[0]).includes('/api/admin/compliance-search'),
    )
    expect(String(searchCall?.[0])).toContain('permitNumber=P-2025-001')

    vi.unstubAllGlobals()
  })
})
