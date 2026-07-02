<script setup lang="ts">
/**
 * ChecklistExecutionView — main checklist execution UI (M5-S8).
 * Progress, category grouping, virtualized list, offline-friendly auto-save, scroll restore.
 */
import { BottomSheet } from '@codecomply/ui'
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { useOnline, useDebounceFn, useEventListener } from '@vueuse/core'
import {
  ChecklistExecutionDTOSchema,
  ChecklistTemplateDTOSchema,
  computeChecklistExecutionProgress,
  type ChecklistExecutionDTO,
  type ChecklistItemDTO,
  type CodeReferenceDTO,
  type CreateDeficiencyDTO,
} from '@codecomply/validators'
import PassAllButton from '@/components/PassAllButton.vue'
import NextFailedButton from '@/components/NextFailedButton.vue'
import ChecklistFilter, { type ChecklistFilterMode } from '@/components/ChecklistFilter.vue'
import CodeReferenceModal from '@/components/CodeReferenceModal.vue'
import DeficiencyForm from '@/components/DeficiencyForm.vue'
import type { DeficiencyFormPayload } from '@/components/deficiency-form.types'
import { useDeficiencyMutation } from '@/composables/useDeficiencyMutation'
import { useDeficiencies } from '@/composables/useDeficiencies'
import DeficiencyIndicator from '@/components/DeficiencyIndicator.vue'
import PhotoGallery from '@/components/PhotoGallery.vue'
import InspectionTimer from '@/components/InspectionTimer.vue'
import {
  CHECKLIST_ITEM_ANCHOR_PREFIX,
  useChecklist,
  type ChecklistResponseInput,
} from '@/composables/useChecklist'
import { useInspectionTimer } from '@/composables/useInspectionTimer'
import { useInspectionReadOnly } from '@/composables/useInspectionReadOnly'
import { useOfflineChecklists } from '@/composables/useOfflineChecklists'
import {
  isChecklistTemplateUnavailableError,
  loadChecklistExecutionFromStorage,
  loadExecutionTemplateRef,
  mergeChecklistExecutionResponses,
  migrateChecklistExecutionFromLocalStorage,
  persistChecklistExecutionState,
} from '@/lib/db/checklist-storage'
import { syncAssignedPermitsFromApi } from '@/lib/db/assigned-permits-sync'
import { db } from '@/lib/db/dexie'
import type { CodeReference } from '@/lib/db/types'
import { getApiBaseUrl } from '@/lib/api-base'
import { apiFetch } from '@/utils/api-error-handler'

function apiPrefix(): string {
  const base = getApiBaseUrl()
  return base ? `${base}/api` : '/api'
}

const route = useRoute()
const router = useRouter()
const online = useOnline()

const inspectionId = computed(() => String(route.params.inspectionId ?? ''))
const executionId = computed(() => String(route.params.executionId ?? ''))

const { isReadOnlyAfterSync } = useInspectionReadOnly({ inspectionId })

/** Passed into capture-photo query so Accept can navigate back with required checklist params (M7-S11-B1). */
const checklistCaptureReturnQuery = computed((): Record<string, string> => {
  const insp = inspectionId.value.trim()
  const exec = executionId.value.trim()
  if (!insp || !exec) return {}
  const q: Record<string, string> = { inspectionId: insp, executionId: exec }
  const fp = route.query.fromPermit
  if (typeof fp === 'string' && fp.trim().length > 0) q.fromPermit = fp.trim()
  return q
})

const STORAGE_PREFIX = 'checklist-execution-draft-'
const SCROLL_PREFIX = 'checklist-execution-scroll-'
const FILTER_PREFIX = 'checklist-execution-filter-'

const templateItems = ref<ChecklistItemDTO[]>([])
const templateUnavailable = ref(false)
const templateDownloadLoading = ref(false)
const templateDownloadError = ref<string | null>(null)

const offlineChecklists = useOfflineChecklists()
const { createDeficiency } = useDeficiencyMutation()
const { deficiencies } = useDeficiencies({ inspectionId })

const photoCountsByItemId = ref<Record<string, number>>({})

const {
  execution,
  progress,
  updateResponse,
  passAll,
  failedItems,
  isComplete,
  mandatoryPhotoViolations,
  nextFailedId,
} = useChecklist({
  items: templateItems,
  photoCountsByItemId,
})

const mandatoryPhotoViolationIdSet = computed(
  () => new Set(mandatoryPhotoViolations.value.map((i) => i.id)),
)

async function refreshPhotoCounts() {
  const id = inspectionId.value
  if (!id) {
    photoCountsByItemId.value = {}
    return
  }
  try {
    const rows = await db.photos.where('inspectionId').equals(id).toArray()
    const counts: Record<string, number> = {}
    for (const p of rows) {
      const cid = p.checklistItemId
      if (!cid) continue
      counts[cid] = (counts[cid] ?? 0) + 1
    }
    photoCountsByItemId.value = counts
  } catch {
    photoCountsByItemId.value = {}
  }
}

provide('refreshChecklistPhotoCounts', refreshPhotoCounts)

const executionReady = ref(false)
const savedDurationSeconds = ref<number | undefined>()

const {
  displayTime,
  isRunning,
  stop: stopInspectionTimer,
} = useInspectionTimer({
  inspectionId,
  executionCompletedAt: computed(() => execution.value?.completedAt),
  executionReady: computed(() => executionReady.value && execution.value != null),
  savedDurationSeconds,
})

