<script setup lang="ts">
/**
 * InspectionReviewView (M8-S4) — comprehensive pre-submit review screen.
 * Shows summary, checklist progress, deficiencies, photos, outcome, signature, validation errors, submit action.
 */
import { BottomSheet } from '@codecomply/ui'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useOnline } from '@vueuse/core'
import {
  ChecklistExecutionDTOSchema,
  ChecklistTemplateDTOSchema,
  InspectionDTOSchema,
  PermitDTOSchema,
  type ChecklistExecutionDTO,
  type ChecklistItemDTO,
  type InspectionDTO,
} from '@codecomply/validators'
import InspectionSummary from '@/components/InspectionSummary.vue'
import ValidationErrors, { type ValidationError } from '@/components/ValidationErrors.vue'
import ChecklistProgress, { type ChecklistProgressData } from '@/components/ChecklistProgress.vue'
import PhotoGallery from '@/components/PhotoGallery.vue'
import OutcomeSelector, { type OutcomeValue } from '@/components/OutcomeSelector.vue'
import { defineLazyComponent } from '@/lib/lazy-component'

const SignaturePad = defineLazyComponent(() => import('@/components/SignaturePad.vue'))
import DeficiencyCard from '@/components/DeficiencyCard.vue'
import FinalizationConfirmDialog from '@/components/FinalizationConfirmDialog.vue'
import SubmissionResult from '@/components/SubmissionResult.vue'
import { useDeficiencies } from '@/composables/useDeficiencies'
import { useFinalization } from '@/composables/useFinalization'
import {
  CHECKLIST_ITEM_ANCHOR_PREFIX,
  getMandatoryPhotoViolations,
} from '@/composables/useChecklist'
import { useAuthStore } from '@/stores/auth'
import { db } from '@/lib/db/dexie'
import { getApiBaseUrl } from '@/lib/api-base'
import { apiFetch } from '@/utils/api-error-handler'
import type {
  ChecklistItem,
  LocalInspection,
  LocalChecklist,
  LocalChecklistResponse,
} from '@/lib/db/types'

type ChecklistTemplateForReview = {
  id: string
  versionHash: string
  name: string
  discipline: string
  version: number
  items: ChecklistItemDTO[]
}

const route = useRoute()
const router = useRouter()
const online = useOnline()
const authStore = useAuthStore()
const { finalizeInspection } = useFinalization()

function apiPrefix(): string {
  const base = getApiBaseUrl()
  return base ? `${base}/api` : '/api'
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const j = JSON.parse(text) as { error?: string; message?: string }
    return j.message || j.error || text || `Request failed (${res.status})`
  } catch {
    return text || `Request failed (${res.status})`
  }
}

function dtoItemToLocal(item: ChecklistItemDTO): ChecklistItem {
  const ref0 = item.codeReferences?.[0]
  return {
    id: item.id,
    text: item.text,
    description: item.text,
    order: item.order,
    isRequired: item.isRequired !== false,
    requiresPhoto: item.requiresPhoto === true,
    requiresPhotoOnFail: item.requiresPhoto === true,
    category: item.category,
    codeReferences: item.codeReferences,
    codeReference: ref0
      ? {
          code: ref0.code,
          section: ref0.section,
          ...(ref0.title ? { title: ref0.title } : {}),
        }
      : undefined,
  }
}

function localInspectionFromDto(dto: InspectionDTO, clientId: string): LocalInspection {
  const assigned =
    dto.assignedInspectorId && dto.assignedInspectorId.trim().length > 0
      ? dto.assignedInspectorId.trim()
      : 'unknown-assignee'
  return {
    id: dto.id,
    clientId,
    permitId: dto.permitId,
    status: dto.status,
    scheduledDate: dto.scheduledDate,
    completedDate: dto.completedDate,
    notes: dto.notes,
    assignedToId: assigned,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    isDirty: false,
    syncedAt: dto.updatedAt,
  }
}

