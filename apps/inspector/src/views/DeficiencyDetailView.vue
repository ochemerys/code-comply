<script setup lang="ts">
/**
 * DeficiencyDetailView — full deficiency record with edit, delete, photos, and status (M6-S9).
 * Back uses router.back() when possible so List → Detail → Back does not push a second list (which caused List → Back → Detail loops).
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import type { DeficiencyDTO } from '@codecomply/validators'
import PhotoGallery from '@/components/PhotoGallery.vue'
import DeficiencyDetails, {
  type DeficiencyStatusHistoryEntry,
} from '@/components/DeficiencyDetails.vue'
import EditDeficiencyModal from '@/components/EditDeficiencyModal.vue'
import DeleteDeficiencyDialog from '@/components/DeleteDeficiencyDialog.vue'
import StopWorkConfirmDialog from '@/components/StopWorkConfirmDialog.vue'
import type { DeficiencyFormPayload } from '@/components/deficiency-form.types'
import { useDeficiencyMutation, deficiencyQueryKey } from '@/composables/useDeficiencyMutation'
import { useInspectionReadOnly } from '@/composables/useInspectionReadOnly'
import { useConnectivity } from '@/composables/useConnectivity'
import { useAuthStore } from '@/stores/auth'
import { useNetworkStore } from '@/stores/network'
import { isDeviceOffline } from '@/lib/device-offline'
import { db } from '@/lib/db/dexie'
import { apiFetch } from '@/utils/api-error-handler'
import { getApiBaseUrl } from '@/lib/api-base'
import type { LocalDeficiency } from '@/lib/db/types'
import { toLocalCodeReference } from '@/lib/db/sync-mutation-helpers'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const networkStore = useNetworkStore()
const { isConnectionAvailable } = useConnectivity()
const queryClient = useQueryClient()
const { updateDeficiency, deleteDeficiency, issueStopWorkOrder } = useDeficiencyMutation()

const inspectionId = computed(() => String(route.params.inspectionId ?? '').trim())
const deficiencyId = computed(() => String(route.params.deficiencyId ?? '').trim())

const { isReadOnlyAfterSync } = useInspectionReadOnly({
  inspectionId: computed(() => {
    const id = inspectionId.value.trim()
    return id.length > 0 ? id : undefined
  }),
})

const showEdit = ref(false)
const showDeleteDialog = ref(false)
const showStopWorkDialog = ref(false)
const deleteDialogError = ref<string | null>(null)
const stopWorkDialogError = ref<string | null>(null)
const pageError = ref<string | null>(null)
const vocSuccessBanner = computed(() => route.query.vocSubmitted === '1')

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

function dtoToLocal(dto: DeficiencyDTO, createdById: string): LocalDeficiency {
  return {
    id: dto.id,
    clientId: dto.clientId,
    inspectionId: dto.inspectionId,
    checklistItemId: dto.checklistItemId,
    createdById,
    description: dto.description,
    location: dto.location,
    severity: dto.severity,
    status: dto.status,
    codeReference: toLocalCodeReference(dto.codeReference),
    isStopWork: dto.isStopWork,
    isUnsafe: dto.isUnsafe,
    dueDate: dto.dueDate,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    isDirty: false,
    syncedAt: dto.updatedAt,
  }
}

const deficiencyQuery = useQuery({
  queryKey: computed(() => [...deficiencyQueryKey, 'detail', deficiencyId.value]),
  enabled: computed(() => Boolean(deficiencyId.value)),
  queryFn: async (): Promise<LocalDeficiency> => {
    const id = deficiencyId.value
    const userId = authStore.user?.id ?? 'offline-user'

    async function loadLocalRow(): Promise<LocalDeficiency | undefined> {
      const row = await db.deficiencies.get(id)
      if (!row || row.inspectionId !== inspectionId.value) return undefined
      return row
    }

    if (!isConnectionAvailable.value) {
      const localRow = await loadLocalRow()
      if (!localRow) throw new Error('Deficiency not found offline.')
      return localRow
    }

    try {
      const res = await apiFetch(`${apiPrefix()}/deficiencies/${encodeURIComponent(id)}`)
      if (res.status === 404) {
        const localRow = await loadLocalRow()
        if (localRow) return localRow
        throw new Error('Deficiency not found.')
      }
      if (!res.ok) throw new Error(await readErrorMessage(res))
      const dto = (await res.json()) as DeficiencyDTO
      if (dto.inspectionId !== inspectionId.value) {
        throw new Error('This deficiency does not belong to this inspection.')
      }
      let row = dtoToLocal(dto, userId)
      const existing = await db.deficiencies.get(id)
      if (existing?.checklistItemId && !row.checklistItemId) {
        row = { ...row, checklistItemId: existing.checklistItemId }
      }
      if (!row.isDirty) await db.deficiencies.put(row)
      return row
    } catch (e) {
      const localRow = await loadLocalRow()
      if (localRow) return localRow
      throw e instanceof Error ? e : new Error('Could not load deficiency.')
    }
  },
})

const deficiency = computed(() => deficiencyQuery.data.value ?? null)

const captureReturnQuery = computed(() => ({
  inspectionId: inspectionId.value,
  deficiencyId: deficiencyId.value,
}))

const statusHistory = computed((): DeficiencyStatusHistoryEntry[] => {
  const d = deficiency.value
  if (!d) return []
  const entries: DeficiencyStatusHistoryEntry[] = [
    {
      at: d.createdAt,
      label: 'Recorded',
      detail: 'Deficiency recorded for this inspection.',
      status: d.createdAt === d.updatedAt ? d.status : 'OPEN',
    },
  ]
  if (d.updatedAt !== d.createdAt) {
    entries.push({
      at: d.updatedAt,
      label: 'Last updated',
      detail: 'Latest changes saved locally or synced from the server.',
      status: d.status,
    })
  }
  return entries
})

const actionBusy = computed(
  () =>
    updateDeficiency.isPending.value ||
    deleteDeficiency.isPending.value ||
    issueStopWorkOrder.isPending.value ||
    deficiencyQuery.isFetching.value,
)

const actionOrReadOnlyBusy = computed(() => actionBusy.value || isReadOnlyAfterSync.value)

function onEditRequested() {
  if (isReadOnlyAfterSync.value) return
  showEdit.value = true
}

/** Land on deficiency list (e.g. after delete or no history). Preserves checklist filter when known. */
function navigateToList() {
  const id = inspectionId.value
  if (!id) {
    void router.push({ name: 'home' })
    return
  }
  const chk = deficiency.value?.checklistItemId
  void router.push({
    name: 'deficiency-list',
    params: { inspectionId: id },
    ...(chk ? { query: { checklistItemId: chk } } : {}),
  })
}

