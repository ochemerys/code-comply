import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import InspectionMonitorView from './InspectionMonitorView.vue'

const monitorPayload = {
  generatedAt: new Date().toISOString(),
  inspections: [
    {
      id: 'insp-2001',
      permitId: 'P-24010',
      status: 'IN_PROGRESS' as const,
      inspectorName: 'Alex Inspector',
      syncStatus: 'SYNCING' as const,
      pendingSubmission: false,
      stopWorkAlert: false,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'insp-2002',
      permitId: 'P-24011',
      status: 'PENDING_SUBMISSION' as const,
      inspectorName: 'Sam SCO',
      syncStatus: 'OFFLINE' as const,
      pendingSubmission: true,
      stopWorkAlert: true,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'insp-2003',
      permitId: 'P-24012',
      status: 'REVIEW' as const,
      inspectorName: 'Jordan Admin',
      syncStatus: 'SYNCED' as const,
      pendingSubmission: false,
      stopWorkAlert: false,
      updatedAt: new Date().toISOString(),
    },
  ],
}

vi.mock('../composables/useInspectionMonitor', () => ({
  useInspectionMonitor: () => ({
    data: ref(monitorPayload),
    isLoading: ref(false),
    isFetching: ref(false),
    refetch: vi.fn(),
  }),
  INSPECTION_MONITOR_REFETCH_MS: 30_000,
}))

vi.mock('../composables/useAdminOrders', () => ({
  useAdminOrders: () => ({
    data: ref([]),
    isPending: ref(false),
  }),
}))

describe('InspectionMonitorView', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('renders dashboard, loads data, and filters by status', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const wrapper = mount(InspectionMonitorView, {
      global: {
        plugins: [pinia, [VueQueryPlugin, { queryClient }]],
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    })

    await flushPromises()

    expect(wrapper.find('[data-testid="inspection-status"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid^="inspection-status-row-"]').length).toBeGreaterThan(1)

    await wrapper
      .get('[data-testid="inspection-monitor-filter-select"]')
      .setValue('PENDING_SUBMISSION')
    await flushPromises()

    const rows = wrapper.findAll('[data-testid^="inspection-status-row-"]')
    expect(rows.length).toBe(1)
    expect(wrapper.text()).toContain('Pending submission')
  })
})
