<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import type { UpdateDeficiencyDTO } from '@codecomply/validators'
import AdminDeficiencyForm from '../components/AdminDeficiencyForm.vue'
import {
  deficiencyMayHaveVoC,
  deficiencyStatusLabel,
  isSessionExpiredRedirectError,
  useAdminDeficiencyDetail,
  useDeficiencyVoC,
  useDeleteDeficiencyMutation,
  useUpdateDeficiencyMutation,
} from '../composables/useAdminDeficiencies'

const route = useRoute()
const router = useRouter()
const deficiencyId = computed(() => String(route.params.id ?? ''))

const { data: deficiency, isPending, error } = useAdminDeficiencyDetail(deficiencyId)

const fetchVoC = computed(() =>
  deficiency.value ? deficiencyMayHaveVoC(deficiency.value.status) : false,
)
const { data: voc } = useDeficiencyVoC(deficiencyId, fetchVoC)
const updateMutation = useUpdateDeficiencyMutation(deficiencyId)
const deleteMutation = useDeleteDeficiencyMutation()

const submitError = ref<string | null>(null)
const showDeleteConfirm = ref(false)
const deleteError = ref<string | null>(null)

const loading = computed(() => isPending.value && !deficiency.value)
const showFetchError = computed(() => !!error.value && !isSessionExpiredRedirectError(error.value))

const vocReviewLink = computed(() => {
  if (!deficiency.value) return null
  if (deficiency.value.status === 'VOC_SUBMITTED' && voc.value) {
    return {
      name: 'voc-review' as const,
      query: { deficiencyId: deficiency.value.id },
    }
  }
  return null
})

function codeSummary() {
  const c = deficiency.value?.codeReference
  if (!c) return '—'
  return c.title ? `${c.code} §${c.section} — ${c.title}` : `${c.code} §${c.section}`
}

async function onSubmit(payload: UpdateDeficiencyDTO) {
  submitError.value = null
  try {
    await updateMutation.mutateAsync(payload)
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : 'Failed to save deficiency'
  }
}

async function onDelete() {
  deleteError.value = null
  try {
    await deleteMutation.mutateAsync(deficiencyId.value)
    showDeleteConfirm.value = false
    await router.push({ name: 'deficiencies' })
  } catch (e) {
    deleteError.value = e instanceof Error ? e.message : 'Failed to delete deficiency'
  }
}
</script>

<template>
  <div class="space-y-6" data-testid="deficiency-detail-view">
    <header class="space-y-2">
      <RouterLink
        to="/compliance/deficiencies"
        class="text-sm font-medium text-primary-700 hover:underline"
        data-testid="deficiency-detail-back"
      >
        ← Deficiencies
      </RouterLink>
    </header>

    <div
      v-if="loading"
      class="rounded-lg border border-border-subtle bg-bg-surface px-4 py-8 text-center text-sm text-text-secondary"
      data-testid="deficiency-detail-loading"
    >
      Loading…
    </div>

    <p
      v-else-if="showFetchError"
      class="text-sm text-red-700"
      data-testid="deficiency-detail-error"
    >
      {{ error instanceof Error ? error.message : 'Failed to load deficiency' }}
    </p>

    <template v-else-if="deficiency">
      <section class="rounded-lg border border-border-subtle bg-bg-surface p-5 shadow-sm space-y-3">
        <dl class="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt class="text-text-dim">ID</dt>
            <dd class="font-mono text-text-primary" data-testid="deficiency-detail-id">
              {{ deficiency.id }}
            </dd>
          </div>
          <div>
            <dt class="text-text-dim">Status</dt>
            <dd>{{ deficiencyStatusLabel(deficiency.status) }}</dd>
          </div>
          <div class="sm:col-span-2">
            <dt class="text-text-dim">Inspection</dt>
            <dd>
              <RouterLink
                :to="{ name: 'inspection-record', params: { id: deficiency.inspectionId } }"
                class="text-primary-700 hover:underline"
                data-testid="deficiency-detail-inspection-link"
              >
                {{ deficiency.inspectionId }}
              </RouterLink>
            </dd>
          </div>
          <div class="sm:col-span-2">
            <dt class="text-text-dim">Code reference</dt>
            <dd>{{ codeSummary() }}</dd>
          </div>
        </dl>
      </section>

      <section
        class="rounded-lg border border-border-subtle bg-bg-surface p-5 shadow-sm space-y-3"
        data-testid="deficiency-voc-section"
      >
        <h2 class="text-lg font-semibold text-text-primary">Verification of Compliance</h2>
        <template v-if="voc">
          <dl class="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt class="text-text-dim">VoC status</dt>
              <dd>{{ voc.status }}</dd>
            </div>
            <div>
              <dt class="text-text-dim">Submitted by</dt>
              <dd>{{ voc.name }} ({{ voc.title }})</dd>
            </div>
            <div>
              <dt class="text-text-dim">Method</dt>
              <dd>{{ voc.method }}</dd>
            </div>
          </dl>
          <RouterLink
            v-if="vocReviewLink"
            :to="vocReviewLink"
            class="inline-flex text-sm font-medium text-primary-700 hover:underline"
            data-testid="deficiency-voc-review-link"
          >
            Review in VoC queue →
          </RouterLink>
        </template>
        <p v-else class="text-sm text-text-secondary">
          No VoC linked yet. Inspectors submit VoC from the field; admins review pending items in
          <RouterLink to="/compliance/voc" class="text-primary-700 hover:underline"
            >VoC review</RouterLink
          >.
        </p>
      </section>

      <section class="max-w-2xl rounded-lg border border-border-subtle bg-bg-surface p-5 shadow-sm">
        <h2 class="mb-4 text-lg font-semibold text-text-primary">Edit deficiency</h2>
        <AdminDeficiencyForm
          variant="edit"
          :initial="deficiency"
          :submitting="updateMutation.isPending.value"
          @submit="onSubmit"
          @cancel="router.push({ name: 'deficiencies' })"
        />
        <p
          v-if="submitError"
          class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {{ submitError }}
        </p>
      </section>

      <section class="rounded-lg border border-red-200 bg-red-50 p-4">
        <h2 class="text-base font-semibold text-red-900">Delete deficiency</h2>
        <p class="mt-1 text-sm text-red-800">
          Permanently removes this deficiency record. Use only to correct data entry errors;
          finalized inspection records remain append-only.
        </p>
        <button
          v-if="!showDeleteConfirm"
          type="button"
          class="mt-3 rounded-lg border border-red-300 bg-bg-surface px-3 py-2 text-sm font-medium text-red-800"
          data-testid="deficiency-delete-open"
          @click="showDeleteConfirm = true"
        >
          Delete deficiency
        </button>
        <div v-else class="mt-3 flex flex-wrap items-center gap-3">
          <span class="text-sm text-red-900">Confirm deletion?</span>
          <button
            type="button"
            class="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white"
            data-testid="deficiency-delete-confirm"
            :disabled="deleteMutation.isPending.value"
            @click="onDelete"
          >
            Yes, delete
          </button>
          <button
            type="button"
            class="text-sm font-medium text-red-800"
            @click="showDeleteConfirm = false"
          >
            Cancel
          </button>
        </div>
        <p v-if="deleteError" class="mt-2 text-sm text-red-900">{{ deleteError }}</p>
      </section>
    </template>
  </div>
</template>
