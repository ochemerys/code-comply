<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import InspectionDatesPanel from '../components/InspectionDatesPanel.vue'
import InspectionStagesPanel from '../components/InspectionStagesPanel.vue'
import UnableToEnterReviewPanel from '../components/UnableToEnterReviewPanel.vue'
import type { InspectionStageDTO } from '@codecomply/validators'
import {
  isSessionExpiredRedirectError,
  useAdminInspectionWorkflow,
  useNoEntryLetterMutation,
  useUpdateInspectionWorkflowMutation,
} from '../composables/useAdminInspectionDetail'

const route = useRoute()
const inspectionId = computed(() => String(route.params.id ?? ''))

const { data: workflow, isPending, error, refetch } = useAdminInspectionWorkflow(inspectionId)
const updateMutation = useUpdateInspectionWorkflowMutation(inspectionId)
const letterMutation = useNoEntryLetterMutation(inspectionId)

const actionError = ref<string | null>(null)
const letterSuccess = ref<string | null>(null)

const loading = computed(() => isPending.value && !workflow.value)
const readOnly = computed(() => workflow.value?.isFinalized === true)
const showFetchError = computed(() => !!error.value && !isSessionExpiredRedirectError(error.value))

async function onDatesSave(payload: {
  requestedDate: string | null
  plannedDate: string | null
  actualDate: string | null
}) {
  actionError.value = null
  try {
    await updateMutation.mutateAsync(payload)
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'Failed to save dates'
  }
}

async function onStagesSave(payload: {
  stages: InspectionStageDTO[]
  otherStageDescription: string | null
  noFurtherInspectionsRequired: boolean
}) {
  actionError.value = null
  try {
    await updateMutation.mutateAsync(payload)
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'Failed to save stages'
  }
}

async function onUnableSave(payload: {
  firstNotificationDate: string | null
  secondNotificationDate: string | null
  unableToEnterComments: string | null
}) {
  actionError.value = null
  letterSuccess.value = null
  try {
    await updateMutation.mutateAsync(payload)
    await refetch()
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'Failed to save unable to enter'
  }
}

async function onGenerateLetter(payload: { ownerEmail?: string }) {
  actionError.value = null
  letterSuccess.value = null
  try {
    const result = await letterMutation.mutateAsync(payload)
    letterSuccess.value = result.ownerNotificationSentAt
      ? 'No Entry letter generated and emailed to owner.'
      : 'No Entry letter generated.'
    await refetch()
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'Failed to generate No Entry letter'
  }
}
</script>

<template>
  <div class="space-y-6" data-testid="inspection-detail-view">
    <header class="flex flex-wrap items-center gap-3">
      <RouterLink
        to="/inspections/monitor"
        class="text-sm font-medium text-primary-700 hover:underline"
        data-testid="inspection-detail-back-monitor"
      >
        ← Inspection monitor
      </RouterLink>
      <RouterLink
        :to="{ name: 'inspection-record', params: { id: inspectionId } }"
        class="text-sm font-medium text-primary-700 hover:underline"
        data-testid="inspection-detail-record-link"
      >
        Compliance record
      </RouterLink>
      <RouterLink
        :to="{ name: 'inspection-documents', params: { id: inspectionId } }"
        class="text-sm font-medium text-primary-700 hover:underline"
        data-testid="inspection-detail-documents-link"
      >
        Documents
      </RouterLink>
    </header>

    <div v-if="loading" class="text-sm text-text-secondary" data-testid="inspection-detail-loading">
      Loading inspection…
    </div>

    <div
      v-else-if="showFetchError"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
      data-testid="inspection-detail-error"
    >
      {{ error instanceof Error ? error.message : 'Failed to load inspection' }}
    </div>

    <template v-else-if="workflow">
      <div
        class="rounded-lg border border-border-subtle bg-bg-app px-4 py-3 text-sm text-text-primary"
        data-testid="inspection-detail-summary"
      >
        <p>
          <span class="font-medium text-text-primary">{{ workflow.permitNumber }}</span>
          · {{ workflow.address }}
        </p>
        <p class="mt-1 text-text-secondary">
          Status: {{ workflow.status }}
          <span v-if="readOnly" class="ml-2 text-amber-800 font-medium"
            >(finalized — read only)</span
          >
        </p>
      </div>

      <div
        v-if="actionError"
        class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
        data-testid="inspection-detail-action-error"
      >
        {{ actionError }}
      </div>
      <div
        v-if="letterSuccess"
        class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        data-testid="inspection-detail-letter-success"
      >
        {{ letterSuccess }}
      </div>

      <InspectionDatesPanel
        :workflow="workflow"
        :disabled="readOnly"
        :saving="updateMutation.isPending.value"
        @save="onDatesSave"
      />
      <InspectionStagesPanel
        :workflow="workflow"
        :disabled="readOnly"
        :saving="updateMutation.isPending.value"
        @save="onStagesSave"
      />
      <UnableToEnterReviewPanel
        :workflow="workflow"
        :disabled="readOnly"
        :saving="updateMutation.isPending.value"
        :letter-pending="letterMutation.isPending.value"
        @save="onUnableSave"
        @generate-letter="onGenerateLetter"
      />
    </template>
  </div>
</template>