function localChecklistFromExecution(
  execution: ChecklistExecutionDTO,
  template: ChecklistTemplateForReview,
  now: string,
): LocalChecklist {
  return {
    id: execution.id,
    inspectionId: execution.inspectionId,
    templateId: execution.templateId,
    versionHash: execution.versionHash,
    templateName: template.name,
    discipline: template.discipline,
    items: template.items.map(dtoItemToLocal),
    responses: execution.responses,
    progress: execution.progress,
    completedAt: execution.completedAt,
    createdAt: now,
    updatedAt: now,
    isDirty: false,
    syncedAt: now,
  }
}

function uuid(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c && 'randomUUID' in c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `uuid-${Math.random().toString(16).slice(2)}-${Date.now()}`
}

const inspectionId = computed(() => String(route.params.inspectionId ?? '').trim())
const executionIdFromRoute = computed(() => {
  const q = route.query.executionId
  return typeof q === 'string' ? q.trim() : ''
})

const inspection = ref<LocalInspection | null>(null)
const checklist = ref<LocalChecklist | null>(null)
const checklistResponses = ref<LocalChecklistResponse[]>([])
const photoCountByItemId = ref<Record<string, number>>({})

/** Prefer URL when coming from checklist; otherwise hydrated LocalChecklist id (execution id). */
const executionIdForNavigation = computed(() => {
  if (executionIdFromRoute.value) return executionIdFromRoute.value
  return checklist.value?.id?.trim() ?? ''
})

const canNavigateToChecklist = computed(() => {
  const insp = inspectionId.value
  const exec = executionIdForNavigation.value
  return Boolean(insp && exec)
})

function goToChecklist() {
  const insp = inspectionId.value
  const exec = executionIdForNavigation.value
  if (!insp || !exec) return
  const fromPermitRaw = route.query.fromPermit
  const fromPermit =
    typeof fromPermitRaw === 'string' && fromPermitRaw.trim().length > 0
      ? fromPermitRaw.trim()
      : undefined
  void router.push({
    name: 'checklist-execution',
    params: { inspectionId: insp, executionId: exec },
    query: fromPermit ? { fromPermit } : {},
  })
}

function checklistItemLabel(item: ChecklistItem): string {
  const text = item.description?.trim() || item.text?.trim()
  return text && text.length > 0 ? text : 'Checklist item'
}

function localItemToDto(item: ChecklistItem): ChecklistItemDTO {
  return {
    id: item.id,
    text: item.text ?? item.description ?? '',
    order: item.order,
    isRequired: item.isRequired !== false,
    requiresPhoto: item.requiresPhoto === true || item.requiresPhotoOnFail === true,
    category: item.category,
    codeReferences: item.codeReferences,
  }
}

function goToChecklistItem(itemId: string) {
  const insp = inspectionId.value
  const exec = executionIdForNavigation.value
  if (!insp || !exec || !itemId.trim()) return
  const fromPermitRaw = route.query.fromPermit
  const fromPermit =
    typeof fromPermitRaw === 'string' && fromPermitRaw.trim().length > 0
      ? fromPermitRaw.trim()
      : undefined
  void router.push({
    name: 'checklist-execution',
    params: { inspectionId: insp, executionId: exec },
    query: fromPermit ? { fromPermit } : {},
    hash: `#${CHECKLIST_ITEM_ANCHOR_PREFIX}${itemId}`,
  })
}

const graphLoading = ref(false)
const graphError = ref<string | null>(null)

const outcome = ref<OutcomeValue | undefined>(undefined)
const signatureDataUrl = ref<string | undefined>(undefined)
const showSignatureSheet = ref(false)

const submitError = ref<string | null>(null)
const submitting = ref(false)
const showFinalizeDialog = ref(false)
const submissionResult = ref<null | {
  state: 'success' | 'failure'
  inspectionId?: string
  errorMessage?: string
}>(null)

const isReadOnlyAfterSync = computed(() => {
  const insp = inspection.value
  if (!insp) return false
  const isFinalized = insp.status === 'PASSED' || insp.status === 'FAILED'
  const hasSynced = Boolean(insp.syncedAt) && insp.isDirty === false
  return isFinalized && hasSynced
})

