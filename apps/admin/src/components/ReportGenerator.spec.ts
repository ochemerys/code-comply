import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import type { UserDTO } from '@codecomply/validators'
import ReportGenerator from './ReportGenerator.vue'
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

const inspections = [
  {
    id: 'insp-1',
    permitNumber: 'BP-2024-001',
    address: '123 Main St',
    status: 'IN_PROGRESS',
  },
]

describe('ReportGenerator', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.setUser(adminUser())
    auth.updateTokens({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 })
    vi.restoreAllMocks()
  })

  it('renders report type options', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    const wrapper = mount(ReportGenerator, {
      props: {
        inspections,
        inspectionStatusFilter: 'IN_PROGRESS',
      },
      global: { plugins: [pinia, [VueQueryPlugin, { queryClient }]] },
    })

    const typeSelect = wrapper.get('[data-testid="report-generator-type"]')
    expect(typeSelect.text()).toContain('Inspection Report')
    expect(typeSelect.text()).toContain('Deficiency Report')
    expect(typeSelect.text()).toContain('No Entry Letter')
  })

  it('generates inspection report and shows download link', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/generate') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            id: 'rep-1',
            inspectionId: 'insp-1',
            type: 'INSPECTION',
            filename: 'inspection-report.pdf',
            storageKey: 'k',
            hash: 'abc',
            generatedAt: iso(),
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.includes('/download')) {
        return new Response(
          JSON.stringify({ url: 'https://signed.example/report.pdf', expiresIn: 3600 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response('[]', { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    const wrapper = mount(ReportGenerator, {
      props: {
        inspections,
        inspectionStatusFilter: 'IN_PROGRESS',
      },
      global: { plugins: [pinia, [VueQueryPlugin, { queryClient }]] },
    })

    await wrapper.get('[data-testid="report-generator-inspection"]').setValue('insp-1')
    await wrapper.get('[data-testid="report-generator-submit"]').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalled()
    const generateCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/generate'))
    expect(generateCall).toBeDefined()
    expect(JSON.parse(String((generateCall![1] as RequestInit).body))).toEqual({
      inspectionId: 'insp-1',
      type: 'INSPECTION',
    })

    expect(wrapper.find('[data-testid="report-generator-download-link"]').exists()).toBe(true)

    vi.unstubAllGlobals()
  })

  it('requires a stop-work deficiency before generating stop work PDF', async () => {
    const wrapper = mount(ReportGenerator, {
      props: {
        inspections,
        inspectionStatusFilter: 'IN_PROGRESS',
      },
      global: {
        plugins: [
          pinia,
          [
            VueQueryPlugin,
            { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          ],
        ],
      },
    })

    await wrapper.get('[data-testid="report-generator-inspection"]').setValue('insp-1')
    await wrapper.get('[data-testid="report-generator-type"]').setValue('STOP_WORK')

    expect(
      wrapper.get('[data-testid="report-generator-submit"]').attributes('disabled'),
    ).toBeDefined()
  })
})
