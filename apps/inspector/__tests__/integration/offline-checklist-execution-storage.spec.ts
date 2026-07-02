/**
 * Integration — checklist execution persistence in IndexedDB (M5-S16).
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import type { ChecklistExecutionDTO, ChecklistItemDTO } from '@codecomply/validators'
import ChecklistExecutionView from '@/views/ChecklistExecutionView.vue'
import { db } from '@/lib/db/dexie'
import {
  checklistResponseQueueClientId,
  checklistResponseRowId,
  loadChecklistExecutionFromStorage,
  markChecklistResponseSyncedAfterSuccessfulPush,
  mergeServerChecklistResponses,
  persistChecklistExecutionState,
} from '@/lib/db/checklist-storage'
import { syncEngine } from '@/lib/db/sync-engine'
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

function mockApiFetchForChecklist(inspectionId: string) {
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
            inspectionId,
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
}

async function waitForChecklistReady(wrapper: ReturnType<typeof mount>) {
  await flushPromises()
  await vi.waitFor(
    () => {
      expect(wrapper.find('[data-testid="checklist-item-item-1"]').exists()).toBe(true)
    },
    { timeout: 6000 },
  )
  await vi.waitFor(
    () => expect(wrapper.find('[data-testid="checklist-save-status"]').text()).toContain('Saved'),
    { timeout: 6000 },
  )
  await flushPromises()
}

function createChecklistRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/inspections/:inspectionId/checklist/:executionId',
        name: 'checklist-execution',
        component: ChecklistExecutionView,
      },
    ],
  })
}

const templateItemsStub: ChecklistItemDTO[] = [
  {
    id: 'item-1',
    order: 1,
    text: 'A',
    isRequired: true,
    requiresPhoto: false,
  },
]

function makeExec(
  executionId: string,
  inspectionId: string,
  responses: ChecklistExecutionDTO['responses'],
): ChecklistExecutionDTO {
  return {
    id: executionId,
    inspectionId,
    templateId: 'tpl-int',
    versionHash: 'vh-int',
    responses,
    progress: 0,
  }
}

describe('offline checklist execution storage (integration)', { timeout: 15_000 }, () => {
  let queryClient: QueryClient
  let pinia: Pinia

  beforeEach(async () => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    pinia = createPinia()
    setActivePinia(pinia)
    localStorage.clear()
    sessionStorage.clear()
    await db.checklistTemplateCache.clear()
    await db.checklistResponses.clear()
    await db.syncQueue.clear()
    await db.checklistTemplateCache.put(buildFixtureTemplateCacheRow())
    persistDefaultChecklistTemplateRef({
      templateId: FIXTURE_TEMPLATE_ID,
      versionHash: FIXTURE_VERSION_HASH,
    })
    mockApiFetchForChecklist('insp-persist')
  })

  afterEach(async () => {
    await db.checklistTemplateCache.clear()
    await db.checklistResponses.clear()
    await db.syncQueue.clear()
  })

  it('survives unmount: responses reload from IndexedDB on next mount', async () => {
    const inspectionId = 'insp-persist'
    const executionId = 'exec-persist'
    const router = createChecklistRouter()
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId, executionId },
    })

    const w1 = mount(ChecklistExecutionView, {
      global: {
        plugins: [router, pinia, [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await waitForChecklistReady(w1)
    await w1.find('[data-testid="checklist-pass-item-1"]').trigger('click')
    await flushPromises()
    await vi.waitFor(
      async () => {
        const row = await db.checklistResponses.get(checklistResponseRowId(executionId, 'item-1'))
        expect(row?.result).toBe('PASS')
      },
      { timeout: 5000 },
    )
    w1.unmount()

    await router.push({
      name: 'checklist-execution',
      params: { inspectionId, executionId },
    })
    const w2 = mount(ChecklistExecutionView, {
      global: {
        plugins: [router, pinia, [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await waitForChecklistReady(w2)
    expect(w2.find('[data-testid="checklist-item-status-item-1"]').text()).toContain('PASS')
    w2.unmount()
  })

  it('persistChecklistExecutionState with queueSync enqueues checklistResponse.update on shared db', async () => {
    const queueSpy = vi.spyOn(syncEngine, 'queueMutation')
    const ex = makeExec('exec-sync', 'insp-sync', [
      {
        itemId: 'item-1',
        result: 'FAIL',
        codeReference: { code: 'NBC', section: '1' },
        timestamp: '2026-04-01T10:00:00.000Z',
      },
    ])
    await persistChecklistExecutionState(ex, { database: db, queueSync: true, syncEngine })
    expect(queueSpy).toHaveBeenCalledWith(
      'checklistResponse.update',
      expect.objectContaining({
        clientId: checklistResponseQueueClientId('exec-sync', 'item-1'),
        executionId: 'exec-sync',
        itemId: 'item-1',
        result: 'FAIL',
      }),
      15,
    )
    const pending = await db.syncQueue
      .filter((q) => q.clientId === checklistResponseQueueClientId('exec-sync', 'item-1'))
      .count()
    expect(pending).toBeGreaterThan(0)
    queueSpy.mockRestore()
  })

  it('mergeServerChecklistResponses updates IndexedDB for recovery after server pull', async () => {
    await persistChecklistExecutionState(
      makeExec('exec-merge', 'insp-merge', [
        { itemId: 'item-1', result: 'PASS', timestamp: '2026-01-01T12:00:00.000Z' },
      ]),
      { database: db, queueSync: false },
    )
    await db.checklistResponses.update(checklistResponseRowId('exec-merge', 'item-1'), {
      updatedAt: '2020-01-01T00:00:00.000Z',
    })
    await mergeServerChecklistResponses(
      'exec-merge',
      [
        {
          response: {
            itemId: 'item-1',
            result: 'NA',
            timestamp: '2026-04-01T12:00:00.000Z',
          },
          serverUpdatedAt: '2026-04-01T15:00:00.000Z',
        },
      ],
      { database: db },
    )
    const loaded = await loadChecklistExecutionFromStorage(
      {
        id: 'exec-merge',
        inspectionId: 'insp-merge',
        templateId: 'tpl-int',
        versionHash: 'vh-int',
      },
      templateItemsStub,
      { database: db },
    )
    expect(loaded.responses[0]?.result).toBe('NA')
  })

  it('markChecklistResponseSyncedAfterSuccessfulPush clears pending queue and dirty flag', async () => {
    const queueSpy = vi.spyOn(syncEngine, 'queueMutation')
    await persistChecklistExecutionState(
      makeExec('exec-clean', 'insp-clean', [
        { itemId: 'item-1', result: 'PASS', timestamp: '2026-04-01T08:00:00.000Z' },
      ]),
      { database: db, queueSync: true, syncEngine },
    )
    queueSpy.mockRestore()
    await markChecklistResponseSyncedAfterSuccessfulPush('exec-clean', 'item-1', {
      database: db,
      serverUpdatedAt: '2026-04-01T09:00:00.000Z',
    })
    const row = await db.checklistResponses.get(checklistResponseRowId('exec-clean', 'item-1'))
    expect(row?.isDirty).toBe(false)
    const stillQueued = await db.syncQueue
      .filter((q) => q.clientId === checklistResponseQueueClientId('exec-clean', 'item-1'))
      .count()
    expect(stillQueued).toBe(0)
  })
})