function applyStoredTimerCompletion(ex: ChecklistExecutionDTO): ChecklistExecutionDTO {
  // completedAt must come from persisted execution/API — not inferred from the timer LS,
  // which can mark completed independently and would disable Complete prematurely (M7-S18 E2E).
  return ex
}

const filterMode = ref<ChecklistFilterMode>('all')
const saveStatus = ref<'idle' | 'saving' | 'saved'>('idle')
const codeRefModalOpen = ref(false)
const failTargetItem = ref<ChecklistItemDTO | null>(null)

/** M6-S13: deficiency form opens when the inspector chooses **Record deficiency** (not auto after code pick). */
const failDeficiencyModalOpen = ref(false)
const failDeficiencyItem = ref<ChecklistItemDTO | null>(null)
const failDeficiencyCode = ref<CodeReference | null>(null)
const failModalSubmitError = ref<string | null>(null)

const failDeficiencyCodeDto = computed((): CodeReferenceDTO | undefined => {
  const ref = failDeficiencyCode.value
  if (!ref?.code?.trim() || !ref?.section?.trim()) return undefined
  return {
    code: ref.code,
    section: ref.section,
    ...(ref.title ? { title: ref.title } : {}),
  }
})

const isFailDeficiencySubmitting = computed(() => createDeficiency.isPending.value)

type DisplayRow =
  | { kind: 'header'; category: string; key: string }
  | { kind: 'item'; item: ChecklistItemDTO; key: string }

const storageKey = computed(() => `${STORAGE_PREFIX}${executionId.value}`)
const scrollKey = computed(() => `${SCROLL_PREFIX}${executionId.value}`)
const filterKey = computed(() => `${FILTER_PREFIX}${executionId.value}`)

function parseStoredFilter(raw: string | null): ChecklistFilterMode | null {
  if (!raw) return null
  if (raw === 'all' || raw === 'failed' || raw === 'unanswered') return raw
  return null
}

function loadStoredFilter(): ChecklistFilterMode {
  if (typeof localStorage === 'undefined') return 'all'
  return parseStoredFilter(localStorage.getItem(filterKey.value)) ?? 'all'
}

function persistFilter() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(filterKey.value, filterMode.value)
  } catch {
    // ignore storage failures
  }
}

function createEmptyExecution(templateId: string, versionHash: string): ChecklistExecutionDTO {
  return {
    id: executionId.value,
    inspectionId: inspectionId.value,
    templateId,
    versionHash,
    responses: [],
    progress: 0,
  }
}

const displayRows = computed((): DisplayRow[] => {
  const ex = execution.value
  const items = templateItems.value
  const failedIds = new Set(
    ex?.responses.filter((r) => r.result === 'FAIL').map((r) => r.itemId) ?? [],
  )
  const answeredIds = new Set(ex?.responses.map((r) => r.itemId) ?? [])
  const byCat = new Map<string, ChecklistItemDTO[]>()
  for (const it of items) {
    const cat = it.category?.trim() || 'Uncategorized'
    if (!byCat.has(cat)) byCat.set(cat, [])
    byCat.get(cat)!.push(it)
  }
  const categories = [...byCat.keys()].sort((a, b) => a.localeCompare(b))
  const rows: DisplayRow[] = []
  for (const cat of categories) {
    let list = byCat.get(cat)!
    if (filterMode.value === 'failed') list = list.filter((i) => failedIds.has(i.id))
    if (filterMode.value === 'unanswered') list = list.filter((i) => !answeredIds.has(i.id))
    if (list.length === 0) continue
    rows.push({ kind: 'header', category: cat, key: `h-${cat}` })
    for (const item of list.sort((a, b) => a.order - b.order)) {
      rows.push({ kind: 'item', item, key: `i-${item.id}` })
    }
  }
  return rows
})

const failedCount = computed(() => failedItems.value.length)
const unansweredCount = computed(() => {
  const answeredIds = new Set(execution.value?.responses.map((r) => r.itemId) ?? [])
  return templateItems.value.filter((i) => !answeredIds.has(i.id)).length
})

const showEmptyState = computed(() => {
  if (filterMode.value === 'all') return false
  const hasAnyItems = displayRows.value.some((r) => r.kind === 'item')
  return !hasAnyItems
})

const scrollParentRef = ref<HTMLElement | null>(null)

/** Large lists use TanStack Virtual; jsdom has no layout so Vitest always uses simple list */
const VIRTUAL_ROW_THRESHOLD = 80
const useVirtualList = computed(
  () => displayRows.value.length > VIRTUAL_ROW_THRESHOLD && !import.meta.env.VITEST,
)

const virtualizer = useVirtualizer(
  computed(() => ({
    getScrollElement: () => scrollParentRef.value,
    count: displayRows.value.length,
    estimateSize: (index: number) => (displayRows.value[index]?.kind === 'header' ? 44 : 148),
    overscan: 6,
  })),
)

const virtualItems = computed(() =>
  useVirtualList.value ? virtualizer.value.getVirtualItems() : [],
)
const totalSize = computed(() => (useVirtualList.value ? virtualizer.value.getTotalSize() : 0))

function getRow(index: number): DisplayRow | undefined {
  return displayRows.value[index]
}

function categoryHeading(index: number): string {
  const r = getRow(index)
  return r?.kind === 'header' ? r.category : ''
}

function itemRow(index: number): ChecklistItemDTO | null {
  const r = getRow(index)
  return r?.kind === 'item' ? r.item : null
}

function responseForItem(itemId: string) {
  return execution.value?.responses.find((r) => r.itemId === itemId)
}

function showEvidenceGallery(item: ChecklistItemDTO): boolean {
  const resp = responseForItem(item.id)
  return Boolean(item.requiresPhoto || resp?.result === 'FAIL')
}

