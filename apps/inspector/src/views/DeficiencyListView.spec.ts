/**
 * DeficiencyListView — unit tests with mocked deficiencies query (M6-S8).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import DeficiencyListView from './DeficiencyListView.vue'
import type { LocalDeficiency } from '@/lib/db/types'

const deficiencies = ref<LocalDeficiency[]>([])
const isLoading = ref(false)
const error = ref<Error | null>(null)
const refresh = vi.fn()
const isReadOnlyAfterSync = ref(false)

vi.mock('@/composables/useDeficiencies', () => ({
  useDeficiencies: () => ({
    deficiencies: computed(() => deficiencies.value),
    openCount: computed(() => 0),
    criticalCount: computed(() => 0),
    isLoading,
    error,
    refresh,
    filterByStatus: () => [],
    filterBySeverity: () => [],
  }),
}))

vi.mock('@/composables/useInspectionReadOnly', () => ({
  useInspectionReadOnly: () => ({
    inspection: ref(null),
    isReadOnlyAfterSync,
  }),
}))

vi.mock('@/components/layout/AppHeader.vue', () => ({
  default: { name: 'AppHeader', template: '<header data-testid="app-header-stub" />' },
}))

function baseRow(
  id: string,
  status: LocalDeficiency['status'],
  severity: LocalDeficiency['severity'],
) {
  return {
    id,
    clientId: `c-${id}`,
    inspectionId: 'insp-1',
    createdById: 'u1',
    description: `Description for ${id}`,
    severity,
    status,
    isStopWork: false,
    isUnsafe: false,
    createdAt: '2026-04-01T12:00:00.000Z',
    updatedAt: '2026-04-01T12:00:00.000Z',
    isDirty: false,
  } satisfies LocalDeficiency
}

describe('DeficiencyListView', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    deficiencies.value = []
    isLoading.value = false
    error.value = null
    isReadOnlyAfterSync.value = false
    vi.clearAllMocks()
  })

  it('shows empty state when there are no deficiencies', async () => {
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        {
          path: '/inspections/:inspectionId/deficiencies',
          name: 'deficiency-list',
          component: DeficiencyListView,
        },
        {
          path: '/inspections/:inspectionId/deficiencies/:deficiencyId',
          name: 'deficiency-detail',
          component: { template: '<div />' },
        },
      ],
    })
    await router.push({ name: 'deficiency-list', params: { inspectionId: 'insp-1' } })
    await router.isReady()
    const wrapper = mount(DeficiencyListView, {
      global: { plugins: [router, pinia] },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="deficiency-list-empty"]').exists()).toBe(true)
  })

  it('disables Add deficiency when inspection is read-only after sync (M8-S10)', async () => {
    isReadOnlyAfterSync.value = true
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        {
          path: '/inspections/:inspectionId/deficiencies',
          name: 'deficiency-list',
          component: DeficiencyListView,
        },
        {
          path: '/inspections/:inspectionId/deficiencies/:deficiencyId',
          name: 'deficiency-detail',
          component: { template: '<div />' },
        },
      ],
    })
    await router.push({ name: 'deficiency-list', params: { inspectionId: 'insp-1' } })
    await router.isReady()
    const wrapper = mount(DeficiencyListView, {
      global: { plugins: [router, pinia] },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="inspection-read-only-banner"]').exists()).toBe(true)
    const btn = wrapper.find('[data-testid="deficiency-list-add"]').element as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('renders a card per deficiency and filters by status', async () => {
    deficiencies.value = [baseRow('a', 'OPEN', 'MINOR'), baseRow('b', 'CLOSED', 'MINOR')]
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        {
          path: '/inspections/:inspectionId/deficiencies',
          name: 'deficiency-list',
          component: DeficiencyListView,
        },
        {
          path: '/inspections/:inspectionId/deficiencies/:deficiencyId',
          name: 'deficiency-detail',
          component: { template: '<div />' },
        },
      ],
    })
    await router.push({ name: 'deficiency-list', params: { inspectionId: 'insp-1' } })
    await router.isReady()
    const wrapper = mount(DeficiencyListView, {
      global: { plugins: [router, pinia] },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="deficiency-list"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="deficiency-card-a"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="deficiency-card-b"]').exists()).toBe(true)

    const statusSel = wrapper.find('[data-testid="deficiency-filter-status"]')
      .element as HTMLSelectElement
    statusSel.value = 'OPEN'
    await wrapper.find('[data-testid="deficiency-filter-status"]').trigger('change')
    await flushPromises()
    expect(wrapper.find('[data-testid="deficiency-card-a"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="deficiency-card-b"]').exists()).toBe(false)
  })

  it('shows loading state', async () => {
    isLoading.value = true
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        {
          path: '/inspections/:inspectionId/deficiencies',
          name: 'deficiency-list',
          component: DeficiencyListView,
        },
        {
          path: '/inspections/:inspectionId/deficiencies/:deficiencyId',
          name: 'deficiency-detail',
          component: { template: '<div />' },
        },
      ],
    })
    await router.push({ name: 'deficiency-list', params: { inspectionId: 'insp-1' } })
    await router.isReady()
    const wrapper = mount(DeficiencyListView, {
      global: { plugins: [router, pinia] },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="deficiency-list-loading"]').exists()).toBe(true)
  })

  it('shows error with retry', async () => {
    isLoading.value = false
    error.value = new Error('Network down')
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        {
          path: '/inspections/:inspectionId/deficiencies',
          name: 'deficiency-list',
          component: DeficiencyListView,
        },
        {
          path: '/inspections/:inspectionId/deficiencies/:deficiencyId',
          name: 'deficiency-detail',
          component: { template: '<div />' },
        },
      ],
    })
    await router.push({ name: 'deficiency-list', params: { inspectionId: 'insp-1' } })
    const wrapper = mount(DeficiencyListView, {
      global: { plugins: [router, pinia] },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="deficiency-list-error"]').text()).toContain('Network down')
    await wrapper.find('[data-testid="deficiency-list-retry"]').trigger('click')
    expect(refresh).toHaveBeenCalled()
  })

  it('M6-S14 filters list when checklistItemId query is set', async () => {
    deficiencies.value = [
      { ...baseRow('a', 'OPEN', 'MINOR'), checklistItemId: 'chk-1' },
      { ...baseRow('b', 'OPEN', 'MINOR'), checklistItemId: 'chk-2' },
    ]
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        {
          path: '/inspections/:inspectionId/deficiencies',
          name: 'deficiency-list',
          component: DeficiencyListView,
        },
        {
          path: '/inspections/:inspectionId/deficiencies/:deficiencyId',
          name: 'deficiency-detail',
          component: { template: '<div />' },
        },
      ],
    })
    await router.push({
      name: 'deficiency-list',
      params: { inspectionId: 'insp-1' },
      query: { checklistItemId: 'chk-1' },
    })
    await router.isReady()
    const wrapper = mount(DeficiencyListView, {
      global: { plugins: [router, pinia] },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="deficiency-list-checklist-filter-banner"]').exists()).toBe(
      true,
    )
    expect(wrapper.find('[data-testid="deficiency-card-a"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="deficiency-card-b"]').exists()).toBe(false)
  })

  it('M6-S14 clears checklist item filter when Show all is used', async () => {
    deficiencies.value = [
      { ...baseRow('a', 'OPEN', 'MINOR'), checklistItemId: 'chk-1' },
      { ...baseRow('b', 'OPEN', 'MINOR'), checklistItemId: 'chk-2' },
    ]
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        {
          path: '/inspections/:inspectionId/deficiencies',
          name: 'deficiency-list',
          component: DeficiencyListView,
        },
        {
          path: '/inspections/:inspectionId/deficiencies/:deficiencyId',
          name: 'deficiency-detail',
          component: { template: '<div />' },
        },
      ],
    })
    await router.push({
      name: 'deficiency-list',
      params: { inspectionId: 'insp-1' },
      query: { checklistItemId: 'chk-1' },
    })
    await router.isReady()
    const wrapper = mount(DeficiencyListView, {
      global: { plugins: [router, pinia] },
    })
    await flushPromises()
    await wrapper.find('[data-testid="deficiency-list-clear-checklist-filter"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.checklistItemId).toBeUndefined()
    expect(wrapper.find('[data-testid="deficiency-list-checklist-filter-banner"]').exists()).toBe(
      false,
    )
    expect(wrapper.find('[data-testid="deficiency-card-a"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="deficiency-card-b"]').exists()).toBe(true)
  })
})
