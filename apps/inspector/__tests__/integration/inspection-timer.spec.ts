/**
 * Integration — inspection timer + complete flow (M5-S17).
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import ChecklistExecutionView from '@/views/ChecklistExecutionView.vue'
import { db } from '@/lib/db/dexie'
import type { LocalInspection } from '@/lib/db/types'
import { inspectionTimerStorageKey } from '@/composables/useInspectionTimer'
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

function makeInspection(id: string): LocalInspection {
  const iso = '2026-01-15T10:00:00.000Z'
  return {
    id,
    clientId: `client-${id}`,
    permitId: 'permit-m5s17',
    status: 'IN_PROGRESS',
    scheduledDate: iso,
    assignedToId: 'user-m5s17',
    createdAt: iso,
    updatedAt: iso,
    isDirty: false,
  }
}

async function waitForSaved(wrapper: ReturnType<typeof mount>) {
  await flushPromises()
  await vi.waitFor(
    () => expect(wrapper.find('[data-testid="checklist-save-status"]').text()).toContain('Saved'),
    { timeout: 6000 },
  )
  await flushPromises()
}

describe('inspection timer (integration)', { timeout: 15_000 }, () => {
  const inspectionId = 'insp-m5s17-timer'
  const executionId = 'exec-m5s17-timer'
  let queryClient: QueryClient

  beforeEach(async () => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    setActivePinia(createPinia())
    localStorage.clear()
    sessionStorage.clear()
    await db.checklistTemplateCache.clear()
    await db.checklistResponses.clear()
    await db.syncQueue.clear()
    try {
      await db.inspections.delete(inspectionId)
    } catch {
      /* ignore */
    }
    await db.inspections.add(makeInspection(inspectionId))
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
  })

  it('persists timer to localStorage while executing and saves duration on complete', async () => {
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
      params: { inspectionId, executionId },
    })

    const wrapper = mount(ChecklistExecutionView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })

    await waitForSaved(wrapper)

    expect(await db.inspections.get(inspectionId)).toBeDefined()

    expect(wrapper.find('[data-testid="inspection-timer"]').exists()).toBe(true)

    await vi.waitFor(
      () => {
        const raw = localStorage.getItem(inspectionTimerStorageKey(inspectionId))
        expect(raw).toBeTruthy()
        const p = JSON.parse(raw!) as { completed?: boolean }
        expect(p.completed).toBeFalsy()
      },
      { timeout: 4000 },
    )

    await wrapper.find('[data-testid="checklist-pass-all"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="pass-all-dialog-confirm"]').trigger('click')
    await flushPromises()

    const completeBtn = wrapper.find('[data-testid="checklist-complete-inspection"]')
    await vi.waitFor(
      () => {
        expect((completeBtn.element as HTMLButtonElement).disabled).toBe(false)
      },
      { timeout: 5000 },
    )
    expect(wrapper.find('[data-testid="checklist-progress-percent"]').text()).toContain('100')
    ;(completeBtn.element as HTMLButtonElement).click()
    await vi.waitFor(
      async () => {
        const row = await db.inspections.get(inspectionId)
        expect(row?.durationSeconds).toBeDefined()
      },
      { timeout: 5000 },
    )

    const timerRaw = localStorage.getItem(inspectionTimerStorageKey(inspectionId))
    expect(timerRaw).toBeTruthy()
    const timerState = JSON.parse(timerRaw!) as { completed: boolean }
    expect(timerState.completed).toBe(true)

    const row = await db.inspections.get(inspectionId)
    expect(row?.durationSeconds).toBeDefined()
    expect(typeof row!.durationSeconds).toBe('number')
    expect(row!.durationSeconds).toBeGreaterThanOrEqual(0)

    wrapper.unmount()
  })
})