function goBack() {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back()
    return
  }
  navigateToList()
}

async function onSaveEdit(payload: DeficiencyFormPayload) {
  pageError.value = null
  if (isReadOnlyAfterSync.value) {
    pageError.value = 'This inspection is read-only after finalization sync.'
    return
  }
  const row = deficiency.value
  if (!row) return
  try {
    await updateDeficiency.mutateAsync({
      id: row.id,
      updates: {
        description: payload.description,
        location: payload.location,
        severity: payload.severity,
        codeReference: payload.codeReference,
        dueDate: payload.dueDate,
        isStopWork: payload.isStopWork,
        isUnsafe: payload.isUnsafe,
      },
    })
    showEdit.value = false
    await deficiencyQuery.refetch()
  } catch (e) {
    pageError.value = e instanceof Error ? e.message : 'Could not save changes.'
  }
}

async function onDeleteConfirmed() {
  pageError.value = null
  deleteDialogError.value = null
  if (isReadOnlyAfterSync.value) {
    deleteDialogError.value = 'This inspection is read-only after finalization sync.'
    pageError.value = deleteDialogError.value
    return
  }
  const row = deficiency.value
  if (!row) return
  try {
    await deleteDeficiency.mutateAsync({ id: row.id })
    showDeleteDialog.value = false
    navigateToList()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not delete deficiency.'
    deleteDialogError.value = msg
    pageError.value = msg
  }
}

function onDeleteRequest() {
  if (isReadOnlyAfterSync.value) return
  deleteDialogError.value = null
  pageError.value = null
  showDeleteDialog.value = true
}

function onDeleteDialogCancel() {
  showDeleteDialog.value = false
  deleteDialogError.value = null
}

function onStopWorkRequest() {
  if (isReadOnlyAfterSync.value) return
  stopWorkDialogError.value = null
  pageError.value = null
  showStopWorkDialog.value = true
}

function onStopWorkDialogCancel() {
  showStopWorkDialog.value = false
  stopWorkDialogError.value = null
}

async function resolveStopWorkRow(): Promise<LocalDeficiency | null> {
  const cached = deficiency.value
  if (cached) return cached
  const id = deficiencyId.value
  if (!id) return null
  const local = await db.deficiencies.get(id)
  if (!local || local.inspectionId !== inspectionId.value) return null
  return local
}

async function onStopWorkConfirmed() {
  pageError.value = null
  stopWorkDialogError.value = null
  if (isReadOnlyAfterSync.value) {
    stopWorkDialogError.value = 'This inspection is read-only after finalization sync.'
    pageError.value = stopWorkDialogError.value
    return
  }
  const row = await resolveStopWorkRow()
  if (!row) {
    stopWorkDialogError.value = 'Deficiency is not available offline.'
    return
  }
  if (row.isStopWork) {
    showStopWorkDialog.value = false
    return
  }
  try {
    const updated = await issueStopWorkOrder.mutateAsync({ id: row.id })
    showStopWorkDialog.value = false
    const detailKey = [...deficiencyQueryKey, 'detail', deficiencyId.value] as const
    queryClient.setQueryData(detailKey, updated)
    if (isDeviceOffline(networkStore.isOnline)) {
      return
    }
    await deficiencyQuery.refetch()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not issue Stop Work order.'
    stopWorkDialogError.value = msg
    pageError.value = msg
  }
}

