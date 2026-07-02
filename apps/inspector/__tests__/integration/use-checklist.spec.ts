/**
 * Integration tests for useChecklist (M5-S6): composable + DOM anchors + validators.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useChecklist, CHECKLIST_ITEM_ANCHOR_PREFIX } from '@/composables/useChecklist'
import type { ChecklistExecutionDTO, ChecklistItemDTO } from '@codecomply/validators'

const codeRef = { code: 'NBC', section: '9.10.1' }

function itemsFixture(): ChecklistItemDTO[] {
  return [
    { id: 'i1', order: 1, text: 'One', isRequired: true, requiresPhoto: false },
    { id: 'i2', order: 2, text: 'Two', isRequired: true, requiresPhoto: false },
  ]
}

function ensureScrollIntoView(): void {
  if (typeof HTMLElement.prototype.scrollIntoView !== 'function') {
    HTMLElement.prototype.scrollIntoView = function () {}
  }
}

describe('useChecklist integration', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    ensureScrollIntoView()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('matches computeChecklistExecutionProgress for full PASS on required items', async () => {
    const items = ref(itemsFixture())
    const { execution, progress, updateResponse, isComplete } = useChecklist({ items })
    const base: ChecklistExecutionDTO = {
      id: 'ex-1',
      inspectionId: 'in-1',
      templateId: 't-1',
      versionHash: 'v',
      responses: [],
      progress: 0,
    }
    execution.value = base
    await updateResponse('i1', { result: 'PASS', timestamp: '2026-01-01T12:00:00.000Z' })
    expect(progress.value).toBe(50)
    await updateResponse('i2', { result: 'PASS', timestamp: '2026-01-01T12:01:00.000Z' })
    expect(progress.value).toBe(100)
    expect(isComplete.value).toBe(true)
  })

  it('scrollToNextFailed targets elements by CHECKLIST_ITEM_ANCHOR_PREFIX', () => {
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
    const items = ref(itemsFixture())
    const { execution, scrollToNextFailed } = useChecklist({ items })
    execution.value = {
      id: 'ex-1',
      inspectionId: 'in-1',
      templateId: 't-1',
      versionHash: 'v',
      responses: [
        {
          itemId: 'i1',
          result: 'FAIL',
          codeReference: codeRef,
          timestamp: '2026-01-01T12:00:00.000Z',
        },
      ],
      progress: 50,
    }
    const el = document.createElement('section')
    el.id = `${CHECKLIST_ITEM_ANCHOR_PREFIX}i1`
    document.body.appendChild(el)
    scrollToNextFailed()
    expect(scroll).toHaveBeenCalled()
  })
})
