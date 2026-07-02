import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import DeficiencyListView from './DeficiencyListView.vue'

const deficiencyRows = ref<unknown[]>([])

vi.mock('../composables/useAdminDeficiencies', () => ({
  EMPTY_DEFICIENCY_FILTERS: {
    inspectionId: '',
    status: '',
    severity: '',
    permitNumber: '',
    dueDateFrom: '',
    dueDateTo: '',
  },
  deficiencyStatusLabel: (s: string) => s,
  isSessionExpiredRedirectError: () => false,
  useAdminInspectionsForDeficiencies: () => ({ data: ref([]) }),
  useAdminDeficienciesList: () => ({
    data: deficiencyRows,
    isPending: ref(false),
    isFetching: ref(false),
    error: ref(null),
    refetch: vi.fn(),
  }),
}))

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/compliance/deficiencies', name: 'deficiencies', component: DeficiencyListView },
      {
        path: '/compliance/deficiencies/new',
        name: 'deficiency-create',
        component: { template: '<div />' },
      },
      {
        path: '/compliance/deficiencies/:id',
        name: 'deficiency-detail',
        component: { template: '<div />' },
      },
      {
        path: '/compliance/records/:id',
        name: 'inspection-record',
        component: { template: '<div />' },
      },
    ],
  })
}

describe('DeficiencyListView', () => {
  it('renders list shell and create action', async () => {
    deficiencyRows.value = []
    const router = makeRouter()
    await router.push('/compliance/deficiencies')

    const wrapper = mount(DeficiencyListView, {
      global: {
        plugins: [router, [VueQueryPlugin, { queryClient: new QueryClient() }]],
      },
    })

    expect(wrapper.find('[data-testid="deficiency-list-view"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="deficiency-list-create"]').exists()).toBe(true)
  })

  it('renders both desktop table and mobile card layouts', async () => {
    deficiencyRows.value = [
      {
        id: 'def-1',
        description: 'Missing smoke detector',
        inspectionId: 'insp-1',
        severity: 'MAJOR',
        status: 'OPEN',
        dueDate: '2026-06-01T00:00:00.000Z',
      },
    ]
    const router = makeRouter()
    await router.push('/compliance/deficiencies')

    const wrapper = mount(DeficiencyListView, {
      global: {
        plugins: [router, [VueQueryPlugin, { queryClient: new QueryClient() }]],
      },
    })

    const desktop = wrapper.get('[data-testid="deficiency-list-desktop"]')
    expect(desktop.classes()).toContain('hidden')
    expect(desktop.classes()).toContain('md:block')
    expect(wrapper.find('[data-testid="deficiency-row-def-1"]').exists()).toBe(true)

    const mobile = wrapper.get('[data-testid="deficiency-list-mobile"]')
    expect(mobile.classes()).toContain('md:hidden')

    const card = wrapper.get('[data-testid="deficiency-card-def-1"]')
    expect(card.text()).toContain('Missing smoke detector')
    expect(card.text()).toContain('MAJOR')
    expect(card.text()).toContain('OPEN')
  })
})
