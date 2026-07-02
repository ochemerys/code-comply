/**
 * useChecklist — checklist execution state and field operations (M5-S6).
 * Aligns with ChecklistExecutionDTO / ChecklistItemDTO from @codecomply/validators.
 */

import {
  computed,
  ref,
  watch,
  type ComputedRef,
  type Ref,
  toValue,
  type MaybeRefOrGetter,
} from 'vue'
import {
  ChecklistResponseDTOSchema,
  computeChecklistExecutionProgress,
  type ChecklistExecutionDTO,
  type ChecklistItemDTO,
  type ChecklistResponseDTO,
} from '@codecomply/validators'

/**
 * Failed checklist rows that require at least one evidence photo but have none (M7-S16, M-05).
 * Every FAIL result must carry photo evidence before the inspection can be completed.
 */
export function getMandatoryPhotoViolations(
  items: ChecklistItemDTO[],
  responses: ChecklistResponseDTO[],
  photoCountByItemId: Record<string, number>,
): ChecklistItemDTO[] {
  const itemById = new Map(items.map((i) => [i.id, i]))
  const out: ChecklistItemDTO[] = []
  for (const r of responses) {
    if (r.result !== 'FAIL') continue
    const item = itemById.get(r.itemId)
    if (!item) continue
    if ((photoCountByItemId[r.itemId] ?? 0) < 1) out.push(item)
  }
  return out
}

/** DOM id prefix for checklist rows; use `id={CHECKLIST_ITEM_ANCHOR_PREFIX + item.id}` in templates */
export const CHECKLIST_ITEM_ANCHOR_PREFIX = 'checklist-item-'

/** Execution aggregate (API / offline sync shape) */
export type ChecklistExecution = ChecklistExecutionDTO

/** Template line item */
export type ChecklistItem = ChecklistItemDTO

/** Payload for updateResponse (itemId is passed separately) */
export type ChecklistResponseInput = Omit<ChecklistResponseDTO, 'itemId'>

export interface UseChecklistOptions {
  /** Template items; order drives "next" scroll within failed / unanswered */
  items: MaybeRefOrGetter<ChecklistItemDTO[]>
  /** Count of LocalPhoto rows per checklist item id (inspection-scoped); drives M7-S16 validation */
  photoCountsByItemId?: MaybeRefOrGetter<Record<string, number>>
}

export interface UseChecklistReturn {
  execution: Ref<ChecklistExecutionDTO | null>
  progress: ComputedRef<number>
  failedItems: ComputedRef<ChecklistItemDTO[]>
  unansweredItems: ComputedRef<ChecklistItemDTO[]>
  passedCount: ComputedRef<number>
  failedCount: ComputedRef<number>
  naCount: ComputedRef<number>
  unansweredCount: ComputedRef<number>
  isComplete: ComputedRef<boolean>
  updateResponse: (itemId: string, response: ChecklistResponseInput) => Promise<void>
  passAll: () => Promise<void>
  nextFailedId: () => string | null
  scrollToNextFailed: () => void
  scrollToNextUnanswered: () => void
  /** Items with FAIL + requiresPhoto and no stored photo for that checklist line */
  mandatoryPhotoViolations: ComputedRef<ChecklistItemDTO[]>
}

