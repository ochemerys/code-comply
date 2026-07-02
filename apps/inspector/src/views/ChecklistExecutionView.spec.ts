/**
 * Unit tests — ChecklistExecutionView (M5-S8)
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import type { VueWrapper } from '@vue/test-utils'
import ChecklistExecutionView from './ChecklistExecutionView.vue'
import { CODE_REFERENCE_LIBRARY_KEY } from '@/composables/useCodeReference'
import { checklistResponseRowId, persistChecklistExecutionState } from '@/lib/db/checklist-storage'
import { db } from '@/lib/db/dexie'
import { putOfflinePhoto } from '@/lib/db/photo-storage'
import { buildEmbeddedPhotoMetadata, toPhotoMetadata } from '@/lib/photo/metadata'
import type { LocalInspection, LocalPhoto } from '@/lib/db/types'
import { apiFetch } from '@/utils/api-error-handler'
import {
  buildFixtureChecklistTemplateDto,
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

vi.mock('@/components/PhotoGallery.vue', () => ({
  default: defineComponent({
    name: 'PhotoGalleryStub',
    props: {
      inspectionId: { type: String, required: true },
      checklistItemId: { type: String, default: undefined },
      captureReturnRoute: { type: String, default: undefined },
    },
    emits: ['photos-updated'],
    template:
      '<button type="button" data-testid="photo-gallery-stub" @click="$emit(\'photos-updated\')">sync</button>',
  }),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function createRouterForChecklist() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/capture-photo',
        name: 'capture-photo',
        component: { template: '<div data-testid="stub-capture-photo" />' },
      },
      {
        path: '/permits/:id',
        name: 'permit-detail',
        component: { template: '<div data-testid="stub-permit-detail" />' },
      },
      {
        path: '/inspections/:inspectionId/checklist/:executionId',
        name: 'checklist-execution',
        component: ChecklistExecutionView,
      },
      {
        path: '/inspections/:inspectionId/deficiencies/new',
        name: 'create-deficiency',
        component: { template: '<div data-testid="stub-create-deficiency" />' },
      },
      {
        path: '/inspections/:inspectionId/deficiencies',
        name: 'deficiency-list',
        component: { template: '<div data-testid="stub-deficiency-list" />' },
      },
      {
        path: '/permits',
        name: 'permits',
        component: { template: '<div data-testid="stub-permits" />' },
      },
    ],
  })
}

/** Async mount sets `execution` after template resolve; debounced persist shows "Saved". */
async function waitForChecklistReady(wrapper: VueWrapper) {
  await flushPromises()
  await vi.waitFor(
    () => {
      expect(wrapper.find('[data-testid="checklist-save-status"]').text()).toContain('Saved')
    },
    { timeout: 4500 },
  )
  await flushPromises()
}

