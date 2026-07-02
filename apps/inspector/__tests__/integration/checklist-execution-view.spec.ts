/**
 * Integration — ChecklistExecutionView with useChecklist and local persistence (M5-S8)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import ChecklistExecutionView from '@/views/ChecklistExecutionView.vue'
import { apiFetch } from '@/utils/api-error-handler'

vi.mock('@/utils/api-error-handler', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('@/components/layout/AppHeader.vue', () => ({
  default: { name: 'AppHeader', template: '<header />' },
}))

describe('ChecklistExecutionView integration', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    setActivePinia(createPinia())
    localStorage.clear()
    sessionStorage.clear()
    vi.mocked(apiFetch).mockImplementation(async (url: string | URL | Request) => {
      const s = typeof url === 'string' ? url : url.toString()
      if (s.includes('/deficiencies')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(null, { status: 404 })
    })
  })

  it('restores scroll position from sessionStorage on mount', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/inspections/:inspectionId/checklist/:executionId',
          name: 'checklist-execution',
          component: ChecklistExecutionView,
        },
      ],
    })
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId: 'insp-1', executionId: 'exec-scroll' },
    })
    sessionStorage.setItem('checklist-execution-scroll-exec-scroll', '120')

    const wrapper = mount(ChecklistExecutionView, {
      global: { plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]] },
    })
    await flushPromises()
    const region = wrapper.find('[data-testid="checklist-scroll-region"]').element as HTMLElement
    await vi.waitFor(
      () => {
        expect(region.scrollTop).toBe(120)
      },
      { timeout: 3000 },
    )
  })

  it('shows offline hint in footer when navigator is offline', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/inspections/:inspectionId/checklist/:executionId',
          name: 'checklist-execution',
          component: ChecklistExecutionView,
        },
      ],
    })
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId: 'insp-1', executionId: 'exec-off' },
    })

    vi.stubGlobal('navigator', { ...navigator, onLine: false })

    const wrapper = mount(ChecklistExecutionView, {
      global: { plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]] },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="checklist-save-status"]').text()).toContain('Offline')

    vi.unstubAllGlobals()
  })
})
