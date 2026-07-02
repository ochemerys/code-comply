<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { VoCDTO, VoCDecision } from '@codecomply/validators'
import VoCReviewCard from '../components/VoCReviewCard.vue'
import VoCDecisionDialog from '../components/VoCDecisionDialog.vue'
import {
  useAdminVoCPending,
  useAdminVoCReviewMutation,
  isSessionExpiredRedirectError,
} from '../composables/useAdminVoC'

const route = useRoute()
const { data, isPending, isFetching, error, refetch } = useAdminVoCPending()
const reviewMutation = useAdminVoCReviewMutation()
const reviewSubmitting = computed(() => reviewMutation.isPending.value)

const selected = ref<VoCDTO | null>(null)
const dialogOpen = ref(false)
const dialogDecision = ref<VoCDecision>('ACCEPTED')
const dialogError = ref<string | null>(null)

const loading = computed(() => isPending.value || (isFetching.value && !data.value))

const showFetchError = computed(() => !!error.value && !isSessionExpiredRedirectError(error.value))

const pendingList = computed(() => {
  const rows = data.value ?? []
  return [...rows].sort((a, b) => {
    const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : 0
    const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : 0
    return tb - ta
  })
})

watch(
  [() => route.query.deficiencyId, pendingList],
  ([deficiencyId]) => {
    if (typeof deficiencyId !== 'string' || !deficiencyId) return
    const match = pendingList.value.find((v) => v.deficiencyId === deficiencyId)
    if (match) selected.value = match
  },
  { immediate: true },
)

function methodLabel(method: VoCDTO['method']) {
  switch (method) {
    case 'WRITTEN_ASSURANCE':
      return 'Written assurance'
    case 'SITE_VISIT':
      return 'Site visit'
    case 'VERBAL_ASSURANCE':
      return 'Verbal assurance'
    case 'OTHER':
      return 'Other'
    default:
      return method
  }
}

function formatWhen(iso: string | undefined | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function onSelect(voc: VoCDTO) {
  selected.value = voc
}

function openDecision(decision: VoCDecision) {
  if (!selected.value) return
  dialogDecision.value = decision
  dialogError.value = null
  dialogOpen.value = true
}

async function onDialogConfirm(payload: { comments: string }) {
  const voc = selected.value
  if (!voc) return
  dialogError.value = null
  try {
    await reviewMutation.mutateAsync({
      vocId: voc.id,
      decision: dialogDecision.value,
      comments: payload.comments,
    })
    dialogOpen.value = false
    selected.value = null
  } catch (e) {
    dialogError.value = e instanceof Error ? e.message : 'Review failed'
  }
}
</script>

<template>
  <div data-testid="voc-review-view" class="max-w-6xl mx-auto">
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <p class="text-text-secondary">Pending verifications of compliance submitted by inspectors</p>
      <button
        type="button"
        class="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
        data-testid="voc-review-refresh"
        :disabled="isFetching"
        @click="() => refetch()"
      >
        Refresh
      </button>
    </div>

    <div
      v-if="showFetchError"
      class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      role="alert"
      data-testid="voc-review-error"
    >
      {{ error?.message ?? 'Could not load queue.' }}
    </div>

    <div
      v-if="loading"
      class="rounded-lg border border-border-subtle bg-bg-surface p-8 text-center text-text-secondary"
      data-testid="voc-review-loading"
    >
      Loading pending VoCs…
    </div>

    <div
      v-else-if="pendingList.length === 0"
      class="rounded-lg border border-dashed border-border-strong bg-bg-app p-10 text-center text-text-secondary"
      data-testid="voc-review-empty"
    >
      No pending verifications of compliance.
    </div>

    <div v-else class="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div class="lg:col-span-5 space-y-3" data-testid="voc-review-list">
        <VoCReviewCard
          v-for="voc in pendingList"
          :key="voc.id"
          :voc="voc"
          :selected="selected?.id === voc.id"
          @select="onSelect"
        />
      </div>

      <div
        class="lg:col-span-7 rounded-lg border border-border-subtle bg-bg-surface p-5 shadow-sm min-h-[280px]"
        data-testid="voc-review-detail"
      >
        <template v-if="selected">
          <h3 class="text-lg font-semibold text-text-primary">Deficiency VoC</h3>
          <p class="text-sm text-text-dim mt-1 font-mono" data-testid="voc-review-deficiency-id">
            Deficiency ID: {{ selected.deficiencyId }}
          </p>

          <dl class="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt class="text-text-dim font-medium">Title</dt>
              <dd class="text-text-primary mt-0.5">{{ selected.title }}</dd>
            </div>
            <div>
              <dt class="text-text-dim font-medium">Section</dt>
              <dd class="text-text-primary mt-0.5">{{ selected.sectionTitle }}</dd>
            </div>
            <div>
              <dt class="text-text-dim font-medium">Responsible party</dt>
              <dd class="text-text-primary mt-0.5">{{ selected.name }}</dd>
            </div>
            <div>
              <dt class="text-text-dim font-medium">Method</dt>
              <dd class="text-text-primary mt-0.5">{{ methodLabel(selected.method) }}</dd>
            </div>
            <div>
              <dt class="text-text-dim font-medium">Verification date</dt>
              <dd class="text-text-primary mt-0.5">
                {{ new Date(selected.verificationDate).toLocaleDateString() }}
              </dd>
            </div>
            <div>
              <dt class="text-text-dim font-medium">Submitted</dt>
              <dd class="text-text-primary mt-0.5">
                {{ formatWhen(selected.submittedAt ?? null) }}
              </dd>
            </div>
          </dl>

          <div v-if="selected.comments" class="mt-4">
            <h4 class="text-sm font-medium text-text-secondary">Inspector comments</h4>
            <p
              class="mt-1 text-sm text-text-primary whitespace-pre-wrap rounded-md bg-bg-app p-3 border border-border-subtle"
            >
              {{ selected.comments }}
            </p>
          </div>

          <div class="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              class="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
              data-testid="voc-review-accept"
              @click="openDecision('ACCEPTED')"
            >
              Accept
            </button>
            <button
              type="button"
              class="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
              data-testid="voc-review-reject"
              @click="openDecision('REJECTED')"
            >
              Reject
            </button>
          </div>
        </template>
        <p v-else class="text-text-dim text-sm">
          Select a submission to review details and record a decision.
        </p>
      </div>
    </div>

    <VoCDecisionDialog
      v-model:open="dialogOpen"
      :voc="selected"
      :decision="dialogDecision"
      :submitting="reviewSubmitting"
      :error-message="dialogError"
      @confirm="onDialogConfirm"
    />
  </div>
</template>