const outcomeLabel = computed(() => {
  const o = outcome.value
  if (!o) return ''
  const labels: Record<typeof o, string> = {
    ACCEPTABLE: 'Acceptable',
    ACCEPTABLE_WITH_CONDITIONS: 'Acceptable with conditions',
    REFUSED: 'Refused',
  }
  return labels[o]
})

const permitSummaryLine = computed(() => {
  const i = inspection.value
  if (!i) return ''
  const parts = [i.permitNumber, i.permitAddress].filter(Boolean)
  return parts.join(' · ')
})

const { deficiencies } = useDeficiencies({ inspectionId })

async function resolveExecutionIdForInspection(targetInspectionId: string): Promise<string | null> {
  const fromRoute = executionIdFromRoute.value
  if (fromRoute) return fromRoute

  const rows = await db.checklistResponses.toArray()
  const distinct = [...new Set(rows.map((r) => r.checklistId).filter(Boolean))]
  if (distinct.length === 0) return null
  if (distinct.length === 1) return distinct[0]!

  if (!online.value) return null

  for (const cid of distinct) {
    try {
      const res = await apiFetch(`${apiPrefix()}/checklists/executions/${encodeURIComponent(cid)}`)
      if (!res.ok) continue
      const ex = ChecklistExecutionDTOSchema.parse(await res.json())
      if (ex.inspectionId === targetInspectionId) return cid
    } catch {
      /* try next */
    }
  }
  return null
}

async function hydrateChecklistExecution(targetInspectionId: string): Promise<void> {
  const execId = await resolveExecutionIdForInspection(targetInspectionId)
  if (!execId) return

  if (!online.value) return

  try {
    const res = await apiFetch(`${apiPrefix()}/checklists/executions/${encodeURIComponent(execId)}`)
    if (!res.ok) return
    const execution = ChecklistExecutionDTOSchema.parse(await res.json())
    if (execution.inspectionId !== targetInspectionId) return

    const tplRes = await apiFetch(
      `${apiPrefix()}/checklists/templates/${encodeURIComponent(execution.templateId)}`,
    )
    if (!tplRes.ok) return
    const template = ChecklistTemplateDTOSchema.parse(
      await tplRes.json(),
    ) as ChecklistTemplateForReview
    const now = new Date().toISOString()
    const row = localChecklistFromExecution(execution, template, now)
    await db.checklists.put(row)
    await db.checklistTemplateCache.put({
      templateId: template.id,
      versionHash: template.versionHash,
      name: template.name,
      discipline: template.discipline,
      version: template.version,
      items: template.items.map((i) => ({
        id: i.id,
        order: i.order,
        text: i.text,
        category: i.category,
        isRequired: i.isRequired,
        requiresPhoto: i.requiresPhoto,
        codeReferences: i.codeReferences,
      })),
      cachedAt: now,
    })
  } catch {
    /* ignore — graph may still render with partial local data */
  }
}

async function hydrateInspectionFromApi(
  targetInspectionId: string,
): Promise<LocalInspection | null> {
  if (!online.value) return null
  try {
    const res = await apiFetch(
      `${apiPrefix()}/inspections/${encodeURIComponent(targetInspectionId)}`,
    )
    if (!res.ok) {
      throw new Error(await readErrorMessage(res))
    }
    const dto = InspectionDTOSchema.parse(await res.json())
    const row = localInspectionFromDto(dto, uuid())
    await db.inspections.put(row)

    try {
      const pres = await apiFetch(`${apiPrefix()}/permits/${encodeURIComponent(dto.permitId)}`)
      if (pres.ok) {
        const permit = PermitDTOSchema.parse(await pres.json())
        const merged: LocalInspection = {
          ...row,
          permitNumber: permit.permitNumber,
          permitAddress: permit.address,
          updatedAt: new Date().toISOString(),
        }
        await db.inspections.put(merged)
        return merged
      }
    } catch {
      /* permit lookup is optional */
    }

    return row
  } catch {
    return null
  }
}

