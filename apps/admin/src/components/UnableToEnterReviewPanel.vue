<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import type { AdminInspectionWorkflowDetail } from '@codecomply/validators'
import { fromDateInput, toDateInputValue } from '../composables/useAdminInspectionDetail'

const props = defineProps<{
  workflow: AdminInspectionWorkflowDetail
  disabled?: boolean
  saving?: boolean
  letterPending?: boolean
}>()

const emit = defineEmits<{
  save: [
    payload: {
      firstNotificationDate: string | null
      secondNotificationDate: string | null
      unableToEnterComments: string | null
    },
  ]
  generateLetter: [payload: { ownerEmail?: string }]
}>()

const form = reactive({
  firstNotificationDate: '',
  secondNotificationDate: '',
  comments: '',
})

const ownerEmail = ref('')

watch(
  () => props.workflow,
  (wf) => {
    form.firstNotificationDate = toDateInputValue(wf.firstNotificationDate)
    form.secondNotificationDate = toDateInputValue(wf.secondNotificationDate)
    form.comments = wf.unableToEnterComments ?? ''
    ownerEmail.value = wf.ownerNotificationEmail ?? ''
  },
  { immediate: true },
)

function formatGps(
  gps: { latitude: number; longitude: number; accuracy?: number } | undefined,
): string {
  if (!gps) return '—'
  const acc = gps.accuracy != null ? ` (±${Math.round(gps.accuracy)} m)` : ''
  return `${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}${acc}`
}

function formatWhen(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function onSave() {
  emit('save', {
    firstNotificationDate: fromDateInput(form.firstNotificationDate),
    secondNotificationDate: fromDateInput(form.secondNotificationDate),
    unableToEnterComments: form.comments.trim() || null,
  })
}

function onGenerate() {
  const email = ownerEmail.value.trim()
  emit('generateLetter', email ? { ownerEmail: email } : {})
}
</script>

<template>
  <section
    class="rounded-lg border border-border-subtle bg-bg-surface shadow-sm"
    data-testid="unable-to-enter-panel"
  >
    <header class="border-b border-border-subtle px-4 py-3">
      <h2 class="text-base font-semibold text-text-primary">Unable to enter</h2>
      <p class="text-xs text-text-secondary mt-0.5">
        Notification dates, GPS proof, re-inspection fee, and No Entry letter (LSC-A-03).
      </p>
    </header>

    <div class="px-4 py-4 space-y-4">
      <div
        v-if="workflow.reInspectionFeeFlagged || workflow.permitReInspectionFeeFlagged"
        class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        data-testid="reinspection-fee-flag"
      >
        <strong>Re-inspection fee flagged</strong>
        <span v-if="workflow.reInspectionFeeFlaggedAt" class="block text-xs mt-1">
          Since {{ formatWhen(workflow.reInspectionFeeFlaggedAt) }}
        </span>
      </div>

      <dl class="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt class="text-text-secondary">Geofence / GPS proof (synced)</dt>
          <dd class="font-mono text-xs text-text-primary" data-testid="unable-to-enter-gps-proof">
            {{ formatGps(workflow.geofenceProof ?? workflow.inspectorGpsAtAttempt) }}
          </dd>
        </div>
        <div>
          <dt class="text-text-secondary">Last synced</dt>
          <dd class="text-text-primary">{{ formatWhen(workflow.lastSyncedAt) }}</dd>
        </div>
      </dl>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            for="first-notification"
            class="block text-sm font-medium text-text-secondary mb-1"
          >
            Date of 1st notification
          </label>
          <input
            id="first-notification"
            v-model="form.firstNotificationDate"
            type="date"
            class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
            :disabled="disabled"
            data-testid="unable-to-enter-first-notification"
          />
        </div>
        <div>
          <label
            for="second-notification"
            class="block text-sm font-medium text-text-secondary mb-1"
          >
            Date of 2nd notification
          </label>
          <input
            id="second-notification"
            v-model="form.secondNotificationDate"
            type="date"
            class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
            :disabled="disabled"
            data-testid="unable-to-enter-second-notification"
          />
        </div>
      </div>

      <div>
        <label for="unable-comments" class="block text-sm font-medium text-text-secondary mb-1">
          Comments
        </label>
        <textarea
          id="unable-comments"
          v-model="form.comments"
          rows="3"
          class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
          :disabled="disabled"
          data-testid="unable-to-enter-comments"
        />
      </div>

      <footer class="flex flex-wrap gap-2 justify-end border-t border-border-subtle pt-3">
        <button
          type="button"
          class="rounded-lg border border-border-strong bg-bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-app disabled:opacity-50"
          :disabled="disabled || saving"
          data-testid="unable-to-enter-save"
          @click="onSave"
        >
          {{ saving ? 'Saving…' : 'Save unable to enter' }}
        </button>
      </footer>

      <div class="border-t border-border-subtle pt-4 space-y-3">
        <h3 class="text-sm font-semibold text-text-primary">No Entry letter</h3>
        <p
          v-if="workflow.latestNoEntryReport"
          class="text-sm text-text-secondary"
          data-testid="latest-no-entry-report"
        >
          Latest letter generated {{ formatWhen(workflow.latestNoEntryReport.generatedAt) }}
          <span v-if="workflow.latestNoEntryReport.distributedAt">
            · distributed {{ formatWhen(workflow.latestNoEntryReport.distributedAt) }}
          </span>
        </p>
        <div>
          <label for="owner-email" class="block text-sm font-medium text-text-secondary mb-1">
            Owner email (optional — sends after generate)
          </label>
          <input
            id="owner-email"
            v-model="ownerEmail"
            type="email"
            class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
            placeholder="owner@example.com"
            data-testid="no-entry-owner-email"
          />
        </div>
        <p
          v-if="workflow.ownerNotificationSentAt"
          class="text-sm text-emerald-800"
          data-testid="owner-notification-status"
        >
          Owner notified {{ formatWhen(workflow.ownerNotificationSentAt) }}
          <span v-if="workflow.ownerNotificationEmail">
            ({{ workflow.ownerNotificationEmail }})</span
          >
        </p>
        <button
          type="button"
          class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          :disabled="disabled || letterPending || !form.firstNotificationDate"
          data-testid="generate-no-entry-letter"
          @click="onGenerate"
        >
          {{ letterPending ? 'Generating…' : 'Generate & email No Entry letter' }}
        </button>
      </div>
    </div>
  </section>
</template>
