/**
 * Unit tests for useChecklist (M5-S6)
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import {
  useChecklist,
  CHECKLIST_ITEM_ANCHOR_PREFIX,
  getMandatoryPhotoViolations,
} from './useChecklist'
import type { ChecklistExecutionDTO, ChecklistItemDTO } from '@codecomply/validators'

const codeRef = { code: 'NBC', section: '9.23.1', title: 'Framing' }

function makeItems(): ChecklistItemDTO[] {
  return [
    {
      id: 'a',
      order: 1,
      text: 'Q1',
      isRequired: true,
      requiresPhoto: false,
    },
    {
      id: 'b',
      order: 2,
      text: 'Q2',
      isRequired: true,
      requiresPhoto: false,
    },
    {
      id: 'c',
      order: 3,
      text: 'Q3',
      isRequired: false,
      requiresPhoto: false,
    },
  ]
}

function makeExecution(overrides?: Partial<ChecklistExecutionDTO>): ChecklistExecutionDTO {
  return {
    id: 'exec-1',
    inspectionId: 'insp-1',
    templateId: 'tpl-1',
    versionHash: 'hash',
    responses: [],
    progress: 0,
    ...overrides,
  }
}

function ensureScrollIntoView(): void {
  if (typeof HTMLElement.prototype.scrollIntoView !== 'function') {
    HTMLElement.prototype.scrollIntoView = function () {}
  }
}

describe('useChecklist', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    ensureScrollIntoView()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exposes null execution until set', () => {
    const items = ref(makeItems())
    const { execution, progress, failedItems, isComplete } = useChecklist({ items })
    expect(execution.value).toBeNull()
    expect(progress.value).toBe(0)
    expect(failedItems.value).toEqual([])
    expect(isComplete.value).toBe(false)
  })

  it('computes progress from required items and responses', () => {
    const items = ref(makeItems())
    const { execution, progress } = useChecklist({ items })
    execution.value = makeExecution({
      responses: [{ itemId: 'a', result: 'PASS', timestamp: '2025-01-01T00:00:00.000Z' }],
    })
    expect(progress.value).toBe(50)
    execution.value = {
      ...execution.value!,
      responses: [
        { itemId: 'a', result: 'PASS', timestamp: '2025-01-01T00:00:00.000Z' },
        { itemId: 'b', result: 'PASS', timestamp: '2025-01-01T00:00:00.000Z' },
      ],
      progress: 100,
    }
    expect(progress.value).toBe(100)
  })

  it('filters failedItems to FAIL responses', () => {
    const items = ref(makeItems())
    const { execution, failedItems } = useChecklist({ items })
    execution.value = makeExecution({
      responses: [
        {
          itemId: 'a',
          result: 'FAIL',
          codeReference: codeRef,
          timestamp: '2025-01-01T00:00:00.000Z',
        },
        { itemId: 'b', result: 'PASS', timestamp: '2025-01-01T00:00:00.000Z' },
      ],
    })
    expect(failedItems.value.map((i) => i.id)).toEqual(['a'])
  })

  it('computes unansweredItems', () => {
    const items = ref(makeItems())
    const { execution, unansweredItems } = useChecklist({ items })
    execution.value = makeExecution({
      responses: [{ itemId: 'a', result: 'PASS', timestamp: '2025-01-01T00:00:00.000Z' }],
    })
    expect(unansweredItems.value.map((i) => i.id)).toEqual(['b', 'c'])
  })

  it('updateResponse upserts and recalculates progress', async () => {
    const items = ref(makeItems())
    const { execution, progress, updateResponse } = useChecklist({ items })
    execution.value = makeExecution()
    await updateResponse('a', { result: 'PASS', timestamp: '2025-01-01T00:00:00.000Z' })
    expect(execution.value?.responses).toHaveLength(1)
    expect(progress.value).toBe(50)
    await updateResponse('a', {
      result: 'FAIL',
      codeReference: codeRef,
      timestamp: '2025-01-01T01:00:00.000Z',
    })
    expect(execution.value?.responses[0]?.result).toBe('FAIL')
    expect(progress.value).toBe(50)
  })

  it('passAll marks every template item as PASS', async () => {
    const items = ref(makeItems())
    const { execution, progress, isComplete, passAll } = useChecklist({ items })
    execution.value = makeExecution({
      responses: [
        {
          itemId: 'a',
          result: 'FAIL',
          codeReference: codeRef,
          timestamp: '2025-01-01T00:00:00.000Z',
        },
      ],
    })
    await passAll()
    expect(execution.value?.responses.every((r) => r.result === 'PASS')).toBe(true)
    expect(progress.value).toBe(100)
    expect(isComplete.value).toBe(true)
  })

  it('scrollToNextFailed cycles through failed items in template order', () => {
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
    const items = ref(makeItems())
    const { execution, scrollToNextFailed } = useChecklist({ items })
    execution.value = makeExecution({
      responses: [
        {
          itemId: 'b',
          result: 'FAIL',
          codeReference: codeRef,
          timestamp: '2025-01-01T00:00:00.000Z',
        },
        {
          itemId: 'a',
          result: 'FAIL',
          codeReference: codeRef,
          timestamp: '2025-01-01T00:00:00.000Z',
        },
      ],
    })
    for (const id of ['a', 'b']) {
      const d = document.createElement('div')
      d.id = `${CHECKLIST_ITEM_ANCHOR_PREFIX}${id}`
      document.body.appendChild(d)
    }
    scrollToNextFailed()
    scrollToNextFailed()
    expect(scroll.mock.calls.length).toBe(2)
  })

  it('scrollToNextUnanswered visits unanswered in order', () => {
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
    const items = ref(makeItems())
    const { execution, scrollToNextUnanswered } = useChecklist({ items })
    execution.value = makeExecution()
    for (const id of ['a', 'b', 'c']) {
      const d = document.createElement('div')
      d.id = `${CHECKLIST_ITEM_ANCHOR_PREFIX}${id}`
      document.body.appendChild(d)
    }
    scrollToNextUnanswered()
    scrollToNextUnanswered()
    expect(scroll.mock.calls.length).toBe(2)
  })

  it('rejects FAIL updateResponse without codeReference', async () => {
    const items = ref(makeItems())
    const { execution, updateResponse } = useChecklist({ items })
    execution.value = makeExecution()
    await expect(
      updateResponse('a', { result: 'FAIL', timestamp: '2025-01-01T00:00:00.000Z' }),
    ).rejects.toThrow()
  })

  it('updateResponse and passAll no-op when execution is null', async () => {
    const items = ref(makeItems())
    const { execution, updateResponse, passAll } = useChecklist({ items })
    expect(execution.value).toBeNull()
    await updateResponse('a', { result: 'PASS', timestamp: '2025-01-01T00:00:00.000Z' })
    await passAll()
    expect(execution.value).toBeNull()
  })

  it('scrollToNextFailed is a no-op when there are no failed items', () => {
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
    const items = ref(makeItems())
    const { execution, scrollToNextFailed } = useChecklist({ items })
    execution.value = makeExecution({
      responses: [{ itemId: 'a', result: 'PASS', timestamp: '2025-01-01T00:00:00.000Z' }],
    })
    scrollToNextFailed()
    expect(scroll).not.toHaveBeenCalled()
  })

  it('scrollToNextUnanswered is a no-op when every item has a response', () => {
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
    const items = ref(makeItems())
    const { execution, scrollToNextUnanswered } = useChecklist({ items })
    execution.value = makeExecution({
      responses: [
        { itemId: 'a', result: 'PASS', timestamp: '2025-01-01T00:00:00.000Z' },
        { itemId: 'b', result: 'PASS', timestamp: '2025-01-01T00:00:00.000Z' },
        { itemId: 'c', result: 'NA', timestamp: '2025-01-01T00:00:00.000Z' },
      ],
    })
    scrollToNextUnanswered()
    expect(scroll).not.toHaveBeenCalled()
  })

  it('scrollToNextFailed falls back to first failed when last scroll id is no longer failed', async () => {
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
    const items = ref(makeItems())
    const { execution, scrollToNextFailed, updateResponse } = useChecklist({ items })
    execution.value = makeExecution({
      responses: [
        {
          itemId: 'a',
          result: 'FAIL',
          codeReference: codeRef,
          timestamp: '2025-01-01T00:00:00.000Z',
        },
        {
          itemId: 'b',
          result: 'FAIL',
          codeReference: codeRef,
          timestamp: '2025-01-01T00:00:00.000Z',
        },
      ],
    })
    for (const id of ['a', 'b']) {
      const d = document.createElement('div')
      d.id = `${CHECKLIST_ITEM_ANCHOR_PREFIX}${id}`
      document.body.appendChild(d)
    }
    scrollToNextFailed()
    await updateResponse('a', { result: 'PASS', timestamp: '2025-01-01T01:00:00.000Z' })
    scrollToNextFailed()
    expect(scroll.mock.calls.length).toBe(2)
  })

  it('scrollToNextUnanswered falls back when last scroll id was answered', async () => {
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
    const items = ref(makeItems())
    const { execution, scrollToNextUnanswered, updateResponse } = useChecklist({ items })
    execution.value = makeExecution()
    for (const id of ['a', 'b', 'c']) {
      const d = document.createElement('div')
      d.id = `${CHECKLIST_ITEM_ANCHOR_PREFIX}${id}`
      document.body.appendChild(d)
    }
    scrollToNextUnanswered()
    scrollToNextUnanswered()
    await updateResponse('b', { result: 'PASS', timestamp: '2025-01-01T00:00:00.000Z' })
    scrollToNextUnanswered()
    expect(scroll.mock.calls.length).toBe(3)
  })

  it('getMandatoryPhotoViolations lists all FAIL rows without photos', () => {
    const items: ChecklistItemDTO[] = [
      { id: 'a', order: 1, text: 'Q1', isRequired: true, requiresPhoto: true },
      { id: 'b', order: 2, text: 'Q2', isRequired: true, requiresPhoto: false },
    ]
    const responses = [
      {
        itemId: 'a',
        result: 'FAIL' as const,
        codeReference: codeRef,
        timestamp: '2025-01-01T00:00:00.000Z',
      },
      {
        itemId: 'b',
        result: 'FAIL' as const,
        codeReference: codeRef,
        timestamp: '2025-01-01T00:00:00.000Z',
      },
    ]
    expect(getMandatoryPhotoViolations(items, responses, {}).map((i) => i.id)).toEqual(['a', 'b'])
    expect(getMandatoryPhotoViolations(items, responses, { a: 1, b: 1 })).toHaveLength(0)
    expect(getMandatoryPhotoViolations(items, responses, { b: 1 }).map((i) => i.id)).toEqual(['a'])
  })

  it('mandatoryPhotoViolations tracks photoCountsByItemId ref (M7-S16)', () => {
    const items = ref<ChecklistItemDTO[]>([
      { id: 'a', order: 1, text: 'Q1', isRequired: true, requiresPhoto: true },
      { id: 'b', order: 2, text: 'Q2', isRequired: true, requiresPhoto: false },
      { id: 'c', order: 3, text: 'Q3', isRequired: false, requiresPhoto: false },
    ])
    const photoCountsByItemId = ref<Record<string, number>>({})
    const { execution, mandatoryPhotoViolations } = useChecklist({ items, photoCountsByItemId })
    execution.value = makeExecution({
      responses: [
        {
          itemId: 'a',
          result: 'FAIL',
          codeReference: codeRef,
          timestamp: '2025-01-01T00:00:00.000Z',
        },
        { itemId: 'b', result: 'PASS', timestamp: '2025-01-01T00:00:00.000Z' },
      ],
    })
    expect(mandatoryPhotoViolations.value.map((i) => i.id)).toEqual(['a'])
    photoCountsByItemId.value = { a: 1 }
    expect(mandatoryPhotoViolations.value).toHaveLength(0)
  })

  it('resets scroll cursor when execution id changes', () => {
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
    const items = ref(makeItems())
    const { execution, scrollToNextFailed } = useChecklist({ items })
    execution.value = makeExecution({
      id: 'e1',
      responses: [
        {
          itemId: 'a',
          result: 'FAIL',
          codeReference: codeRef,
          timestamp: '2025-01-01T00:00:00.000Z',
        },
        {
          itemId: 'b',
          result: 'FAIL',
          codeReference: codeRef,
          timestamp: '2025-01-01T00:00:00.000Z',
        },
      ],
    })
    const a = document.createElement('div')
    a.id = `${CHECKLIST_ITEM_ANCHOR_PREFIX}a`
    const b = document.createElement('div')
    b.id = `${CHECKLIST_ITEM_ANCHOR_PREFIX}b`
    document.body.append(a, b)
    scrollToNextFailed()
    scrollToNextFailed()
    execution.value = makeExecution({
      id: 'e2',
      responses: [
        {
          itemId: 'a',
          result: 'FAIL',
          codeReference: codeRef,
          timestamp: '2025-01-01T00:00:00.000Z',
        },
        {
          itemId: 'b',
          result: 'FAIL',
          codeReference: codeRef,
          timestamp: '2025-01-01T00:00:00.000Z',
        },
      ],
    })
    scrollToNextFailed()
    expect(scroll).toHaveBeenCalled()
  })
})
