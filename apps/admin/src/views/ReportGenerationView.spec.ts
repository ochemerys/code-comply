import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createRouter, createMemoryHistory } from 'vue-router'
import type { UserDTO } from '@codecomply/validators'
import ReportGenerationView from './ReportGenerationView.vue'
import { saveAdminReportsSelection } from '../composables/adminReportsSelectionStorage'
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

const sampleInspections = [
  {
    id: 'insp-1',
    permitId: 'p1',
    permitNumber: 'BP-2024-001',
    address: '123 Main St',
    status: 'IN_PROGRESS',
    scheduledDate: iso(),
  },
]

const sampleHistory = [
  {
    id: 'rep-old',
    inspectionId: 'insp-1',
    type: 'INSPECTION',
    filename: 'inspection-report.pdf',
    storageKey: 'k1',
    hash: 'h1',
    generatedAt: iso(),
  },
]

describe('ReportGenerationView', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.setUser(adminUser())
    auth.updateTokens({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 })
    vi.restoreAllMocks()
  })

  it('loads inspections and shows report history after selection', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/inspections?')) {
        return new Response(JSON.stringify(sampleInspections), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('/reports') && !url.includes('/generate')) {
        return new Response(JSON.stringify(sampleHistory), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('[]', { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/reports', name: 'reports', component: { template: '<div />' } }],
    })
    await router.push('/reports')

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    const wrapper = mount(ReportGenerationView, {
      global: { plugins: [pinia, router, [VueQueryPlugin, { queryClient }]] },
    })

    await flushPromises()
    await vi.waitFor(() => expect(wrapper.text()).toContain('BP-2024-001'))

    await wrapper.get('[data-testid="report-generator-inspection"]').setValue('insp-1')
    await flushPromises()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="report-history-row-rep-old"]').exists()).toBe(true),
    )

    expect(wrapper.get('[data-testid="report-history-table"]').text()).toContain(
      'Inspection Report',
    )

    const desktop = wrapper.get('[data-testid="report-history-desktop"]')
    expect(desktop.classes()).toContain('hidden')
    expect(desktop.classes()).toContain('md:block')

    const mobile = wrapper.get('[data-testid="report-history-mobile"]')
    expect(mobile.classes()).toContain('md:hidden')

    const card = wrapper.get('[data-testid="report-history-card-rep-old"]')
    expect(card.text()).toContain('Inspection Report')
    expect(card.text()).toContain('inspection-report.pdf')
    expect(wrapper.find('[data-testid="report-history-card-download-rep-old"]').exists()).toBe(true)

    vi.unstubAllGlobals()
  })

  it('restores report history after remount without re-selecting inspection (M10-S15-B3)', async () => {
    saveAdminReportsSelection({
      userId: 'admin',
      inspectionId: 'insp-1',
      inspectionStatusFilter: 'IN_PROGRESS',
    })

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/inspections?')) {
        return new Response(JSON.stringify(sampleInspections), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('/reports') && !url.includes('/generate')) {
        return new Response(JSON.stringify(sampleHistory), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('[]', { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/reports', name: 'reports', component: { template: '<div />' } }],
    })
    await router.push('/reports')

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    const first = mount(ReportGenerationView, {
      global: { plugins: [pinia, router, [VueQueryPlugin, { queryClient }]] },
    })
    await flushPromises()
    await vi.waitFor(() =>
      expect(first.find('[data-testid="report-history-row-rep-old"]').exists()).toBe(true),
    )
    first.unmount()

    const second = mount(ReportGenerationView, {
      global: { plugins: [pinia, router, [VueQueryPlugin, { queryClient }]] },
    })
    await flushPromises()
    await vi.waitFor(() =>
      expect(second.find('[data-testid="report-history-row-rep-old"]').exists()).toBe(true),
    )

    expect(
      second.get('[data-testid="report-generator-inspection"]').element as HTMLSelectElement,
    ).toHaveProperty('value', 'insp-1')

    vi.unstubAllGlobals()
  })
})
