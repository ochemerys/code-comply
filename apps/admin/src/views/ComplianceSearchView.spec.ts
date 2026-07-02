import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
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

const sampleSearchResponse = {
  results: [
    {
      inspectionId: 'insp-1',
      permitNumber: 'P-2025-001',
      legalLandDescription: 'Plan 1234AB Block 5',
      address: '123 Main St',
      status: 'PASSED',
      scheduledDate: iso(),
      inspectorName: 'Alice',
      deficiencyCount: 2,
    },
  ],
  total: 1,
  searchAuditId: 'audit-search-1',
}

vi.mock('../composables/useAdminComplianceSearch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../composables/useAdminComplianceSearch')>()
  return {
    ...actual,
    useAdminInspectorsForSearch: () => ({
      data: ref([{ id: 'u1', name: 'Alice' }]),
      isPending: ref(false),
    }),
    useComplianceSearch: () => ({
      data: ref(sampleSearchResponse),
      isPending: ref(false),
      isFetching: ref(false),
      error: ref(null),
      refetch: vi.fn(),
    }),
  }
})

describe('ComplianceSearchView (M10-S16)', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.setUser(adminUser())
    auth.updateTokens({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 })
    vi.restoreAllMocks()
  })

  it('shows search fields and results after search', async () => {
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
        {
          path: '/compliance/deficiencies',
          name: 'deficiencies',
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

    expect(wrapper.find('[data-testid="advanced-search-legal-land"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="compliance-search-prompt"]').exists()).toBe(true)

    await wrapper.find('[data-testid="advanced-search-form"]').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.find('[data-testid="compliance-search-table"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="compliance-search-export"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('P-2025-001')
    expect(wrapper.text()).toContain('Search logged')

    const desktop = wrapper.get('[data-testid="compliance-search-desktop"]')
    expect(desktop.classes()).toContain('hidden')
    expect(desktop.classes()).toContain('md:block')

    const mobile = wrapper.get('[data-testid="compliance-search-mobile"]')
    expect(mobile.classes()).toContain('md:hidden')

    const card = wrapper.get('[data-testid="compliance-search-card-insp-1"]')
    expect(card.text()).toContain('P-2025-001')
    expect(card.text()).toContain('123 Main St')
    expect(card.text()).toContain('PASSED')
    expect(wrapper.find('[data-testid="compliance-search-card-workflow-insp-1"]').exists()).toBe(
      true,
    )
  })
})