async function onMarkResolved() {
  pageError.value = null
  if (isReadOnlyAfterSync.value) {
    pageError.value = 'This inspection is read-only after finalization sync.'
    return
  }
  const row = deficiency.value
  if (!row || row.status === 'CLOSED') return
  try {
    await updateDeficiency.mutateAsync({
      id: row.id,
      updates: { status: 'CLOSED' },
    })
    await deficiencyQuery.refetch()
  } catch (e) {
    pageError.value = e instanceof Error ? e.message : 'Could not update status.'
  }
}

function onGalleryError(err: Error) {
  pageError.value = err.message
}

function onSubmitVoC() {
  if (isReadOnlyAfterSync.value) return
  const id = inspectionId.value
  const defId = deficiencyId.value
  if (!id || !defId) return
  void router.push({
    name: 'voc-submission',
    params: { inspectionId: id, deficiencyId: defId },
  })
}

function onPhotosUpdated() {
  void queryClient.invalidateQueries({ queryKey: deficiencyQueryKey })
}

const queryError = computed(() => {
  const e = deficiencyQuery.error.value
  return e instanceof Error ? e : null
})
</script>

<template>
  <div class="h-full min-h-0 flex flex-col bg-bg-app" data-testid="deficiency-detail-view">
    <main class="flex-1 overflow-y-auto px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div class="mx-auto max-w-2xl">
        <div class="mb-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="h-11 min-w-[44px] rounded-lg border border-border-subtle bg-bg-elevated px-3 text-sm font-medium text-text-primary hover:bg-bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Go back"
            data-testid="deficiency-detail-back"
            @click="goBack"
          >
            Back
          </button>
          <h1 class="text-xl font-semibold text-text-primary">Deficiency</h1>
        </div>

        <p
          v-if="!inspectionId || !deficiencyId"
          class="text-sm text-red-600 dark:text-red-400"
          role="alert"
        >
          Missing inspection or deficiency id.
        </p>

        <p
          v-else-if="pageError"
          class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          data-testid="deficiency-detail-page-error"
          role="alert"
        >
          {{ pageError }}
        </p>

        <template v-else>
          <div
            v-if="isReadOnlyAfterSync"
            class="mb-4 rounded-xl border border-border-subtle bg-bg-elevated px-4 py-3 text-sm text-text-primary"
            data-testid="inspection-read-only-banner"
            role="status"
          >
            This inspection has been finalized and synced. It’s now read-only.
          </div>

          <div
            v-if="vocSuccessBanner"
            class="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
            data-testid="deficiency-voc-success-banner"
            role="status"
          >
            Verification of compliance submitted successfully.
          </div>

          <EditDeficiencyModal
            v-model="showEdit"
            :inspection-id="inspectionId"
            :deficiency="deficiency"
            :submitting="updateDeficiency.isPending.value"
            @submit="onSaveEdit"
            @cancel="showEdit = false"
          />

          <DeleteDeficiencyDialog
            v-model="showDeleteDialog"
            :deficiency="deficiency"
            :deleting="deleteDeficiency.isPending.value"
            :error="deleteDialogError"
            @confirm="onDeleteConfirmed"
            @cancel="onDeleteDialogCancel"
          />

          <StopWorkConfirmDialog
            v-model="showStopWorkDialog"
            :deficiency="deficiency"
            :confirming="issueStopWorkOrder.isPending.value"
            :error="stopWorkDialogError"
            @confirm="onStopWorkConfirmed"
            @cancel="onStopWorkDialogCancel"
          />

          <PhotoGallery
            v-if="deficiency"
            class="mb-6"
            :inspection-id="inspectionId"
            :deficiency-id="deficiencyId"
            capture-return-route="deficiency-detail"
            :capture-return-route-query="captureReturnQuery"
            :read-only="isReadOnlyAfterSync"
            @error="onGalleryError"
            @photos-updated="onPhotosUpdated"
          />

          <DeficiencyDetails
            :deficiency="deficiency"
            :status-history="statusHistory"
            :loading="deficiencyQuery.isPending.value"
            :error="queryError"
            :action-busy="actionOrReadOnlyBusy"
            @edit="onEditRequested"
            @delete-request="onDeleteRequest"
            @stop-work-request="onStopWorkRequest"
            @mark-resolved="onMarkResolved"
            @submit-voc="onSubmitVoC"
          />
        </template>
      </div>
    </main>
  </div>
</template>
