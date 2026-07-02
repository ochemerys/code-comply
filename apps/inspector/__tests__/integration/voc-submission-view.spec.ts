/**
 * Integration — VoCSubmissionView + VoCForm with mocked mutation (M10-S13).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import VoCSubmissionView from '@/views/VoCSubmissionView.vue'
import { db } from '@/lib/db/dexie'

const mutateAsync = vi.fn().mockResolvedValue({ id: 'def-1', status: 'VOC_SUBMITTED' })
const isReadOnlyAfterSync = ref(false)

vi.mock('@/composables/useVoCMutation', () => ({
  useVoCMutation: () => ({
    submitVoC: {
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

vi.mock('@/lib/db/dexie', () => ({
  db: {
    deficiencies: {
      get: vi.fn(),
      put: vi.fn(),
    },
  },
}))

const networkState = { isOnline: false }

vi.mock('@/stores/network', () => ({
  useNetworkStore: () => networkState,
}))
vi.mock('@/utils/api-error-handler', () => ({
  apiFetch: vi.fn(),
}))

import { apiFetch } from '@/utils/api-error-handler'

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { id: 'user-1' } }),
}))

describe('VoCSubmissionView integration', () => {
  let pinia: ReturnType<typeof createPinia>
  let queryClient: QueryClient

  const openDeficiency = {
    id: 'def-1',
    clientId: 'client-1',
    inspectionId: 'insp-int-1',
    createdById: 'user-1',
    description: 'Open deficiency for VoC',
    severity: 'MAJOR' as const,
    status: 'OPEN' as const,
    codeReference: { code: 'NBC', section: '9.10.1', title: 'Fire separation' },
    isStopWork: false,
    isUnsafe: false,
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
    isDirty: false,
  }

  function makeRouter() {
    return createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/inspections/:inspectionId/deficiencies/:deficiencyId/voc',
          name: 'voc-submission',
          component: VoCSubmissionView,
        },
        {
          path: '/inspections/:inspectionId/deficiencies/:deficiencyId',
          name: 'deficiency-detail',
          component: { template: '<div data-testid="stub-deficiency-detail" />' },
        },
      ],
    })
  }

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    vi.clearAllMocks()
    isReadOnlyAfterSync.value = false
    networkState.isOnline = false
    mutateAsync.mockResolvedValue({ id: 'def-1', status: 'VOC_SUBMITTED' })
    vi.mocked(db.deficiencies.get).mockResolvedValue(openDeficiency)
  })

  it('submits VoC payload and navigates to deficiency detail with success query', async () => {
    const router = makeRouter()
    const replace = vi.spyOn(router, 'replace')
    await router.push({
      name: 'voc-submission',
      params: { inspectionId: 'insp-int-1', deficiencyId: 'def-1' },
    })

    const wrapper = mount(VoCSubmissionView, {
      global: { plugins: [router, pinia, [VueQueryPlugin, { queryClient }]] },
    })
    await flushPromises()

    await wrapper.find('[data-testid="voc-title"]').setValue('Fire separation verified')
    await wrapper.find('[data-testid="voc-name"]').setValue('Jane Contractor')
    await wrapper.find('[data-testid="voc-form"]').trigger('submit.prevent')
    await flushPromises()

    expect(mutateAsync).toHaveBeenCalledTimes(1)
    const arg = mutateAsync.mock.calls[0][0]
    expect(arg.deficiencyId).toBe('def-1')
    expect(arg.payload).toMatchObject({
      name: 'Jane Contractor',
      title: 'Fire separation verified',
      method: 'WRITTEN_ASSURANCE',
    })
    expect(replace).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'deficiency-detail',
        query: { vocSubmitted: '1' },
      }),
    )
  })

  it('shows ineligible banner when deficiency is not OPEN or VOC_REJECTED', async () => {
    vi.mocked(db.deficiencies.get).mockResolvedValue({
      ...openDeficiency,
      status: 'VOC_SUBMITTED',
    })
    const router = makeRouter()
    await router.push({
      name: 'voc-submission',
      params: { inspectionId: 'insp-int-1', deficiencyId: 'def-1' },
    })
    const wrapper = mount(VoCSubmissionView, {
      global: { plugins: [router, pinia, [VueQueryPlugin, { queryClient }]] },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="voc-submission-ineligible"]').exists()).toBe(true)
  })

  it('shows read-only banner and blocks submit when inspection is finalized', async () => {
    isReadOnlyAfterSync.value = true
    const router = makeRouter()
    await router.push({
      name: 'voc-submission',
      params: { inspectionId: 'insp-int-1', deficiencyId: 'def-1' },
    })
    const wrapper = mount(VoCSubmissionView, {
      global: { plugins: [router, pinia, [VueQueryPlugin, { queryClient }]] },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="inspection-read-only-banner"]').exists()).toBe(true)
    await wrapper.find('[data-testid="voc-form"]').trigger('submit.prevent')
    await flushPromises()
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('shows submit error when mutation fails', async () => {
    mutateAsync.mockRejectedValueOnce(new Error('Server rejected VoC'))
    const router = makeRouter()
    await router.push({
      name: 'voc-submission',
      params: { inspectionId: 'insp-int-1', deficiencyId: 'def-1' },
    })
    const wrapper = mount(VoCSubmissionView, {
      global: { plugins: [router, pinia, [VueQueryPlugin, { queryClient }]] },
    })
    await flushPromises()
    await wrapper.find('[data-testid="voc-title"]').setValue('Verified')
    await wrapper.find('[data-testid="voc-name"]').setValue('Jane Contractor')
    await wrapper.find('[data-testid="voc-form"]').trigger('submit.prevent')
    await flushPromises()
    expect(wrapper.find('[data-testid="voc-submission-submit-error"]').text()).toContain(
      'Server rejected VoC',
    )
  })

  it('shows load error when deficiency is missing offline', async () => {
    vi.mocked(db.deficiencies.get).mockResolvedValue(undefined)
    const router = makeRouter()
    await router.push({
      name: 'voc-submission',
      params: { inspectionId: 'insp-int-1', deficiencyId: 'def-missing' },
    })
    const wrapper = mount(VoCSubmissionView, {
      global: { plugins: [router, pinia, [VueQueryPlugin, { queryClient }]] },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="voc-submission-load-error"]').text()).toMatch(/not found/i)
  })

  it('allows submission when deficiency status is VOC_REJECTED', async () => {
    vi.mocked(db.deficiencies.get).mockResolvedValue({
      ...openDeficiency,
      status: 'VOC_REJECTED',
    })
    const router = makeRouter()
    await router.push({
      name: 'voc-submission',
      params: { inspectionId: 'insp-int-1', deficiencyId: 'def-1' },
    })
    const wrapper = mount(VoCSubmissionView, {
      global: { plugins: [router, pinia, [VueQueryPlugin, { queryClient }]] },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="voc-submission-ineligible"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="voc-submit"]').attributes('disabled')).toBeUndefined()
  })

  it('loads deficiency from API when online', async () => {
    networkState.isOnline = true
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: 'def-1',
        clientId: 'client-1',
        inspectionId: 'insp-int-1',
        description: 'API deficiency',
        severity: 'MAJOR',
        status: 'OPEN',
        codeReference: { code: 'NBC', section: '9.10.1', title: 'Fire separation' },
        isStopWork: false,
        isUnsafe: false,
        createdAt: '2026-05-01T10:00:00.000Z',
        updatedAt: '2026-05-01T10:00:00.000Z',
      }),
    } as unknown as Response)
    const router = makeRouter()
    await router.push({
      name: 'voc-submission',
      params: { inspectionId: 'insp-int-1', deficiencyId: 'def-1' },
    })
    const wrapper = mount(VoCSubmissionView, {
      global: { plugins: [router, pinia, [VueQueryPlugin, { queryClient }]] },
    })
    await flushPromises()
    expect(apiFetch).toHaveBeenCalled()
    expect(wrapper.find('[data-testid="voc-form"]').exists()).toBe(true)
  })
})