describe('ChecklistExecutionView', { timeout: 15_000 }, () => {
  let queryClient: QueryClient

  beforeEach(async () => {
    queryClient = createTestQueryClient()
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    // The test setup intentionally doesn't wipe the IndexedDB between test files/suites.
    // Clear everything here to avoid stale responses affecting unanswered/failed filters.
    await db.clearAllData()
    await db.checklistTemplateCache.put(buildFixtureTemplateCacheRow())
    persistDefaultChecklistTemplateRef({
      templateId: FIXTURE_TEMPLATE_ID,
      versionHash: FIXTURE_VERSION_HASH,
    })
    vi.mocked(apiFetch).mockImplementation(async (url: string | URL | Request) => {
      const s = typeof url === 'string' ? url : url.toString()
      if (s.includes('/deficiencies')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (s.includes('/checklists/executions/') && !s.includes('/responses')) {
        const id = decodeURIComponent(s.split('/checklists/executions/')[1]?.split(/[?/]/)[0] ?? '')
        if (id) {
          return new Response(
            JSON.stringify({
              id,
              inspectionId: 'insp-1',
              templateId: FIXTURE_TEMPLATE_ID,
              versionHash: FIXTURE_VERSION_HASH,
              responses: [],
              progress: 0,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }
        return new Response(null, { status: 404 })
      }
      if (s.includes('/checklists/templates/')) {
        const templateId = decodeURIComponent(
          s.split('/checklists/templates/')[1]?.split(/[?/]/)[0] ?? '',
        )
        if (templateId === FIXTURE_TEMPLATE_ID) {
          return new Response(JSON.stringify(buildFixtureChecklistTemplateDto()), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return new Response(null, { status: 404 })
      }
      return new Response(null, { status: 404 })
    })
  })

  it('shows template unavailable empty state when no template can be resolved', async () => {
    await db.checklistTemplateCache.clear()
    localStorage.removeItem('inspector.checklist.defaultTemplateRef')
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

    const router = createRouterForChecklist()
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId: 'insp-1', executionId: 'exec-no-template' },
    })
    const wrapper = mount(ChecklistExecutionView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await flushPromises()
    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-testid="checklist-template-unavailable"]').exists()).toBe(true)
      },
      { timeout: 6000 },
    )
    expect(wrapper.text()).toContain('Checklist template not available offline')
    expect(wrapper.find('[data-testid="checklist-download-template"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="checklist-item-item-1"]').exists()).toBe(false)
  })

  it('renders checklist items and category headings', async () => {
    const router = createRouterForChecklist()
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId: 'insp-1', executionId: 'exec-1' },
    })
    const wrapper = mount(ChecklistExecutionView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="checklist-execution-view"]').exists()).toBe(true)
    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-testid="checklist-item-item-1"]').exists()).toBe(true)
      },
      { timeout: 6000 },
    )
    expect(wrapper.find('[data-testid="checklist-category-fire"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="checklist-category-building"]').exists()).toBe(true)
  })

  it('uses server template item ids when execution and template load from API', async () => {
    const now = new Date().toISOString()
    const serverItemId = 'real-template-item-id'
    vi.mocked(apiFetch).mockImplementation(async (url: string | URL | Request) => {
      const s = typeof url === 'string' ? url : url.toString()
      if (s.includes('/deficiencies')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (s.includes('/checklists/executions/exec-server') && !s.includes('/responses')) {
        return new Response(
          JSON.stringify({
            id: 'exec-server',
            inspectionId: 'insp-1',
            templateId: 'tpl-real',
            versionHash: 'vh1',
            responses: [],
            progress: 0,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (s.includes('/checklists/templates/tpl-real')) {
        return new Response(
          JSON.stringify({
            id: 'tpl-real',
            name: 'T',
            discipline: 'Building',
            version: 1,
            versionHash: 'vh1',
            items: [
              {
                id: serverItemId,
                order: 1,
                text: 'Server item',
                category: 'Fire',
                isRequired: true,
                requiresPhoto: false,
              },
            ],
            isActive: true,
            createdAt: now,
            updatedAt: now,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response(null, { status: 404 })
    })

    const router = createRouterForChecklist()
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId: 'insp-1', executionId: 'exec-server' },
    })
    const wrapper = mount(ChecklistExecutionView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await vi.waitFor(
      () => {
        expect(wrapper.find(`[data-testid="checklist-item-${serverItemId}"]`).exists()).toBe(true)
      },
      { timeout: 6000 },
    )
    await flushPromises()
  })

  it('shows progress bar and percent', async () => {
    const router = createRouterForChecklist()
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId: 'insp-1', executionId: 'exec-1' },
    })
    const wrapper = mount(ChecklistExecutionView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="checklist-progress-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="checklist-progress-percent"]').text()).toMatch(/\d+%/)
  })

  it('updates progress when Pass is clicked on a required item', async () => {
    const router = createRouterForChecklist()
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId: 'insp-1', executionId: 'exec-1' },
    })
    const wrapper = mount(ChecklistExecutionView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await waitForChecklistReady(wrapper)
    await wrapper.find('[data-testid="checklist-pass-item-1"]').trigger('click')
    await flushPromises()
    const pct = wrapper.find('[data-testid="checklist-progress-percent"]').text()
    expect(pct).not.toBe('0%')
    expect(wrapper.find('[data-testid="checklist-item-status-item-1"]').text()).toContain('PASS')
  })

  it('shows evidence photo hint when checklist gallery is gated off (M7-I1-B1)', async () => {
    const router = createRouterForChecklist()
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId: 'insp-1', executionId: 'exec-1' },
    })
    const wrapper = mount(ChecklistExecutionView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await waitForChecklistReady(wrapper)
    expect(wrapper.find('[data-testid="checklist-evidence-photo-hint-item-2"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="checklist-evidence-photo-hint-item-1"]').exists()).toBe(
      false,
    )
    expect(
      wrapper
        .find('[data-testid="checklist-item-item-1"] [data-testid="photo-gallery-stub"]')
        .exists(),
    ).toBe(true)
  })

  it('removes evidence photo hint after Fail when gallery mounts (M7-I1-B1)', async () => {
    localStorage.setItem(
      CODE_REFERENCE_LIBRARY_KEY,
      JSON.stringify({
        entries: [
          {
            code: 'NBC',
            section: '3.4.1',
            description: 'Exit signs',
            cachedAt: new Date().toISOString(),
          },
        ],
      }),
    )
    const router = createRouterForChecklist()
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId: 'insp-1', executionId: 'exec-1' },
    })
    const wrapper = mount(ChecklistExecutionView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await waitForChecklistReady(wrapper)
    expect(wrapper.find('[data-testid="checklist-evidence-photo-hint-item-2"]').exists()).toBe(true)

    await wrapper.find('[data-testid="checklist-fail-item-2"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="code-reference-search-input"]').setValue('NBC')
    await flushPromises()
    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-testid="code-reference-results-list"]').exists()).toBe(true)
      },
      { timeout: 4000 },
    )
    await wrapper.find('[data-testid="code-reference-item-NBC-3-4-1-result-0"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="checklist-item-status-item-2"]').text()).toContain('FAIL')
    expect(wrapper.find('[data-testid="checklist-evidence-photo-hint-item-2"]').exists()).toBe(
      false,
    )
    expect(
      wrapper
        .find('[data-testid="checklist-item-item-2"] [data-testid="photo-gallery-stub"]')
        .exists(),
    ).toBe(true)
  })

  it('Pass all shows confirmation and marks items as PASS on confirm', async () => {
    const router = createRouterForChecklist()
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId: 'insp-1', executionId: 'exec-1' },
    })
    const wrapper = mount(ChecklistExecutionView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await waitForChecklistReady(wrapper)

    await wrapper.find('[data-testid="checklist-pass-all"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="pass-all-dialog"]').exists()).toBe(true)

    await wrapper.find('[data-testid="pass-all-dialog-confirm"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="pass-all-dialog"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="checklist-item-status-item-1"]').text()).toContain('PASS')
    expect(wrapper.find('[data-testid="checklist-item-status-item-2"]').text()).toContain('PASS')
  })

  it('toggles failed-only filter', async () => {
    localStorage.setItem(
      CODE_REFERENCE_LIBRARY_KEY,
      JSON.stringify({
        entries: [
          {
            code: 'NBC',
            section: '9.10.1',
            description: 'Fire separation',
            cachedAt: new Date().toISOString(),
          },
        ],
      }),
    )
    const router = createRouterForChecklist()
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId: 'insp-1', executionId: 'exec-1' },
    })
    const wrapper = mount(ChecklistExecutionView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await waitForChecklistReady(wrapper)
    await wrapper.find('[data-testid="checklist-fail-item-1"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="code-reference-modal"]').exists()).toBe(true)
    await wrapper.find('[data-testid="code-reference-search-input"]').setValue('NBC')
    await flushPromises()
    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-testid="code-reference-results-list"]').exists()).toBe(true)
      },
      { timeout: 4000 },
    )
    await wrapper.find('[data-testid="code-reference-item-NBC-9-10-1-result-0"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="code-reference-modal"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="checklist-item-status-item-1"]').text()).toContain('FAIL')
    expect(wrapper.find('[data-testid="checklist-fail-deficiency-modal"]').exists()).toBe(false)
    await wrapper.find('[data-testid="checklist-record-deficiency-item-1"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="checklist-fail-deficiency-modal"]').exists()).toBe(true)
    await wrapper.find('[data-testid="checklist-fail-deficiency-close"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="checklist-fail-deficiency-modal"]').exists()).toBe(false)
    await wrapper.find('[data-testid="checklist-filter-failed"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="checklist-item-item-2"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="checklist-item-item-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="checklist-next-failed"]').exists()).toBe(true)
  })

  it('filters unanswered-only items', async () => {
    const executionId = 'exec-unanswered-filter'
    const router = createRouterForChecklist()
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId: 'insp-1', executionId },
    })
    const wrapper = mount(ChecklistExecutionView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await waitForChecklistReady(wrapper)

    await wrapper.find('[data-testid="checklist-pass-item-1"]').trigger('click')
    await flushPromises()
    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-testid="checklist-item-status-item-1"]').text()).toContain(
          'PASS',
        )
      },
      { timeout: 4000 },
    )

    // The pass answer persists asynchronously (Dexie). Wait for it to be
    // reflected before filtering so the unanswered filter sees a deterministic
    // answered/unanswered split rather than racing the persist under load.
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="checklist-item-status-item-1"]').text()).toContain('PASS')
    })

    await wrapper.find('[data-testid="checklist-filter-unanswered"]').trigger('click')
    await flushPromises()
    await nextTick()

    // Filtering is synchronous/reactive (see the failed-filter test above), so
    // assert on the microtask-settled DOM rather than a wall-clock vi.waitFor
    // budget, which is racy when worker threads are CPU-starved under the full
    // parallel suite.
    expect(wrapper.find('[data-testid="checklist-item-item-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="checklist-item-item-2"]').exists()).toBe(true)
  })

  it('shows empty state when filter has no matches', async () => {
    const router = createRouterForChecklist()
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId: 'insp-1', executionId: 'exec-1' },
    })
    const wrapper = mount(ChecklistExecutionView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await flushPromises()

    await wrapper.find('[data-testid="checklist-filter-failed"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="checklist-empty-state"]').exists()).toBe(true)
    await wrapper.find('[data-testid="checklist-clear-filter"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="checklist-empty-state"]').exists()).toBe(false)
  })

  it('preserves filter selection in localStorage', async () => {
    localStorage.setItem('checklist-execution-filter-exec-1', 'unanswered')
    const router = createRouterForChecklist()
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId: 'insp-1', executionId: 'exec-1' },
    })
    const wrapper = mount(ChecklistExecutionView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await flushPromises()

    expect(
      wrapper.find('[data-testid="checklist-filter-unanswered"]').attributes('aria-pressed'),
    ).toBe('true')
  })

  it('persists execution state to IndexedDB on response change (M5-S16)', async () => {
    const router = createRouterForChecklist()
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId: 'insp-1', executionId: 'exec-1' },
    })
    const wrapper = mount(ChecklistExecutionView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await waitForChecklistReady(wrapper)
    await wrapper.find('[data-testid="checklist-pass-item-1"]').trigger('click')
    await flushPromises()
    await vi.waitFor(
      async () => {
        const row = await db.checklistResponses.get(checklistResponseRowId('exec-1', 'item-1'))
        expect(row?.result).toBe('PASS')
      },
      { timeout: 5000 },
    )
  })

  it('navigates to deficiency list from header with inspection id (M6-S7)', async () => {
    const router = createRouterForChecklist()
    const pushSpy = vi.spyOn(router, 'push')
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId: 'insp-field', executionId: 'exec-1' },
    })
    const wrapper = mount(ChecklistExecutionView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await flushPromises()
    await wrapper.find('[data-testid="checklist-deficiencies"]').trigger('click')
    expect(pushSpy).toHaveBeenCalledWith({
      name: 'deficiency-list',
      params: { inspectionId: 'insp-field' },
    })
  })

  it('opens deficiency modal only after Record deficiency; re-tap reopens (M6-S13, M6-S18 E2E)', async () => {
    localStorage.setItem(
      CODE_REFERENCE_LIBRARY_KEY,
      JSON.stringify({
        entries: [
          {
            code: 'NBC',
            section: '9.10.1',
            description: 'Fire separation',
            cachedAt: new Date().toISOString(),
          },
        ],
      }),
    )
    const router = createRouterForChecklist()
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId: 'insp-field', executionId: 'exec-1' },
    })
    const wrapper = mount(ChecklistExecutionView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await waitForChecklistReady(wrapper)
    await wrapper.find('[data-testid="checklist-fail-item-1"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="code-reference-search-input"]').setValue('NBC')
    await flushPromises()
    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-testid="code-reference-results-list"]').exists()).toBe(true)
      },
      { timeout: 4000 },
    )
    await wrapper.find('[data-testid="code-reference-item-NBC-9-10-1-result-0"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="checklist-fail-deficiency-modal"]').exists()).toBe(false)
    await wrapper.find('[data-testid="checklist-record-deficiency-item-1"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="checklist-fail-deficiency-modal"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="deficiency-code-summary"]').text()).toContain('NBC')
    await wrapper.find('[data-testid="checklist-fail-deficiency-close"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="checklist-fail-deficiency-modal"]').exists()).toBe(false)
    await wrapper.find('[data-testid="checklist-record-deficiency-item-1"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="checklist-fail-deficiency-modal"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="deficiency-code-summary"]').text()).toContain('NBC')
  })

  it('VC-ESCAL-01-Bug1: opens Record deficiency after reload when server FAIL lacks codeReference', async () => {
    const iso = new Date().toISOString()
    await persistChecklistExecutionState(
      {
        id: 'exec-bug1',
        inspectionId: 'insp-field',
        templateId: FIXTURE_TEMPLATE_ID,
        versionHash: FIXTURE_VERSION_HASH,
        responses: [
          {
            itemId: 'item-1',
            result: 'FAIL',
            codeReference: { code: 'NBC', section: '9.10.1' },
            timestamp: iso,
          },
        ],
        progress: 25,
      },
      { database: db, queueSync: false },
    )

    vi.mocked(apiFetch).mockImplementation(async (url: string | URL | Request) => {
      const s = typeof url === 'string' ? url : url.toString()
      if (s.includes('/deficiencies')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (s.includes('/checklists/executions/exec-bug1') && !s.includes('/responses')) {
        return new Response(
          JSON.stringify({
            id: 'exec-bug1',
            inspectionId: 'insp-field',
            templateId: FIXTURE_TEMPLATE_ID,
            versionHash: FIXTURE_VERSION_HASH,
            responses: [{ itemId: 'item-1', result: 'FAIL', timestamp: iso }],
            progress: 25,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (s.includes('/checklists/templates/')) {
        return new Response(JSON.stringify(buildFixtureChecklistTemplateDto()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(null, { status: 404 })
    })

    const router = createRouterForChecklist()
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId: 'insp-field', executionId: 'exec-bug1' },
    })
    const wrapper = mount(ChecklistExecutionView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await waitForChecklistReady(wrapper)
    await wrapper.find('[data-testid="checklist-record-deficiency-item-1"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="checklist-fail-deficiency-modal"]').exists()).toBe(true)
  })

  it('M6-S14 shows linked deficiency indicator on failed item and navigates to filtered deficiency list', async () => {
    const iso = new Date().toISOString()
    await db.deficiencies.clear()
    await db.deficiencies.put({
      id: 'def-linked-m6s14',
      clientId: 'client-linked-m6s14',
      inspectionId: 'insp-1',
      checklistItemId: 'item-1',
      createdById: 'user-t',
      description: 'Linked deficiency for checklist indicator test',
      severity: 'MAJOR',
      status: 'OPEN',
      isStopWork: false,
      isUnsafe: false,
      createdAt: iso,
      updatedAt: iso,
      isDirty: false,
    })
    await persistChecklistExecutionState(
      {
        id: 'exec-m6s14',
        inspectionId: 'insp-1',
        templateId: FIXTURE_TEMPLATE_ID,
        versionHash: FIXTURE_VERSION_HASH,
        responses: [
          {
            itemId: 'item-1',
            result: 'FAIL',
            codeReference: { code: 'NBC', section: '9.10.1' },
            timestamp: iso,
          },
        ],
        progress: 25,
      },
      { database: db, queueSync: false },
    )

    const router = createRouterForChecklist()
    const pushSpy = vi.spyOn(router, 'push')
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId: 'insp-1', executionId: 'exec-m6s14' },
    })
    const wrapper = mount(ChecklistExecutionView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await waitForChecklistReady(wrapper)
    await flushPromises()
    await vi.waitFor(
      () => {
        expect(
          wrapper
            .find('[data-testid="checklist-linked-deficiency-indicator-wrap-item-1"]')
            .exists(),
        ).toBe(true)
      },
      { timeout: 5000 },
    )
    expect(wrapper.find('[data-testid="deficiency-indicator-count"]').text()).toBe('1')

    await wrapper.find('[data-testid="deficiency-indicator"]').trigger('click')
    expect(pushSpy).toHaveBeenCalledWith({
      name: 'deficiency-list',
      params: { inspectionId: 'insp-1' },
      query: { checklistItemId: 'item-1' },
    })

    await db.deficiencies.delete('def-linked-m6s14')
    await db.checklistResponses.clear()
  })

  function makeChecklistEvidencePhoto(
    id: string,
    inspectionId: string,
    checklistItemId: string,
  ): LocalPhoto {
    const embedded = buildEmbeddedPhotoMetadata({
      capturedAt: new Date('2026-04-12T10:00:00.000Z'),
      inspectorId: 'u-t',
      inspectorName: 'T',
    })
    return {
      id,
      clientId: `client-${id}`,
      inspectionId,
      checklistItemId,
      filename: `${id}.jpg`,
      mimeType: 'image/jpeg',
      size: 8,
      thumbnail: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
      metadata: toPhotoMetadata(embedded, { hasWatermark: false }),
      createdAt: embedded.timestamp,
    }
  }

  it('M7-S16 blocks completion and shows banner when FAIL+requiresPhoto has no evidence photo', async () => {
    localStorage.setItem(
      CODE_REFERENCE_LIBRARY_KEY,
      JSON.stringify({
        entries: [
          {
            code: 'NBC',
            section: '9.10.1',
            description: 'Fire separation',
            cachedAt: new Date().toISOString(),
          },
        ],
      }),
    )
    const router = createRouterForChecklist()
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId: 'insp-1', executionId: 'exec-m7s16' },
    })
    const wrapper = mount(ChecklistExecutionView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await waitForChecklistReady(wrapper)

    await wrapper.find('[data-testid="checklist-pass-item-2"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="checklist-pass-item-3"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="checklist-fail-item-1"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="code-reference-search-input"]').setValue('NBC')
    await flushPromises()
    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-testid="code-reference-results-list"]').exists()).toBe(true)
      },
      { timeout: 4000 },
    )
    await wrapper.find('[data-testid="code-reference-item-NBC-9-10-1-result-0"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="checklist-mandatory-photo-banner"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="checklist-mandatory-photo-warning-item-1"]').exists()).toBe(
      true,
    )
    const btn = wrapper.find('[data-testid="checklist-complete-inspection"]')
      .element as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('M-05 blocks completion when FAIL row lacks photo even without requiresPhoto flag', async () => {
    localStorage.setItem(
      CODE_REFERENCE_LIBRARY_KEY,
      JSON.stringify({
        entries: [
          {
            code: 'NBC',
            section: '3.4.1',
            description: 'Exit signs',
            cachedAt: new Date().toISOString(),
          },
        ],
      }),
    )
    const router = createRouterForChecklist()
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId: 'insp-1', executionId: 'exec-m7s16c' },
    })
    const wrapper = mount(ChecklistExecutionView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await waitForChecklistReady(wrapper)

    await wrapper.find('[data-testid="checklist-pass-item-1"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="checklist-pass-item-3"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="checklist-na-item-4"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="checklist-fail-item-2"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="code-reference-search-input"]').setValue('NBC')
    await flushPromises()
    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-testid="code-reference-results-list"]').exists()).toBe(true)
      },
      { timeout: 4000 },
    )
    await wrapper.find('[data-testid="code-reference-item-NBC-3-4-1-result-0"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="checklist-mandatory-photo-banner"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="checklist-mandatory-photo-warning-item-2"]').exists()).toBe(
      true,
    )
    const btn = wrapper.find('[data-testid="checklist-complete-inspection"]')
      .element as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('M7-S16 allows completion after a checklist-scoped photo exists for failed requiresPhoto item', async () => {
    localStorage.setItem(
      CODE_REFERENCE_LIBRARY_KEY,
      JSON.stringify({
        entries: [
          {
            code: 'NBC',
            section: '9.10.1',
            description: 'Fire separation',
            cachedAt: new Date().toISOString(),
          },
        ],
      }),
    )
    const router = createRouterForChecklist()
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId: 'insp-1', executionId: 'exec-m7s16b' },
    })
    const wrapper = mount(ChecklistExecutionView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await waitForChecklistReady(wrapper)

    await wrapper.find('[data-testid="checklist-pass-item-2"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="checklist-pass-item-3"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="checklist-fail-item-1"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="code-reference-search-input"]').setValue('NBC')
    await flushPromises()
    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-testid="code-reference-results-list"]').exists()).toBe(true)
      },
      { timeout: 4000 },
    )
    await wrapper.find('[data-testid="code-reference-item-NBC-9-10-1-result-0"]').trigger('click')
    await flushPromises()

    await putOfflinePhoto(db, makeChecklistEvidencePhoto('ph-m7s16', 'insp-1', 'item-1'))
    await wrapper.find('[data-testid="photo-gallery-stub"]').trigger('click')
    await flushPromises()
    await vi.waitFor(
      () => {
        const el = wrapper.find('[data-testid="checklist-complete-inspection"]')
          .element as HTMLButtonElement
        expect(el.disabled).toBe(false)
      },
      { timeout: 5000 },
    )
    expect(wrapper.find('[data-testid="checklist-mandatory-photo-banner"]').exists()).toBe(false)
  })

  it('M7-S14-B2: Back navigates to owning permit when capture-photo is still in history', async () => {
    const now = new Date().toISOString()
    const inspectionRow: LocalInspection = {
      id: 'insp-back-stack',
      clientId: 'client-back-stack',
      permitId: 'perm-owner-1',
      permitNumber: 'PN-1',
      status: 'IN_PROGRESS',
      scheduledDate: now,
      assignedToId: 'user-456',
      createdAt: now,
      updatedAt: now,
      isDirty: false,
    }
    await db.inspections.put(inspectionRow)

    const router = createRouterForChecklist()
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId: 'insp-back-stack', executionId: 'exec-b2' },
    })
    await router.push({ name: 'capture-photo' })
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId: 'insp-back-stack', executionId: 'exec-b2' },
    })

    const wrapper = mount(ChecklistExecutionView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await waitForChecklistReady(wrapper)

    expect(await db.inspections.get('insp-back-stack')).toMatchObject({
      permitId: 'perm-owner-1',
    })

    await wrapper.find('[data-testid="checklist-back"]').trigger('click')
    await flushPromises()
    await vi.waitFor(
      () => {
        expect(router.currentRoute.value.name).toBe('permit-detail')
      },
      { timeout: 3000 },
    )

    expect(router.currentRoute.value.params.id).toBe('perm-owner-1')
  })

  it('M7-S14-B2: Back uses fromPermit query when local inspection has no permitId', async () => {
    const router = createRouterForChecklist()
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId: 'insp-1', executionId: 'exec-from-q' },
      query: { fromPermit: 'perm-cuid-xyz' },
    })

    const wrapper = mount(ChecklistExecutionView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await waitForChecklistReady(wrapper)

    await wrapper.find('[data-testid="checklist-back"]').trigger('click')
    await flushPromises()
    await vi.waitFor(
      () => {
        expect(router.currentRoute.value.name).toBe('permit-detail')
      },
      { timeout: 3000 },
    )
    expect(router.currentRoute.value.params.id).toBe('perm-cuid-xyz')
  })

  it('M7-S14-B2: Back falls back to permits when inspection has no permitId', async () => {
    const now = new Date().toISOString()
    await db.inspections.put({
      id: 'insp-no-permit',
      clientId: 'c-np',
      permitId: '',
      status: 'IN_PROGRESS',
      scheduledDate: now,
      assignedToId: 'user-456',
      createdAt: now,
      updatedAt: now,
      isDirty: false,
    })

    const router = createRouterForChecklist()
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId: 'insp-no-permit', executionId: 'exec-np' },
    })

    const wrapper = mount(ChecklistExecutionView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await waitForChecklistReady(wrapper)

    await wrapper.find('[data-testid="checklist-back"]').trigger('click')
    await flushPromises()
    await vi.waitFor(
      () => {
        expect(router.currentRoute.value.name).toBe('permits')
      },
      { timeout: 3000 },
    )
  })

  it('shows read-only banner and disables checklist controls after successful sync (VC-FINAL-03)', async () => {
    const now = new Date().toISOString()
    const inspectionId = 'insp-readonly-sync'
    const executionId = 'exec-readonly-sync'

    await db.inspections.put({
      id: inspectionId,
      clientId: 'c-ro',
      permitId: 'perm-ro',
      status: 'PASSED',
      scheduledDate: now,
      assignedToId: 'user-456',
      createdAt: now,
      updatedAt: now,
      syncedAt: now,
      isDirty: false,
    } satisfies LocalInspection)

    await persistDefaultChecklistTemplateRef({
      templateId: FIXTURE_TEMPLATE_ID,
      versionHash: FIXTURE_VERSION_HASH,
    })
    await db.checklistTemplateCache.put(buildFixtureTemplateCacheRow())

    await persistChecklistExecutionState(
      {
        id: executionId,
        inspectionId,
        templateId: FIXTURE_TEMPLATE_ID,
        versionHash: FIXTURE_VERSION_HASH,
        responses: [],
        progress: 0,
      },
      { database: db, queueSync: false },
    )

    const router = createRouterForChecklist()
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId, executionId },
    })

    const wrapper = mount(ChecklistExecutionView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await waitForChecklistReady(wrapper)

    expect(wrapper.find('[data-testid="inspection-read-only-banner"]').exists()).toBe(true)
    const passBtn = wrapper.find('[data-testid^="checklist-pass-"]').element as HTMLButtonElement
    expect(passBtn.disabled).toBe(true)
    expect(
      (wrapper.find('[data-testid="checklist-complete-inspection"]').element as HTMLButtonElement)
        .disabled,
    ).toBe(true)
  })
})