async function loadInspectionGraph() {
  const id = inspectionId.value
  if (!id) return

  graphLoading.value = true
  graphError.value = null

  try {
    let insp = await db.inspections.get(id)
    if (!insp) {
      insp = (await hydrateInspectionFromApi(id)) ?? undefined
    }

    let lists = await db.checklists.where('inspectionId').equals(id).toArray()
    if (lists.length === 0) {
      await hydrateChecklistExecution(id)
      lists = await db.checklists.where('inspectionId').equals(id).toArray()
    }

    inspection.value = insp ?? null
    if (!inspection.value && !online.value) {
      graphError.value =
        'This inspection is not stored on this device yet. Connect to the internet once to download it, or open it from your assigned list.'
      return
    }
    if (!inspection.value && online.value) {
      graphError.value =
        'Could not load this inspection. It may have been removed or you may not have access.'
      return
    }

    const picked = lists.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
    checklist.value = picked
    checklistResponses.value = picked
      ? await db.checklistResponses.where('checklistId').equals(picked.id).toArray()
      : []

    const photos = await db.photos.where('inspectionId').equals(id).toArray()
    const counts: Record<string, number> = {}
    for (const photo of photos) {
      const itemId = photo.checklistItemId?.trim()
      if (!itemId) continue
      counts[itemId] = (counts[itemId] ?? 0) + 1
    }
    photoCountByItemId.value = counts

    outcome.value = inspection.value?.outcome
    signatureDataUrl.value = inspection.value?.signatureDataUrl
  } finally {
    graphLoading.value = false
  }
}

onMounted(() => {
  void loadInspectionGraph()
})

watch(
  () => inspectionId.value,
  () => {
    void loadInspectionGraph()
  },
)

watch(
  () => executionIdFromRoute.value,
  () => {
    void loadInspectionGraph()
  },
)

const checklistProgress = computed((): ChecklistProgressData => {
  const items = checklist.value?.items ?? []
  const total = items.length
  const byResult = new Map<string, number>([
    ['PASS', 0],
    ['FAIL', 0],
    ['NA', 0],
  ])
  for (const r of checklistResponses.value) {
    byResult.set(r.result, (byResult.get(r.result) ?? 0) + 1)
  }
  const passedCount = byResult.get('PASS') ?? 0
  const failedCount = byResult.get('FAIL') ?? 0
  const naCount = byResult.get('NA') ?? 0
  const unansweredCount = Math.max(0, total - (passedCount + failedCount + naCount))
  return { passedCount, failedCount, naCount, unansweredCount }
})

const mandatoryPhotoViolations = computed(() => {
  const items = checklist.value?.items ?? []
  if (items.length === 0) return []
  const responses = checklistResponses.value.map((r) => ({
    itemId: r.itemId,
    result: r.result,
    timestamp: r.respondedAt,
  }))
  return getMandatoryPhotoViolations(items.map(localItemToDto), responses, photoCountByItemId.value)
})

const validationErrors = computed((): ValidationError[] => {
  const errs: ValidationError[] = []
  if (!inspection.value) {
    errs.push({ message: 'Inspection record not found on this device.' })
    return errs
  }
  if (!checklist.value) {
    errs.push({
      message: 'Checklist not found for this inspection.',
      hint: 'Open the checklist and complete it before submitting.',
      targetId: canNavigateToChecklist.value ? 'inspection-review-back-checklist' : undefined,
    })
    return errs
  }

  const answeredIds = new Set(checklistResponses.value.map((r) => r.itemId))
  for (const item of checklist.value.items) {
    if (!answeredIds.has(item.id)) {
      errs.push({
        message: `Missing answer: ${checklistItemLabel(item)}`,
        hint: 'Answer this checklist item before submitting.',
        checklistItemId: canNavigateToChecklist.value ? item.id : undefined,
        actionLabel: 'Fix item',
      })
    }
  }

  for (const item of mandatoryPhotoViolations.value) {
    errs.push({
      message: `Mandatory photo missing: ${item.text?.trim() || 'Checklist item'}`,
      hint: 'Add at least one photo for this failed item.',
      checklistItemId: canNavigateToChecklist.value ? item.id : undefined,
      actionLabel: 'Add photo',
    })
  }

  if (!outcome.value) {
    errs.push({
      message: 'Outcome is required.',
      hint: 'Choose Acceptable, Acceptable with Conditions, or Refused.',
      targetId: 'inspection-review-outcome',
    })
  }
  if (!signatureDataUrl.value) {
    errs.push({
      message: 'Signature is required.',
      hint: 'Sign and accept to attach a digital signature.',
      targetId: 'inspection-review-signature',
    })
  }
  return errs
})

