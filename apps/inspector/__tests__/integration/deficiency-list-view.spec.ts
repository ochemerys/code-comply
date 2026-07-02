/**
 * Integration — DeficiencyListView + filters + cards with mocked useDeficiencies (M6-S8).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import DeficiencyListView from '@/views/DeficiencyListView.vue'
import type { LocalDeficiency } from '@/lib/db/types'

const deficiencies = ref<LocalDeficiency[]>([])
const isReadOnlyAfterSync = ref(false)

vi.mock('@/composables/useDeficiencies', () => ({
  useDeficiencies: () => ({
    deficiencies: computed(() => deficiencies.value),
    openCount: computed(() => deficiencies.value.filter((d) => d.status === 'OPEN').length),
    criticalCount: computed(
      () => deficiencies.value.filter((d) => d.severity === 'CRITICAL').length,
    ),
    isLoading: ref(false),
    error: ref(null),
    refresh: vi.fn(),
    filterByStatus: (s: LocalDeficiency['status']) =>
      deficiencies.value.filter((d) => d.status === s),
    filterBySeverity: (s: LocalDeficiency['severity']) =>
      deficiencies.value.filter((d) => d.severity === s),
  }),
}))

vi.mock('@/components/layout/AppHeader.vue', () => ({
  default: { name: 'AppHeader', template: '<header data-testid="app-header-stub" />' },
}))

vi.mock('@/composables/useInspectionReadOnly', () => ({
  useInspectionReadOnly: () => ({
    inspection: ref(null),
    isReadOnlyAfterSync,
  }),
}))

describe('DeficiencyListView integration', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    isReadOnlyAfterSync.value = false
    deficiencies.value = [
      {
        id: 'd1',
        clientId: 'c1',
        inspectionId: 'insp-x',
        createdById: 'u1',
        description: 'First issue on site with enough text',
        location: 'Roof',
        severity: 'MAJOR',
        status: 'OPEN',
        isStopWork: false,
        isUnsafe: false,
        createdAt: '2026-04-02T10:00:00.000Z',
        updatedAt: '2026-04-02T10:00:00.000Z',
        isDirty: false,
      },
      {
        id: 'd2',
        clientId: 'c2',
        inspectionId: 'insp-x',
        createdById: 'u1',
        description: 'Second issue',
        severity: 'CRITICAL',
        status: 'OPEN',
        isStopWork: true,
        isUnsafe: true,
        createdAt: '2026-04-03T10:00:00.000Z',
        updatedAt: '2026-04-03T10:00:00.000Z',
        isDirty: false,
      },
    ]
  })

  it('filters list by severity and shows stop work on card', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
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
    await router.push({ name: 'deficiency-list', params: { inspectionId: 'insp-x' } })
    const wrapper = mount(DeficiencyListView, {
      global: { plugins: [router, pinia] },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="deficiency-card-d1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="deficiency-card-d2"]').exists()).toBe(true)

    const sev = wrapper.find('[data-testid="deficiency-filter-severity"]')
      .element as HTMLSelectElement
    sev.value = 'MAJOR'
    await wrapper.find('[data-testid="deficiency-filter-severity"]').trigger('change')
    await flushPromises()

    expect(wrapper.find('[data-testid="deficiency-card-d1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="deficiency-card-d2"]').exists()).toBe(false)

    sev.value = 'all'
    await wrapper.find('[data-testid="deficiency-filter-severity"]').trigger('change')
    await flushPromises()
    expect(
      wrapper
        .find('[data-testid="deficiency-card-d2"] [data-testid="deficiency-card-stop-work"]')
        .exists(),
    ).toBe(true)
    expect(
      wrapper
        .find('[data-testid="deficiency-card-d2"] [data-testid="deficiency-card-unsafe"]')
        .exists(),
    ).toBe(true)
  })

  it('navigates to create deficiency from Add button', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/inspections/:inspectionId/deficiencies',
          name: 'deficiency-list',
          component: DeficiencyListView,
        },
        {
          path: '/inspections/:inspectionId/deficiencies/new',
          name: 'create-deficiency',
          component: { template: '<div data-testid="create-stub" />' },
        },
        {
          path: '/inspections/:inspectionId/deficiencies/:deficiencyId',
          name: 'deficiency-detail',
          component: { template: '<div />' },
        },
      ],
    })
    const push = vi.spyOn(router, 'push')
    await router.push({ name: 'deficiency-list', params: { inspectionId: 'insp-x' } })
    const wrapper = mount(DeficiencyListView, {
      global: { plugins: [router, pinia] },
    })
    await flushPromises()
    await wrapper.find('[data-testid="deficiency-list-add"]').trigger('click')
    expect(push).toHaveBeenCalledWith({
      name: 'create-deficiency',
      params: { inspectionId: 'insp-x' },
    })
  })
})