/** When the gallery is gated off, explain how to surface Add / Library (M7-I1-B1). */
function showChecklistEvidencePhotoHint(item: ChecklistItemDTO): boolean {
  const id = inspectionId.value.trim()
  if (!id) return false
  return !showEvidenceGallery(item)
}

async function onPass(item: ChecklistItemDTO) {
  if (isReadOnlyAfterSync.value) return
  const ts = new Date().toISOString()
  await updateResponse(item.id, { result: 'PASS', timestamp: ts })
  await saveChecklistDraftNow()
}

async function onNa(item: ChecklistItemDTO) {
  if (isReadOnlyAfterSync.value) return
  const ts = new Date().toISOString()
  await updateResponse(item.id, { result: 'NA', timestamp: ts })
  await saveChecklistDraftNow()
}

function onFail(item: ChecklistItemDTO) {
  if (isReadOnlyAfterSync.value) return
  failTargetItem.value = item
  codeRefModalOpen.value = true
}

async function onCodeReferenceSelected(ref: CodeReference) {
  const item = failTargetItem.value
  if (!item) return
  const ts = new Date().toISOString()
  const input: ChecklistResponseInput = {
    result: 'FAIL',
    codeReference: {
      code: ref.code,
      section: ref.section,
      ...(ref.title ? { title: ref.title } : {}),
    },
    timestamp: ts,
  }
  await updateResponse(item.id, input)
  failTargetItem.value = null
  await saveChecklistDraftNow()
}

function onCodeReferenceCancel() {
  failTargetItem.value = null
}

function closeFailDeficiencyModal() {
  failDeficiencyModalOpen.value = false
  failDeficiencyItem.value = null
  failDeficiencyCode.value = null
  failModalSubmitError.value = null
}

function onFailDeficiencySheetModelUpdate(open: boolean) {
  if (!open) closeFailDeficiencyModal()
}

function openDeficiencyForFailedItem(item: ChecklistItemDTO) {
  const resp = responseForItem(item.id)
  if (resp?.result !== 'FAIL' || !resp.codeReference) return
  failDeficiencyItem.value = item
  failDeficiencyCode.value = {
    code: resp.codeReference.code,
    section: resp.codeReference.section,
    ...(resp.codeReference.title ? { title: resp.codeReference.title } : {}),
  }
  failModalSubmitError.value = null
  failDeficiencyModalOpen.value = true
}

async function onFailDeficiencyFormSubmit(payload: DeficiencyFormPayload) {
  failModalSubmitError.value = null
  try {
    await createDeficiency.mutateAsync({
      clientId: crypto.randomUUID(),
      ...payload,
    } as CreateDeficiencyDTO)
    closeFailDeficiencyModal()
  } catch (e) {
    failModalSubmitError.value = e instanceof Error ? e.message : 'Could not save deficiency.'
  }
}

async function onPassAll() {
  await passAll()
  await saveChecklistDraftNow()
}

async function onCompleteInspection() {
  const ex = execution.value
  if (!ex || ex.completedAt || !isComplete.value || mandatoryPhotoViolations.value.length > 0)
    return
  const durationSeconds = stopInspectionTimer()
  const iso = new Date().toISOString()
  const next = {
    ...ex,
    completedAt: iso,
    progress: ex.progress,
  }
  execution.value = next
  saveStatus.value = 'saving'
  try {
    await persistChecklistExecutionState(next, {
      database: db,
      queueSync: !import.meta.env.VITEST,
    })
    saveStatus.value = 'saved'
  } catch {
    saveStatus.value = 'idle'
  }
  try {
    const row = await db.inspections.get(inspectionId.value)
    if (row) {
      await db.inspections.put({
        ...row,
        durationSeconds,
        updatedAt: iso,
        isDirty: true,
      })
    }
  } catch {
    /* ignore missing inspection row or DB errors */
  }
}

/**
 * M7-S14-B2: do not use `history.back()` — after capture→checklist the stack can still contain capture-photo.
 * Prefer `fromPermit` query (set when opening checklist from permit detail) — local DB rows may omit `permitId`.
 */
async function onBack() {
  const fromPermitRaw = route.query.fromPermit
  const fromPermit =
    typeof fromPermitRaw === 'string' && fromPermitRaw.trim().length > 0
      ? fromPermitRaw.trim()
      : undefined
  if (fromPermit) {
    await router.push({ name: 'permit-detail', params: { id: fromPermit } })
    return
  }

  const inspId = inspectionId.value.trim()
  if (!inspId) {
    await router.push({ name: 'permits' })
    return
  }
  try {
    const row = await db.inspections.get(inspId)
    const permitId = row?.permitId?.trim()
    if (permitId) {
      await router.push({ name: 'permit-detail', params: { id: permitId } })
      return
    }
  } catch {
    /* ignore missing row / DB errors */
  }
  await router.push({ name: 'permits' })
}

/** Open deficiency list for this inspection (create new from list if needed). */
function goToDeficiencyList() {
  const id = inspectionId.value
  if (!id) return
  void router.push({
    name: 'deficiency-list',
    params: { inspectionId: id },
  })
}

function goToReview() {
  const id = inspectionId.value
  const exec = executionId.value.trim()
  if (!id) return
  void router.push({
    name: 'inspection-review',
    params: { inspectionId: id },
    query: exec ? { executionId: exec } : {},
  })
}

/** M6-S14: count deficiencies linked to a checklist line item (local + merged server rows). */
function linkedDeficiencyCountForItem(checklistItemId: string): number {
  return deficiencies.value.filter((d) => d.checklistItemId === checklistItemId).length
}