export function useChecklist(options: UseChecklistOptions): UseChecklistReturn {
  const execution = ref<ChecklistExecutionDTO | null>(null)
  const itemsList = computed(() => toValue(options.items))
  const photoCounts = computed(() => toValue(options.photoCountsByItemId ?? {}))

  let lastFailedScrollId: string | null = null
  let lastUnansweredScrollId: string | null = null

  watch(
    () => execution.value?.id,
    () => {
      lastFailedScrollId = null
      lastUnansweredScrollId = null
    },
  )

  const progress = computed(() => {
    if (!execution.value) return 0
    return computeChecklistExecutionProgress(itemsList.value, execution.value.responses)
  })

  const failedItems = computed(() => {
    const ex = execution.value
    if (!ex) return []
    const failedIds = new Set(ex.responses.filter((r) => r.result === 'FAIL').map((r) => r.itemId))
    return itemsList.value.filter((item) => failedIds.has(item.id))
  })

  const unansweredItems = computed(() => {
    const ex = execution.value
    const responded = new Set(ex?.responses.map((r) => r.itemId) ?? [])
    return itemsList.value.filter((item) => !responded.has(item.id))
  })

  const passedCount = computed(() => {
    const ex = execution.value
    if (!ex) return 0
    return ex.responses.filter((r) => r.result === 'PASS').length
  })

  const failedCount = computed(() => {
    return failedItems.value.length
  })

  const naCount = computed(() => {
    const ex = execution.value
    if (!ex) return 0
    return ex.responses.filter((r) => r.result === 'NA').length
  })

  const unansweredCount = computed(() => {
    return unansweredItems.value.length
  })

  const isComplete = computed(() => {
    if (!execution.value) return false
    return progress.value === 100
  })

  const mandatoryPhotoViolations = computed(() => {
    const ex = execution.value
    if (!ex) return []
    return getMandatoryPhotoViolations(itemsList.value, ex.responses, photoCounts.value)
  })

  function recomputeProgress(responses: ChecklistResponseDTO[]): number {
    return computeChecklistExecutionProgress(itemsList.value, responses)
  }

  async function updateResponse(itemId: string, response: ChecklistResponseInput) {
    const ex = execution.value
    if (!ex) return
    const timestamp = response.timestamp ?? new Date().toISOString()
    const merged: ChecklistResponseDTO = { itemId, ...response, timestamp }
    ChecklistResponseDTOSchema.parse(merged)
    const next = [...ex.responses.filter((r) => r.itemId !== itemId), merged]
    execution.value = {
      ...ex,
      responses: next,
      progress: recomputeProgress(next),
    }
  }

  async function passAll() {
    const ex = execution.value
    if (!ex) return
    const ts = new Date().toISOString()
    const next: ChecklistResponseDTO[] = itemsList.value.map((item) => ({
      itemId: item.id,
      result: 'PASS',
      timestamp: ts,
    }))
    execution.value = {
      ...ex,
      responses: next,
      progress: recomputeProgress(next),
    }
  }

  function scrollToItem(itemId: string) {
    if (typeof document === 'undefined') return
    const el = document.getElementById(`${CHECKLIST_ITEM_ANCHOR_PREFIX}${itemId}`)
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
  }

  function nextFailedId(): string | null {
    const order = itemsList.value.map((i) => i.id)
    const failedSet = new Set(failedItems.value.map((i) => i.id))
    const failedOrder = order.filter((id) => failedSet.has(id))
    if (failedOrder.length === 0) return null
    let idx = 0
    if (lastFailedScrollId !== null) {
      const cur = failedOrder.indexOf(lastFailedScrollId)
      idx = cur >= 0 ? (cur + 1) % failedOrder.length : 0
    }
    const target = failedOrder[idx]!
    lastFailedScrollId = target
    return target
  }

  function scrollToNextFailed() {
    const target = nextFailedId()
    if (!target) return
    scrollToItem(target)
  }

  function scrollToNextUnanswered() {
    const order = itemsList.value.map((i) => i.id)
    const unansweredSet = new Set(unansweredItems.value.map((i) => i.id))
    const unansweredOrder = order.filter((id) => unansweredSet.has(id))
    if (unansweredOrder.length === 0) return
    let idx = 0
    if (lastUnansweredScrollId !== null) {
      const cur = unansweredOrder.indexOf(lastUnansweredScrollId)
      idx = cur >= 0 ? (cur + 1) % unansweredOrder.length : 0
    }
    const target = unansweredOrder[idx]!
    lastUnansweredScrollId = target
    scrollToItem(target)
  }

  return {
    execution,
    progress,
    failedItems,
    unansweredItems,
    passedCount,
    failedCount,
    naCount,
    unansweredCount,
    isComplete,
    updateResponse,
    passAll,
    nextFailedId,
    scrollToNextFailed,
    scrollToNextUnanswered,
    mandatoryPhotoViolations,
  }
}
