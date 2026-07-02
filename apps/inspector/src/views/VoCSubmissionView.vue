<script setup lang="ts">
/**
 * VoCSubmissionView — shell for Verification of Compliance form (M10-S13).
 * Accessible from deficiency detail when status is OPEN or VOC_REJECTED.
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import type { DeficiencyDTO } from '@codecomply/validators'
import VoCForm from '@/components/VoCForm.vue'
import type { VoCFormPayload } from '@/components/voc-form.types'
import { useVoCMutation } from '@/composables/useVoCMutation'
import { useInspectionReadOnly } from '@/composables/useInspectionReadOnly'
import { useConnectivity } from '@/composables/useConnectivity'
import { deficiencyQueryKey } from '@/composables/useDeficiencyMutation'
import { useAuthStore } from '@/stores/auth'
import { db } from '@/lib/db/dexie'
import { apiFetch } from '@/utils/api-error-handler'
import { getApiBaseUrl } from '@/lib/api-base'
import type { LocalDeficiency } from '@/lib/db/types'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { isConnectionAvailable } = useConnectivity()
const { submitVoC } = useVoCMutation()

const inspectionId = computed(() => String(route.params.inspectionId ?? '').trim())
const deficiencyId = computed(() => String(route.params.deficiencyId ?? '').trim())
const isSubmitting = computed(() => submitVoC.isPending.value)
const submitError = ref<string | null>(null)
const submitSuccess = ref(false)

const { isReadOnlyAfterSync } = useInspectionReadOnly({
  inspectionId: computed(() => {
    const id = inspectionId.value.trim()
    return id.length > 0 ? id : undefined
  }),
})

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
    codeReference: dto.codeReference,
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
  queryKey: computed(() => [...deficiencyQueryKey, 'voc', deficiencyId.value]),
  enabled: computed(() => Boolean(deficiencyId.value)),
  queryFn: async (): Promise<LocalDeficiency> => {
    const id = deficiencyId.value
    const userId = authStore.user?.id ?? 'offline-user'
    const localRow = await db.deficiencies.get(id)

    if (!isConnectionAvailable.value) {
      if (!localRow) throw new Error('Deficiency not found offline.')
      if (localRow.inspectionId !== inspectionId.value) {
        throw new Error('This deficiency does not belong to this inspection.')
      }
      return localRow
    }

    try {
      const res = await apiFetch(`${apiPrefix()}/deficiencies/${encodeURIComponent(id)}`)
      if (res.status === 404) {
        if (localRow && localRow.inspectionId === inspectionId.value) return localRow
        throw new Error('Deficiency not found.')
      }
      if (!res.ok) throw new Error(await readErrorMessage(res))
      const dto = (await res.json()) as DeficiencyDTO
      if (dto.inspectionId !== inspectionId.value) {
        throw new Error('This deficiency does not belong to this inspection.')
      }
      const row = dtoToLocal(dto, userId)
      if (!row.isDirty) await db.deficiencies.put(row)
      return row
    } catch (e) {
      if (localRow && localRow.inspectionId === inspectionId.value) return localRow
      throw e instanceof Error ? e : new Error('Could not load deficiency.')
    }
  },
})

const deficiency = computed(() => deficiencyQuery.data.value ?? null)

const canSubmitVoC = computed(() => {
  const st = deficiency.value?.status
  return st === 'OPEN' || st === 'VOC_REJECTED'
})

const initialSectionTitle = computed(() => {
  const c = deficiency.value?.codeReference
  if (!c) return ''
  return c.title ? `${c.code} §${c.section} — ${c.title}` : `${c.code} §${c.section}`
})

const initialTitle = computed(() => deficiency.value?.codeReference?.title?.trim() ?? '')

const queryError = computed(() => {
  const e = deficiencyQuery.error.value
  return e instanceof Error ? e : null
})

function goBack() {
  if (window.history.length > 1) router.back()
  else {
    void router.push({
      name: 'deficiency-detail',
      params: { inspectionId: inspectionId.value, deficiencyId: deficiencyId.value },
    })
  }
}

async function onSubmit(payload: VoCFormPayload) {
  submitError.value = null
  submitSuccess.value = false
  if (isReadOnlyAfterSync.value) {
    submitError.value = 'This inspection is read-only after finalization sync.'
    return
  }
  if (!canSubmitVoC.value) {
    submitError.value = 'VoC cannot be submitted for this deficiency status.'
    return
  }
  const id = deficiencyId.value
  if (!id) return
  try {
    await submitVoC.mutateAsync({ deficiencyId: id, payload })
    submitSuccess.value = true
    await router.replace({
      name: 'deficiency-detail',
      params: { inspectionId: inspectionId.value, deficiencyId: id },
      query: { vocSubmitted: '1' },
    })
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : 'Could not submit VoC.'
  }
}
</script>

<template>
  <div class="h-full min-h-0 flex flex-col bg-bg-app" data-testid="voc-submission-view">
    <main class="flex-1 overflow-y-auto px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div class="mx-auto max-w-lg">
        <div class="mb-6 flex items-center gap-3">
          <button
            type="button"
            class="h-11 min-w-[44px] rounded-lg border border-border-subtle bg-bg-elevated px-3 text-sm font-medium text-text-primary hover:bg-bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Go back"
            data-testid="voc-submission-back"
            @click="goBack"
          >
            Back
          </button>
          <h1 class="text-xl font-semibold text-text-primary">Verification of compliance</h1>
        </div>

        <p
          v-if="!inspectionId || !deficiencyId"
          class="text-sm text-red-600 dark:text-red-400"
          role="alert"
        >
          Missing inspection or deficiency id.
        </p>

        <p
          v-else-if="deficiencyQuery.isPending.value"
          class="text-sm text-text-secondary"
          data-testid="voc-submission-loading"
        >
          Loading deficiency…
        </p>

        <p
          v-else-if="queryError"
          class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          data-testid="voc-submission-load-error"
          role="alert"
        >
          {{ queryError.message }}
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

          <p
            v-if="!canSubmitVoC"
            class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
            data-testid="voc-submission-ineligible"
            role="alert"
          >
            VoC can only be submitted when the deficiency is open or was rejected by an
            administrator.
          </p>

          <p
            v-if="submitSuccess"
            class="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
            data-testid="voc-submission-success"
            role="status"
          >
            VoC submitted successfully. It will sync when you’re back online if submitted offline.
          </p>

          <p
            v-if="submitError"
            class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
            data-testid="voc-submission-submit-error"
            role="alert"
          >
            {{ submitError }}
          </p>

          <div
            class="rounded-2xl border border-border-subtle bg-bg-elevated p-5 shadow-sm dark:shadow-none"
          >
            <VoCForm
              :submitting="isSubmitting"
              :read-only="isReadOnlyAfterSync || !canSubmitVoC"
              :initial-section-title="initialSectionTitle"
              :initial-title="initialTitle"
              @submit="onSubmit"
              @cancel="goBack"
            />
          </div>
        </template>
      </div>
    </main>
  </div>
</template>