/** M6-S14: deficiency list filtered to items recorded against this checklist row. */
function goToDeficienciesForChecklistItem(checklistItemId: string) {
  const id = inspectionId.value
  if (!id) return
  void router.push({
    name: 'deficiency-list',
    params: { inspectionId: id },
    query: { checklistItemId },
  })
}

const persistScroll = useDebounceFn(() => {
  const el = scrollParentRef.value
  if (!el || typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(scrollKey.value, String(el.scrollTop))
}, 200)

useEventListener(scrollParentRef, 'scroll', persistScroll)

async function saveChecklistDraftNow(): Promise<void> {
  const ex = execution.value
  if (!ex) return
  saveStatus.value = 'saving'
  try {
    await persistChecklistExecutionState(ex, {
      database: db,
      queueSync: !import.meta.env.VITEST,
    })
    saveStatus.value = 'saved'
  } catch {
    saveStatus.value = 'idle'
  }
}

const persistDraft = useDebounceFn(saveChecklistDraftNow, 400)

watch(
  () => execution.value,
  () => {
    persistDraft()
  },
  { deep: true },
)

watch(
  () => [execution.value, inspectionId.value] as const,
  () => {
    void refreshPhotoCounts()
  },
  { deep: true },
)

async function hydrateChecklistExecution(): Promise<void> {
  const execId = executionId.value.trim()
  const inspId = inspectionId.value.trim()
  if (!execId || !inspId) return

  templateUnavailable.value = false
  templateDownloadError.value = null

  await migrateChecklistExecutionFromLocalStorage(
    storageKey.value,
    {
      executionId: execId,
      inspectionId: inspId,
    },
    { database: db },
  )

  const isLocalExecution = execId.startsWith('local-')

  let remoteExecution: ChecklistExecutionDTO | null = null
  if (online.value && !isLocalExecution) {
    try {
      const res = await apiFetch(
        `${apiPrefix()}/checklists/executions/${encodeURIComponent(execId)}`,
      )
      if (res.ok) {
        remoteExecution = ChecklistExecutionDTOSchema.parse(await res.json())
      }
    } catch {
      /* offline or network error — resolve from cache only */
    }
  }

  try {
    const { templateId, versionHash } = await loadExecutionTemplateRef(execId, {
      database: db,
      remote: remoteExecution,
    })
    const inspectionIdResolved = remoteExecution?.inspectionId ?? inspId

    const tpl = await offlineChecklists.resolveTemplate({
      templateId,
      expectedVersionHash: versionHash,
      fetchLive:
        online.value && !isLocalExecution
          ? async () => {
              const tr = await apiFetch(
                `${apiPrefix()}/checklists/templates/${encodeURIComponent(templateId)}`,
              )
              if (!tr.ok) {
                throw new Error((await tr.text()) || 'Template fetch failed')
              }
              return ChecklistTemplateDTOSchema.parse(await tr.json())
            }
          : undefined,
    })

    templateItems.value = tpl.items

    const stored = await loadChecklistExecutionFromStorage(
      {
        id: execId,
        inspectionId: inspectionIdResolved,
        templateId: tpl.id,
        versionHash: tpl.versionHash,
      },
      tpl.items,
    )

    const emptyBase = createEmptyExecution(tpl.id, tpl.versionHash)
    let merged: ChecklistExecutionDTO
    if (remoteExecution) {
      const useStoredResponses =
        remoteExecution.responses.length === 0 && stored.responses.length > 0
      merged = useStoredResponses
        ? {
            ...stored,
            id: execId,
            inspectionId: inspId,
            templateId: tpl.id,
            versionHash: tpl.versionHash,
          }
        : ChecklistExecutionDTOSchema.parse({
            ...remoteExecution,
            responses: mergeChecklistExecutionResponses(
              remoteExecution.responses,
              stored.responses,
            ),
            templateId: tpl.id,
            versionHash: tpl.versionHash,
          })
    } else if (stored.responses.length > 0) {
      merged = {
        ...stored,
        id: execId,
        inspectionId: inspId,
        templateId: tpl.id,
        versionHash: tpl.versionHash,
      }
    } else {
      merged = {
        ...emptyBase,
        id: execId,
        inspectionId: inspId,
        templateId: tpl.id,
        versionHash: tpl.versionHash,
      }
    }

    const storedProgress = computeChecklistExecutionProgress(tpl.items, stored.responses)
    const mergedProgress = computeChecklistExecutionProgress(tpl.items, merged.responses)
    const requiredIds = new Set(tpl.items.filter((i) => i.isRequired !== false).map((i) => i.id))
    const countRequired = (responses: ChecklistExecutionDTO['responses']) =>
      responses.filter((r) => requiredIds.has(r.itemId)).length
    if (
      storedProgress > mergedProgress ||
      countRequired(stored.responses) > countRequired(merged.responses)
    ) {
      merged = {
        ...merged,
        responses: stored.responses,
        progress: storedProgress,
      }
    }

    execution.value = applyStoredTimerCompletion(merged)
  } catch (e) {
    templateItems.value = []
    execution.value = null
    if (isChecklistTemplateUnavailableError(e)) {
      templateUnavailable.value = true
    } else {
      templateUnavailable.value = true
      templateDownloadError.value =
        e instanceof Error ? e.message : 'Could not load checklist template.'
    }
  }
}

async function onDownloadTemplate(): Promise<void> {
  if (!online.value || templateDownloadLoading.value) return
  templateDownloadLoading.value = true
  templateDownloadError.value = null
  try {
    await syncAssignedPermitsFromApi()
    await hydrateChecklistExecution()
  } catch (e) {
    templateDownloadError.value =
      e instanceof Error ? e.message : 'Could not download checklist template.'
    templateUnavailable.value = true
  } finally {
    templateDownloadLoading.value = false
  }
}

onBeforeRouteLeave(async () => {
  await saveChecklistDraftNow()
  return true
})

onBeforeUnmount(() => {
  void saveChecklistDraftNow()
})

onMounted(() => {
  filterMode.value = loadStoredFilter()

  void (async () => {
    await hydrateChecklistExecution()

    try {
      const insp = await db.inspections.get(inspectionId.value)
      savedDurationSeconds.value = insp?.durationSeconds
    } catch {
      savedDurationSeconds.value = undefined
    }

    executionReady.value = true
    await refreshPhotoCounts()

    requestAnimationFrame(() => {
      const el = scrollParentRef.value
      if (!el || typeof sessionStorage === 'undefined') return
      const raw = sessionStorage.getItem(scrollKey.value)
      if (raw != null) {
        const y = parseInt(raw, 10)
        if (!Number.isNaN(y)) el.scrollTop = y
      }
    })
  })()
})

watch(
  () => filterMode.value,
  () => {
    persistFilter()
  },
)
</script>

<template>
  <div
    class="h-full min-h-0 flex flex-col bg-bg-app text-text-primary"
    data-testid="checklist-execution-view"
  >
    <!-- Header: progress, filters, Pass all -->
    <header
      class="flex-shrink-0 px-4 pt-3 pb-3 tablet:px-6 border-b border-border-subtle bg-bg-surface"
      data-testid="checklist-execution-header"
    >
      <div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h1 class="text-lg font-semibold text-text-primary tablet:text-xl truncate min-w-0">
          Inspection checklist
        </h1>
        <div class="flex items-center gap-2 flex-shrink-0 ml-auto">
          <InspectionTimer
            v-if="inspectionId"
            :display-time="displayTime"
            :is-running="isRunning"
          />
          <p
            class="text-sm text-text-secondary tabular-nums"
            data-testid="checklist-progress-percent"
            :aria-label="`Progress ${progress} percent`"
          >
            {{ progress }}%
          </p>
        </div>
      </div>
      <div
        class="h-3 rounded-full bg-bg-elevated overflow-hidden"
        role="progressbar"
        :aria-valuenow="progress"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div
          class="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
          data-testid="checklist-progress-bar"
          :style="{ width: `${progress}%` }"
        />
      </div>
      <div
        v-if="mandatoryPhotoViolations.length > 0"
        class="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
        data-testid="checklist-mandatory-photo-banner"
        role="status"
      >
        {{ mandatoryPhotoViolations.length }}
        checklist
        {{ mandatoryPhotoViolations.length === 1 ? 'item needs' : 'items need' }}
        at least one evidence photo before you can complete the inspection.
      </div>
      <div class="mt-4 flex w-full flex-wrap items-center gap-2">
        <ChecklistFilter
          v-model="filterMode"
          :failed-count="failedCount"
          :unanswered-count="unansweredCount"
        />
        <NextFailedButton
          v-if="!templateUnavailable && failedCount > 0"
          :failed-count="failedCount"
          :next-failed-id="nextFailedId"
          :scroll-container="scrollParentRef"
        />
        <PassAllButton
          v-if="!templateUnavailable && !isReadOnlyAfterSync"
          :count="templateItems.length"
          @confirm="onPassAll"
        />
        <button
          v-if="inspectionId"
          type="button"
          class="ml-auto min-h-touch shrink-0 px-4 rounded-xl border border-border-subtle bg-bg-surface text-base font-medium text-text-primary hover:bg-bg-elevated focus:outline-none focus:ring-2 focus:ring-primary"
          data-testid="checklist-deficiencies"
          title="View deficiencies for this inspection"
          @click="goToDeficiencyList()"
        >
          Deficiencies
        </button>
      </div>
    </header>

    <div
      v-if="isReadOnlyAfterSync"
      class="mx-4 mt-3 rounded-xl border border-border-subtle bg-bg-elevated px-4 py-3 text-sm text-text-primary tablet:mx-6"
      data-testid="inspection-read-only-banner"
      role="status"
    >
      This inspection has been finalized and synced. It’s read-only — contact the back office for an
      addendum to amend the record.
    </div>

    <!-- Scrollable body: simple list (tests / small templates) or virtual (large lists) -->
    <div
      ref="scrollParentRef"
      class="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-hide"
      data-testid="checklist-scroll-region"
    >
      <div
        v-if="templateUnavailable"
        class="w-full max-w-3xl mx-auto px-4 py-10 tablet:px-6"
        data-testid="checklist-template-unavailable"
      >
        <div class="rounded-2xl border border-border-subtle bg-bg-surface p-6">
          <h2 class="text-base font-semibold text-text-primary mb-2">
            Checklist template not available offline
          </h2>
          <p class="text-sm text-text-secondary mb-4">
            Connect to download the template before starting this inspection.
          </p>
          <p
            v-if="templateDownloadError"
            class="mb-4 text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {{ templateDownloadError }}
          </p>
          <button
            type="button"
            class="min-h-touch px-4 rounded-xl bg-primary text-white text-base font-medium hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="checklist-download-template"
            :disabled="!online || templateDownloadLoading"
            @click="onDownloadTemplate"
          >
            {{ templateDownloadLoading ? 'Downloading…' : 'Download template' }}
          </button>
        </div>
      </div>
      <div
        v-else-if="showEmptyState"
        class="w-full max-w-3xl mx-auto px-4 py-10 tablet:px-6"
        data-testid="checklist-empty-state"
      >
        <div class="rounded-2xl border border-border-subtle bg-bg-surface p-6">
          <h2 class="text-base font-semibold text-text-primary mb-2">No items match this filter</h2>
          <p class="text-sm text-text-secondary mb-4">
            {{
              filterMode === 'failed'
                ? 'There are no failed items right now.'
                : 'There are no unanswered items right now.'
            }}
          </p>
          <button
            type="button"
            class="min-h-touch px-4 rounded-xl border border-border-subtle text-base font-medium"
            data-testid="checklist-clear-filter"
            @click="filterMode = 'all'"
          >
            Show all items
          </button>
        </div>
      </div>
      <!-- Non-virtual: reliable in tests and sufficient for typical field checklists -->
      <div
        v-if="!templateUnavailable && !useVirtualList"
        class="w-full max-w-3xl mx-auto px-4 py-3 tablet:px-6"
      >
        <template v-for="row in displayRows" :key="row.key">
          <template v-if="row.kind === 'header'">
            <h2
              class="py-3 text-sm font-semibold uppercase tracking-wide text-text-secondary bg-bg-surface border-b border-border-subtle sticky top-0 z-nav"
              :data-testid="'checklist-category-' + row.category.toLowerCase()"
            >
              {{ row.category }}
            </h2>
          </template>
          <template v-else>
            <article
              :id="CHECKLIST_ITEM_ANCHOR_PREFIX + row.item.id"
              :class="[
                'rounded-xl border bg-bg-surface shadow-sm dark:shadow-none mb-3 p-4',
                mandatoryPhotoViolationIdSet.has(row.item.id)
                  ? 'border-amber-500 ring-2 ring-amber-400/80'
                  : 'border-border-subtle',
              ]"
              :data-testid="'checklist-item-' + row.item.id"
            >
              <p class="text-base text-text-primary leading-snug mb-4">
                {{ row.item.text }}
              </p>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class="min-h-touch min-w-[88px] px-4 rounded-xl bg-emerald-600 text-white text-base font-semibold hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  :data-testid="'checklist-pass-' + row.item.id"
                  :disabled="isReadOnlyAfterSync"
                  @click="onPass(row.item)"
                >
                  Pass
                </button>
                <button
                  type="button"
                  class="min-h-touch min-w-[88px] px-4 rounded-xl bg-rose-600 text-white text-base font-semibold hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  :data-testid="'checklist-fail-' + row.item.id"
                  :disabled="isReadOnlyAfterSync"
                  @click="onFail(row.item)"
                >
                  Fail
                </button>
                <button
                  type="button"
                  class="min-h-touch min-w-[88px] px-4 rounded-xl border-2 border-border-strong text-base font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                  :data-testid="'checklist-na-' + row.item.id"
                  :disabled="isReadOnlyAfterSync"
                  @click="onNa(row.item)"
                >
                  N/A
                </button>
              </div>
              <p
                v-if="responseForItem(row.item.id)"
                class="mt-3 text-sm text-text-secondary"
                :data-testid="'checklist-item-status-' + row.item.id"
              >
                Marked:
                {{ responseForItem(row.item.id)?.result }}
              </p>
              <p
                v-if="
                  responseForItem(row.item.id)?.result === 'FAIL' &&
                  responseForItem(row.item.id)?.codeReference
                "
                class="mt-2 text-sm text-text-primary font-medium"
                :data-testid="'checklist-item-code-ref-' + row.item.id"
              >
                {{ responseForItem(row.item.id)!.codeReference!.code }}
                ·
                {{ responseForItem(row.item.id)!.codeReference!.section }}
              </p>
              <p
                v-if="
                  responseForItem(row.item.id)?.result === 'FAIL' &&
                  linkedDeficiencyCountForItem(row.item.id) === 0
                "
                class="mt-3 text-sm text-text-secondary"
                :data-testid="'checklist-deficiency-hint-' + row.item.id"
              >
                Checklist result is saved. Add a formal deficiency to track follow-up and reporting.
              </p>
              <div
                v-if="
                  responseForItem(row.item.id)?.result === 'FAIL' &&
                  linkedDeficiencyCountForItem(row.item.id) > 0
                "
                class="mt-3"
                :data-testid="'checklist-linked-deficiency-indicator-wrap-' + row.item.id"
              >
                <DeficiencyIndicator
                  class="w-full"
                  :count="linkedDeficiencyCountForItem(row.item.id)"
                  @activate="goToDeficienciesForChecklistItem(row.item.id)"
                />
              </div>
              <button
                v-if="responseForItem(row.item.id)?.result === 'FAIL'"
                type="button"
                class="mt-3 w-full min-h-touch px-4 rounded-xl border border-border-subtle bg-bg-elevated text-base font-medium text-text-primary hover:bg-bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                :data-testid="'checklist-record-deficiency-' + row.item.id"
                @click="openDeficiencyForFailedItem(row.item)"
              >
                {{
                  linkedDeficiencyCountForItem(row.item.id) > 0
                    ? 'Add another deficiency'
                    : 'Record deficiency'
                }}
              </button>
              <p
                v-if="mandatoryPhotoViolationIdSet.has(row.item.id)"
                class="mt-3 text-sm font-medium text-amber-800 dark:text-amber-200"
                :data-testid="'checklist-mandatory-photo-warning-' + row.item.id"
              >
                Add at least one photo for this failed item before you can complete the inspection.
              </p>
              <p
                v-if="showChecklistEvidencePhotoHint(row.item)"
                class="mt-4 text-sm text-text-secondary"
                :data-testid="'checklist-evidence-photo-hint-' + row.item.id"
              >
                Evidence photos appear when you mark
                <span class="font-medium text-text-primary">Fail</span>
                on this line, or when the template marks this line as photo-required.
              </p>
              <PhotoGallery
                v-if="inspectionId && showEvidenceGallery(row.item)"
                class="mt-4"
                :inspection-id="inspectionId"
                :checklist-item-id="row.item.id"
                capture-return-route="checklist-execution"
                :capture-return-route-query="checklistCaptureReturnQuery"
                @photos-updated="refreshPhotoCounts"
              />
            </article>
          </template>
        </template>
      </div>

      <!-- Virtualized rows for very large templates -->
      <div
        v-else-if="!templateUnavailable"
        class="relative w-full max-w-3xl mx-auto px-4 py-3 tablet:px-6"
        :style="{ height: `${totalSize}px` }"
      >
        <div
          v-for="v in virtualItems"
          :key="String(v.key)"
          class="absolute left-0 top-0 w-full box-border"
          :style="{
            transform: `translateY(${v.start}px)`,
          }"
        >
          <template v-if="getRow(v.index)?.kind === 'header'">
            <h2
              class="py-3 text-sm font-semibold uppercase tracking-wide text-text-secondary bg-bg-surface border-b border-border-subtle"
              :data-testid="'checklist-category-' + categoryHeading(v.index).toLowerCase()"
            >
              {{ categoryHeading(v.index) }}
            </h2>
          </template>
          <template v-else-if="itemRow(v.index)">
            <article
              :id="CHECKLIST_ITEM_ANCHOR_PREFIX + itemRow(v.index)!.id"
              :class="[
                'rounded-xl border bg-bg-surface shadow-sm dark:shadow-none mb-3 p-4',
                mandatoryPhotoViolationIdSet.has(itemRow(v.index)!.id)
                  ? 'border-amber-500 ring-2 ring-amber-400/80'
                  : 'border-border-subtle',
              ]"
              :data-testid="'checklist-item-' + itemRow(v.index)!.id"
            >
              <p class="text-base text-text-primary leading-snug mb-4">
                {{ itemRow(v.index)!.text }}
              </p>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class="min-h-touch min-w-[88px] px-4 rounded-xl bg-emerald-600 text-white text-base font-semibold hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  :data-testid="'checklist-pass-' + itemRow(v.index)!.id"
                  :disabled="isReadOnlyAfterSync"
                  @click="onPass(itemRow(v.index)!)"
                >
                  Pass
                </button>
                <button
                  type="button"
                  class="min-h-touch min-w-[88px] px-4 rounded-xl bg-rose-600 text-white text-base font-semibold hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  :data-testid="'checklist-fail-' + itemRow(v.index)!.id"
                  :disabled="isReadOnlyAfterSync"
                  @click="onFail(itemRow(v.index)!)"
                >
                  Fail
                </button>
                <button
                  type="button"
                  class="min-h-touch min-w-[88px] px-4 rounded-xl border-2 border-border-strong text-base font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                  :data-testid="'checklist-na-' + itemRow(v.index)!.id"
                  :disabled="isReadOnlyAfterSync"
                  @click="onNa(itemRow(v.index)!)"
                >
                  N/A
                </button>
              </div>
              <p
                v-if="responseForItem(itemRow(v.index)!.id)"
                class="mt-3 text-sm text-text-secondary"
                :data-testid="'checklist-item-status-' + itemRow(v.index)!.id"
              >
                Marked:
                {{ responseForItem(itemRow(v.index)!.id)?.result }}
              </p>
              <p
                v-if="
                  responseForItem(itemRow(v.index)!.id)?.result === 'FAIL' &&
                  responseForItem(itemRow(v.index)!.id)?.codeReference
                "
                class="mt-2 text-sm text-text-primary font-medium"
                :data-testid="'checklist-item-code-ref-' + itemRow(v.index)!.id"
              >
                {{ responseForItem(itemRow(v.index)!.id)!.codeReference!.code }}
                ·
                {{ responseForItem(itemRow(v.index)!.id)!.codeReference!.section }}
              </p>
              <p
                v-if="
                  responseForItem(itemRow(v.index)!.id)?.result === 'FAIL' &&
                  linkedDeficiencyCountForItem(itemRow(v.index)!.id) === 0
                "
                class="mt-3 text-sm text-text-secondary"
                :data-testid="'checklist-deficiency-hint-' + itemRow(v.index)!.id"
              >
                Checklist result is saved. Add a formal deficiency to track follow-up and reporting.
              </p>
              <div
                v-if="
                  responseForItem(itemRow(v.index)!.id)?.result === 'FAIL' &&
                  linkedDeficiencyCountForItem(itemRow(v.index)!.id) > 0
                "
                class="mt-3"
                :data-testid="'checklist-linked-deficiency-indicator-wrap-' + itemRow(v.index)!.id"
              >
                <DeficiencyIndicator
                  class="w-full"
                  :count="linkedDeficiencyCountForItem(itemRow(v.index)!.id)"
                  @activate="goToDeficienciesForChecklistItem(itemRow(v.index)!.id)"
                />
              </div>
              <button
                v-if="responseForItem(itemRow(v.index)!.id)?.result === 'FAIL'"
                type="button"
                class="mt-3 w-full min-h-touch px-4 rounded-xl border border-border-subtle bg-bg-elevated text-base font-medium text-text-primary hover:bg-bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                :data-testid="'checklist-record-deficiency-' + itemRow(v.index)!.id"
                @click="openDeficiencyForFailedItem(itemRow(v.index)!)"
              >
                {{
                  linkedDeficiencyCountForItem(itemRow(v.index)!.id) > 0
                    ? 'Add another deficiency'
                    : 'Record deficiency'
                }}
              </button>
              <p
                v-if="mandatoryPhotoViolationIdSet.has(itemRow(v.index)!.id)"
                class="mt-3 text-sm font-medium text-amber-800 dark:text-amber-200"
                :data-testid="'checklist-mandatory-photo-warning-' + itemRow(v.index)!.id"
              >
                Add at least one photo for this failed item before you can complete the inspection.
              </p>
              <p
                v-if="showChecklistEvidencePhotoHint(itemRow(v.index)!)"
                class="mt-4 text-sm text-text-secondary"
                :data-testid="'checklist-evidence-photo-hint-' + itemRow(v.index)!.id"
              >
                Evidence photos appear when you mark
                <span class="font-medium text-text-primary">Fail</span>
                on this line, or when the template marks this line as photo-required.
              </p>
              <PhotoGallery
                v-if="inspectionId && showEvidenceGallery(itemRow(v.index)!)"
                class="mt-4"
                :inspection-id="inspectionId"
                :checklist-item-id="itemRow(v.index)!.id"
                capture-return-route="checklist-execution"
                :capture-return-route-query="checklistCaptureReturnQuery"
                @photos-updated="refreshPhotoCounts"
              />
            </article>
          </template>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <CodeReferenceModal
      v-model="codeRefModalOpen"
      :item-label="failTargetItem?.text ?? ''"
      @select="onCodeReferenceSelected"
      @cancel="onCodeReferenceCancel"
    />

    <!-- M6-S13: deficiency form when inspector taps Record deficiency (backdrop / Close dismisses) -->
    <BottomSheet
      v-if="failDeficiencyModalOpen && inspectionId"
      :model-value="failDeficiencyModalOpen"
      panel-class="bg-bg-surface max-h-[92dvh]"
      labelled-by="checklist-fail-deficiency-title"
      overlay-test-id="checklist-fail-deficiency-backdrop"
      data-testid="checklist-fail-deficiency-modal"
      @update:model-value="onFailDeficiencySheetModelUpdate"
      @close="closeFailDeficiencyModal"
    >
      <div class="flex-shrink-0 border-b border-border-subtle bg-bg-surface px-4 py-3 tablet:px-5">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2
              id="checklist-fail-deficiency-title"
              class="text-lg font-semibold text-text-primary"
            >
              Record deficiency
            </h2>
            <p
              v-if="failDeficiencyItem"
              class="text-sm text-text-secondary mt-0.5 line-clamp-2"
              data-testid="checklist-fail-deficiency-item-label"
            >
              {{ failDeficiencyItem.text }}
            </p>
          </div>
          <button
            type="button"
            class="min-h-touch min-w-[44px] shrink-0 rounded-xl border border-border-subtle px-3 text-sm font-medium text-text-primary hover:bg-bg-elevated focus:outline-none focus:ring-2 focus:ring-primary"
            data-testid="checklist-fail-deficiency-close"
            @click="closeFailDeficiencyModal"
          >
            Close
          </button>
        </div>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4 tablet:px-5 tablet:pb-6">
        <p
          v-if="failModalSubmitError"
          class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          data-testid="checklist-fail-deficiency-error"
          role="alert"
        >
          {{ failModalSubmitError }}
        </p>
        <DeficiencyForm
          v-if="failDeficiencyCodeDto"
          :inspection-id="inspectionId"
          :checklist-item-id="failDeficiencyItem?.id"
          :initial-create-code-reference="failDeficiencyCodeDto"
          :submitting="isFailDeficiencySubmitting"
          @submit="onFailDeficiencyFormSubmit"
          @cancel="closeFailDeficiencyModal"
        />
      </div>
    </BottomSheet>

    <footer
      class="flex-shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 py-3 tablet:px-6 border-t border-border-subtle bg-bg-surface"
      data-testid="checklist-execution-footer"
    >
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="min-h-touch px-4 rounded-xl border border-border-subtle text-base font-medium"
          data-testid="checklist-back"
          @click="onBack"
        >
          Back
        </button>
        <button
          type="button"
          class="min-h-touch px-4 rounded-xl bg-primary text-white text-base font-medium hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="checklist-complete-inspection"
          :disabled="
            templateUnavailable ||
            isReadOnlyAfterSync ||
            !isComplete ||
            Boolean(execution?.completedAt) ||
            mandatoryPhotoViolations.length > 0
          "
          @click="onCompleteInspection"
        >
          Complete inspection
        </button>
        <button
          v-if="inspectionId"
          type="button"
          class="min-h-touch px-4 rounded-xl border border-border-subtle bg-bg-elevated text-base font-medium text-text-primary hover:bg-bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
          data-testid="checklist-review-submit"
          @click="goToReview"
        >
          Review &amp; submit
        </button>
      </div>
      <div
        class="text-right text-sm text-text-secondary min-w-0"
        data-testid="checklist-save-status"
      >
        <span v-if="!online" class="text-amber-600 dark:text-amber-400">Offline · </span>
        <span v-else>Online · </span>
        <span v-if="saveStatus === 'saving'">Saving…</span>
        <span v-else-if="saveStatus === 'saved'">Saved locally</span>
        <span v-else>Ready</span>
      </div>
    </footer>
  </div>
</template>
