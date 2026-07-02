/**
 * Integration — checklist template cache with ChecklistExecutionView (M5-S15).
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import ChecklistExecutionView from '@/views/ChecklistExecutionView.vue'
import { useOfflineChecklists } from '@/composables/useOfflineChecklists'
import { db } from '@/lib/db/dexie'
import { apiFetch } from '@/utils/api-error-handler'
import {
  buildFixtureTemplateCacheRow,
  FIXTURE_TEMPLATE_ID,
  FIXTURE_VERSION_HASH,
} from '@/lib/db/__fixtures__/checklist-template-fixtures'
import { persistDefaultChecklistTemplateRef } from '@/lib/db/checklist-template-prefetch'

vi.mock('@/utils/api-error-handler', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('@/components/layout/AppHeader.vue', () => ({
  default: { name: 'AppHeader', template: '<header data-testid="mock-header" />' },
}))

describe('offline checklist templates (integration)', () => {
  let queryClient: QueryClient

  beforeEach(async () => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    await db.checklistTemplateCache.clear()
    await db.checklistResponses.clear()
    vi.mocked(apiFetch).mockImplementation(async (url: string | URL | Request) => {
      const s = typeof url === 'string' ? url : url.toString()
      if (s.includes('/deficiencies')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (s.includes('/checklists/executions/') || s.includes('/checklists/templates/')) {
        return new Response(null, { status: 404 })
      }
      return new Response(null, { status: 404 })
    })
  })

  afterEach(async () => {
    await db.checklistTemplateCache.clear()
    await db.checklistResponses.clear()
  })

  it('ChecklistExecutionView uses cached template from IndexedDB when present', async () => {
    const row = buildFixtureTemplateCacheRow()
    row.items[0]!.text = 'Served from IndexedDB template cache'
    await db.checklistTemplateCache.put(row)
    persistDefaultChecklistTemplateRef({
      templateId: FIXTURE_TEMPLATE_ID,
      versionHash: FIXTURE_VERSION_HASH,
    })

    const { getCachedTemplate } = useOfflineChecklists()
    const preRead = await getCachedTemplate(FIXTURE_TEMPLATE_ID, FIXTURE_VERSION_HASH)
    expect(preRead?.items[0]?.text).toBe('Served from IndexedDB template cache')

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
      params: { inspectionId: 'insp-x', executionId: 'local-insp-x' },
    })

    const wrapper = mount(ChecklistExecutionView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-testid="checklist-item-item-1"]').text()).toContain(
          'Served from IndexedDB template cache',
        )
      },
      { timeout: 6000 },
    )
    wrapper.unmount()
  })
})