const canSubmit = computed(() => {
  return (
    inspection.value != null &&
    checklist.value != null &&
    checklistProgress.value.unansweredCount === 0 &&
    mandatoryPhotoViolations.value.length === 0 &&
    Boolean(outcome.value) &&
    Boolean(signatureDataUrl.value) &&
    !isReadOnlyAfterSync.value &&
    !submitting.value
  )
})

watch(
  () => outcome.value,
  async (next) => {
    const insp = inspection.value
    if (!insp) return
    if (isReadOnlyAfterSync.value) return
    try {
      const iso = new Date().toISOString()
      const updated: LocalInspection = { ...insp, outcome: next, updatedAt: iso, isDirty: true }
      await db.inspections.put(updated)
      inspection.value = updated
    } catch {
      /* ignore */
    }
  },
)

watch(
  () => signatureDataUrl.value,
  async (next) => {
    const insp = inspection.value
    if (!insp) return
    if (isReadOnlyAfterSync.value) return
    try {
      const iso = new Date().toISOString()
      const updated: LocalInspection = {
        ...insp,
        signatureDataUrl: next,
        updatedAt: iso,
        isDirty: true,
      }
      await db.inspections.put(updated)
      inspection.value = updated
    } catch {
      /* ignore */
    }
  },
)

function requestFinalize() {
  submitError.value = null
  submissionResult.value = null
  if (isReadOnlyAfterSync.value) return
  if (!canSubmit.value) return
  showFinalizeDialog.value = true
}

function openSignatureSheet() {
  if (isReadOnlyAfterSync.value) return
  showSignatureSheet.value = true
}

function onSignatureCaptured(dataUrl: string) {
  signatureDataUrl.value = dataUrl
  showSignatureSheet.value = false
}

