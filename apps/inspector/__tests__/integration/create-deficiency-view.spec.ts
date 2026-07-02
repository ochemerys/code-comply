/**
 * Integration — CreateDeficiencyView + DeficiencyForm with mocked mutation (M6-S7, M6-S18 checklist deep-link).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import CreateDeficiencyView from '@/views/CreateDeficiencyView.vue'

const mutateAsync = vi.fn().mockResolvedValue({ id: 'def-new' })
const isReadOnlyAfterSync = ref(false)

vi.mock('@/composables/useDeficiencyMutation', () => ({
  useDeficiencyMutation: () => ({
    createDeficiency: {
      mutateAsync,
      isPending: ref(false),
    },
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

describe('CreateDeficiencyView integration', () => {
  let pinia: ReturnType<typeof createPinia>
  let queryClient: QueryClient

  function createTestQueryClient() {
    return new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
  }

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    queryClient = createTestQueryClient()
    vi.clearAllMocks()
    mutateAsync.mockResolvedValue({ id: 'def-new' })
    isReadOnlyAfterSync.value = false
  })

  it('submits create payload with generated clientId and navigates to deficiency list (workflow §2 step 8)', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/inspections/:inspectionId/deficiencies/new',
          name: 'create-deficiency',
          component: CreateDeficiencyView,
        },
        {
          path: '/inspections/:inspectionId/deficiencies',
          name: 'deficiency-list',
          component: { template: '<div data-testid="stub-deficiency-list" />' },
        },
        { path: '/', name: 'home', component: { template: '<div />' } },
      ],
    })
    const replace = vi.spyOn(router, 'replace')
    await router.push({
      name: 'create-deficiency',
      params: { inspectionId: 'insp-int-1' },
      query: { checklistItemId: 'chk-1' },
    })

    const wrapper = mount(CreateDeficiencyView, {
      global: { plugins: [router, pinia, [VueQueryPlugin, { queryClient }]] },
    })
    await flushPromises()

    await wrapper
      .find('[data-testid="deficiency-description"]')
      .setValue('Emergency lighting failed operational test in east corridor area.')
    await wrapper.find('input[type="radio"][value="MAJOR"]').setValue(true)
    await wrapper.find('[data-testid="deficiency-form"]').trigger('submit.prevent')
    await flushPromises()

    expect(mutateAsync).toHaveBeenCalledTimes(1)
    const arg = mutateAsync.mock.calls[0][0]
    expect(arg.clientId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(arg).toMatchObject({
      inspectionId: 'insp-int-1',
      checklistItemId: 'chk-1',
      severity: 'MAJOR',
    })
    expect(arg.description.length).toBeGreaterThanOrEqual(10)
    expect(replace).toHaveBeenCalledWith({
      name: 'deficiency-list',
      params: { inspectionId: 'insp-int-1' },
      query: { checklistItemId: 'chk-1' },
    })
  })

  it('pre-fills code reference from refCode/refSection/refTitle query (M6-S13)', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/inspections/:inspectionId/deficiencies/new',
          name: 'create-deficiency',
          component: CreateDeficiencyView,
        },
      ],
    })
    await router.push({
      name: 'create-deficiency',
      params: { inspectionId: 'insp-q' },
      query: { refCode: 'NBC', refSection: '9.10.1', refTitle: 'Fire separation' },
    })
    const wrapper = mount(CreateDeficiencyView, {
      global: { plugins: [router, pinia, [VueQueryPlugin, { queryClient }]] },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="deficiency-code-summary"]').text()).toContain('NBC')
    expect(wrapper.find('[data-testid="deficiency-code-summary"]').text()).toContain('9.10.1')
  })

  it('shows error when mutation fails', async () => {
    mutateAsync.mockRejectedValueOnce(new Error('Network down'))

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/inspections/:inspectionId/deficiencies/new',
          name: 'create-deficiency',
          component: CreateDeficiencyView,
        },
      ],
    })
    await router.push({ name: 'create-deficiency', params: { inspectionId: 'insp-x' } })

    const piniaErr = createPinia()
    setActivePinia(piniaErr)

    const wrapper = mount(CreateDeficiencyView, {
      global: { plugins: [router, piniaErr, [VueQueryPlugin, { queryClient }]] },
    })
    await flushPromises()

    await wrapper
      .find('[data-testid="deficiency-description"]')
      .setValue('Portable heater used within egress corridor without approval process.')
    await wrapper.find('[data-testid="deficiency-form"]').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.find('[data-testid="create-deficiency-submit-error"]').text()).toContain(
      'Network down',
    )
  })
})