async function onFinalizeConfirmed() {
  const insp = inspection.value
  const out = outcome.value
  const sig = signatureDataUrl.value
  if (!insp || !out || !sig) return

  submitError.value = null
  submissionResult.value = null
  submitting.value = true
  try {
    const result = await finalizeInspection({
      inspection: insp,
      outcome: out,
      signatureDataUrl: sig,
      certificationSource: authStore.user,
    })
    inspection.value = result.inspection
    showFinalizeDialog.value = false
    submissionResult.value = {
      state: 'success',
      inspectionId: result.inspection.id,
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Could not queue submission.'
    submitError.value = errorMessage
    submissionResult.value = { state: 'failure', errorMessage }
  } finally {
    submitting.value = false
  }
}

function onViewDetails() {
  const insp = inspection.value
  if (!insp?.permitId) return
  void router.push({ name: 'permit-detail', params: { id: insp.permitId } })
}

function onStartNew() {
  void router.push({ name: 'permits' })
}

function onRetry() {
  requestFinalize()
}

function onSaveForLater() {
  void router.push({ name: 'home' })
}

const deficienciesSorted = computed(() =>
  [...deficiencies.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
)
</script>

<template>
  <div class="bg-bg-app text-text-primary" data-testid="inspection-review-view">
    <main class="px-4 py-4 tablet:px-6 tablet:py-6">
      <div class="mx-auto w-full max-w-3xl space-y-4 tablet:space-y-6">
        <header class="flex flex-col gap-3">
          <button
            v-if="canNavigateToChecklist"
            type="button"
            class="self-start min-h-touch rounded-xl border border-border-subtle bg-bg-elevated px-4 py-2.5 text-base font-medium text-text-primary hover:bg-bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
            data-testid="inspection-review-back-checklist"
            @click="goToChecklist"
          >
            Back to checklist
          </button>
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h1 class="text-xl font-bold tablet:text-2xl" data-testid="inspection-review-title">
                Review & submit
              </h1>
              <p class="mt-1 text-sm text-text-secondary">
                Confirm details before finalizing. Submission is queued when offline.
              </p>
            </div>
          </div>
        </header>

        <p
          v-if="submitError"
          class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
          data-testid="inspection-review-submit-error"
        >
          {{ submitError }}
        </p>

        <SubmissionResult
          v-if="submissionResult"
          :state="submissionResult.state"
          :inspection-id="submissionResult.inspectionId"
          :error-message="submissionResult.errorMessage"
          @view-details="onViewDetails"
          @start-new="onStartNew"
          @retry="onRetry"
          @save-for-later="onSaveForLater"
        />

        <div
          v-if="graphLoading || (!inspection && !graphError)"
          class="rounded-2xl border border-border-subtle bg-bg-surface p-6"
          data-testid="inspection-review-loading"
        >
          <p class="text-sm text-text-secondary">Loading inspection…</p>
        </div>

        <div
          v-else-if="graphError"
          class="rounded-2xl border border-border-subtle bg-bg-surface p-6"
          role="alert"
          data-testid="inspection-review-graph-error"
        >
          <p class="text-sm text-text-secondary">
            {{ graphError }}
          </p>
        </div>

        <template v-else-if="inspection">
          <InspectionSummary :inspection="inspection" />

          <div
            v-if="isReadOnlyAfterSync"
            class="rounded-2xl border border-border-subtle bg-bg-elevated px-4 py-3 text-sm text-text-primary"
            role="status"
            data-testid="inspection-read-only-banner"
          >
            This inspection has been finalized and synced. It’s now read-only.
          </div>

          <section
            class="rounded-2xl border border-border-subtle bg-bg-surface p-4 shadow-sm dark:shadow-none tablet:p-6"
            data-testid="inspection-review-checklist"
            aria-label="Checklist summary"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <h2 class="text-lg font-semibold">Checklist summary</h2>
                <p class="mt-1 text-sm text-text-secondary">
                  Make sure every item is answered before submitting.
                </p>
              </div>
              <span
                class="inline-flex items-center rounded-full border border-border-subtle bg-bg-elevated px-3 py-1 text-xs font-semibold"
                data-testid="inspection-review-checklist-items"
              >
                {{ checklist?.items?.length ?? 0 }} items
              </span>
            </div>
            <div class="mt-4">
              <ChecklistProgress :progress="checklistProgress" />
            </div>
          </section>

          <section
            class="rounded-2xl border border-border-subtle bg-bg-surface p-4 shadow-sm dark:shadow-none tablet:p-6"
            data-testid="inspection-review-deficiencies"
            aria-label="Deficiencies"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <h2 class="text-lg font-semibold">Deficiencies</h2>
                <p class="mt-1 text-sm text-text-secondary">
                  Review all recorded deficiencies before submission.
                </p>
              </div>
              <span
                class="inline-flex items-center rounded-full border border-border-subtle bg-bg-elevated px-3 py-1 text-xs font-semibold"
                data-testid="inspection-review-deficiency-count"
              >
                {{ deficienciesSorted.length }}
              </span>
            </div>

            <div
              v-if="deficienciesSorted.length === 0"
              class="mt-4 rounded-xl border border-dashed border-border-subtle bg-bg-elevated px-4 py-8 text-center text-sm text-text-secondary"
              data-testid="inspection-review-deficiency-empty"
            >
              No deficiencies recorded.
            </div>

            <div v-else class="mt-4 space-y-3">
              <DeficiencyCard v-for="d in deficienciesSorted" :key="d.id" :deficiency="d" />
            </div>
          </section>

          <section
            class="rounded-2xl border border-border-subtle bg-bg-surface p-4 shadow-sm dark:shadow-none tablet:p-6"
            data-testid="inspection-review-photos"
            aria-label="Photos"
          >
            <h2 class="text-lg font-semibold">Photos</h2>
            <p class="mt-1 text-sm text-text-secondary">
              Evidence photos captured during this inspection.
            </p>
            <PhotoGallery
              class="mt-4"
              :inspection-id="inspection.id"
              :read-only="isReadOnlyAfterSync"
            />
          </section>

          <section
            id="inspection-review-outcome"
            class="rounded-2xl border border-border-subtle bg-bg-surface p-4 shadow-sm dark:shadow-none tablet:p-6"
            data-testid="inspection-review-outcome"
            aria-label="Outcome selection"
          >
            <h2 class="text-lg font-semibold">Outcome</h2>
            <p class="mt-1 text-sm text-text-secondary">Choose the inspection outcome.</p>
            <div class="mt-4">
              <OutcomeSelector v-model="outcome" :disabled="isReadOnlyAfterSync" />
            </div>
          </section>

          <section
            id="inspection-review-signature"
            class="rounded-2xl border border-border-subtle bg-bg-surface p-4 shadow-sm dark:shadow-none tablet:p-6"
            data-testid="inspection-review-signature"
            aria-label="Signature"
          >
            <h2 class="text-lg font-semibold">Signature</h2>
            <p class="mt-1 text-sm text-text-secondary">Capture a digital signature.</p>
            <div class="mt-4">
              <button
                type="button"
                class="min-h-touch w-full rounded-xl bg-primary px-4 text-base font-medium text-white hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50 tablet:w-auto"
                data-testid="inspection-review-signature-open"
                :disabled="isReadOnlyAfterSync"
                @click="openSignatureSheet"
              >
                {{ signatureDataUrl ? 'Replace signature' : 'Sign and continue' }}
              </button>
            </div>
            <div v-if="signatureDataUrl" class="mt-4">
              <p class="text-sm font-medium text-text-secondary">Attached signature</p>
              <img
                :src="signatureDataUrl"
                alt="Signature preview"
                class="mt-2 w-full max-w-sm rounded-xl border border-border-subtle bg-white"
                data-testid="inspection-review-signature-preview"
              />
              <button
                type="button"
                class="mt-3 min-h-touch rounded-xl border border-border-subtle bg-bg-elevated px-4 text-base font-medium text-text-primary hover:bg-bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                data-testid="inspection-review-signature-clear"
                :disabled="isReadOnlyAfterSync"
                :class="isReadOnlyAfterSync ? 'cursor-not-allowed opacity-50' : ''"
                @click="signatureDataUrl = undefined"
              >
                Remove signature
              </button>
            </div>
          </section>

          <BottomSheet
            v-model="showSignatureSheet"
            labelled-by="inspection-review-signature-sheet-title"
            overlay-test-id="inspection-review-signature-sheet-overlay"
            data-testid="inspection-review-signature-sheet"
          >
            <div class="flex-shrink-0 border-b border-border-subtle px-5 py-4">
              <h2
                id="inspection-review-signature-sheet-title"
                class="text-lg font-semibold text-text-primary"
              >
                Capture signature
              </h2>
              <p class="mt-1 text-sm text-text-secondary">
                Use the full sheet to sign comfortably, then accept to attach it.
              </p>
            </div>
            <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <SignaturePad :disabled="isReadOnlyAfterSync" @signed="onSignatureCaptured" />
            </div>
          </BottomSheet>

          <ValidationErrors :errors="validationErrors" @checklist-item="goToChecklistItem" />

          <section
            v-if="!submissionResult"
            class="flex flex-col gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <button
              type="button"
              class="min-h-touch w-full rounded-2xl bg-primary px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="inspection-review-submit"
              :disabled="!canSubmit"
              @click="requestFinalize"
            >
              {{ submitting ? 'Queuing submission…' : 'Submit inspection' }}
            </button>
            <p class="text-center text-xs text-text-secondary">
              Submitting queues a finalization record and syncs when online.
            </p>
          </section>
        </template>
      </div>
    </main>

    <FinalizationConfirmDialog
      v-model="showFinalizeDialog"
      :outcome-label="outcomeLabel"
      :permit-summary="permitSummaryLine"
      :loading="submitting"
      @confirm="onFinalizeConfirmed"
    />
  </div>
</template>
