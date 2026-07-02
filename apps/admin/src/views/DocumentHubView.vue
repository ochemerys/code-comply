<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import DocumentList from '../components/DocumentList.vue'
import DocumentUploadPanel from '../components/DocumentUploadPanel.vue'
import ReportGenerator from '../components/ReportGenerator.vue'
import {
  isSessionExpiredRedirectError,
  useInspectionGeneratedDocuments,
  useInspectionUploadedDocuments,
} from '../composables/useAdminDocuments'
import { useAdminInspectionWorkflow } from '../composables/useAdminInspectionDetail'
import { useAuthStore } from '../stores/auth'
import type { InspectionStatus } from '@codecomply/validators'

const route = useRoute()
const auth = useAuthStore()
const inspectionId = computed(() => String(route.params.id ?? ''))
const activeTab = ref<'generated' | 'uploaded'>('generated')

const {
  data: workflow,
  isPending: workflowPending,
  error: workflowError,
} = useAdminInspectionWorkflow(inspectionId)
const {
  data: uploaded,
  isPending: uploadedPending,
  refetch: refetchUploaded,
} = useInspectionUploadedDocuments(inspectionId)
const {
  data: generated,
  isPending: generatedPending,
  refetch: refetchGenerated,
} = useInspectionGeneratedDocuments(inspectionId)

const readOnly = computed(() => workflow.value?.isFinalized === true)
const loading = computed(() => workflowPending.value && !workflow.value)
const showFetchError = computed(
  () => !!workflowError.value && !isSessionExpiredRedirectError(workflowError.value),
)

const canGenerateReports = computed(() => auth.isAdmin)

const generatorInspectionId = ref('')
watch(
  inspectionId,
  (id) => {
    generatorInspectionId.value = id
  },
  { immediate: true },
)

const inspectionStatusFilter = ref<InspectionStatus>('IN_PROGRESS')
const inspectionRows = computed(() => {
  if (!workflow.value) return []
  return [
    {
      id: workflow.value.inspectionId,
      permitNumber: workflow.value.permitNumber,
      address: workflow.value.address,
      status: workflow.value.status,
    },
  ]
})

function onUploaded() {
  void refetchUploaded()
}

function onReportGenerated() {
  void refetchGenerated()
  activeTab.value = 'generated'
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6" data-testid="document-hub-view">
    <header class="flex flex-wrap items-center gap-3">
      <RouterLink
        :to="{ name: 'inspection-detail', params: { id: inspectionId } }"
        class="text-sm font-medium text-primary-700 hover:underline"
        data-testid="document-hub-back"
      >
        ← Inspection workflow
      </RouterLink>
    </header>

    <div v-if="loading" class="text-sm text-text-secondary" data-testid="document-hub-loading">
      Loading…
    </div>

    <div
      v-else-if="showFetchError"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
      data-testid="document-hub-error"
    >
      {{ workflowError instanceof Error ? workflowError.message : 'Failed to load inspection' }}
    </div>

    <template v-else-if="workflow">
      <div
        class="rounded-lg border border-border-subtle bg-bg-app px-4 py-3 text-sm text-text-primary"
        data-testid="document-hub-summary"
      >
        <p>
          <span class="font-medium text-text-primary">{{ workflow.permitNumber }}</span>
          · {{ workflow.address }}
        </p>
        <p class="mt-1 text-text-secondary">
          Status: {{ workflow.status }}
          <span v-if="readOnly" class="ml-2 font-medium text-amber-800">(finalized)</span>
        </p>
      </div>

      <div
        class="flex gap-2 border-b border-border-subtle"
        role="tablist"
        data-testid="document-hub-tabs"
      >
        <button
          type="button"
          role="tab"
          class="border-b-2 px-4 py-2 text-sm font-semibold transition-colors"
          :class="
            activeTab === 'generated'
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          "
          data-testid="document-hub-tab-generated"
          :aria-selected="activeTab === 'generated'"
          @click="activeTab = 'generated'"
        >
          Generated
        </button>
        <button
          type="button"
          role="tab"
          class="border-b-2 px-4 py-2 text-sm font-semibold transition-colors"
          :class="
            activeTab === 'uploaded'
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          "
          data-testid="document-hub-tab-uploaded"
          :aria-selected="activeTab === 'uploaded'"
          @click="activeTab = 'uploaded'"
        >
          Uploaded
        </button>
      </div>

      <DocumentList
        v-show="activeTab === 'generated'"
        kind="generated"
        :inspection-id="inspectionId"
        :generated="generated"
        :loading="generatedPending"
        :read-only="readOnly"
      />

      <template v-if="activeTab === 'uploaded'">
        <DocumentUploadPanel
          v-if="!readOnly"
          :inspection-id="inspectionId"
          @uploaded="onUploaded"
        />
        <DocumentList
          kind="uploaded"
          :inspection-id="inspectionId"
          :uploaded="uploaded"
          :loading="uploadedPending"
          :read-only="readOnly"
        />
      </template>

      <section
        v-if="activeTab === 'generated' && canGenerateReports"
        class="space-y-4"
        data-testid="document-hub-generator"
      >
        <ReportGenerator
          :inspections="inspectionRows"
          v-model:inspection-id="generatorInspectionId"
          v-model:inspection-status-filter="inspectionStatusFilter"
          fixed-inspection
          @generated="onReportGenerated"
        />
      </section>
      <p
        v-else-if="activeTab === 'generated' && !canGenerateReports"
        class="text-sm text-text-secondary"
        data-testid="document-hub-no-generate-permission"
      >
        You do not have permission to generate new reports.
      </p>
    </template>
  </div>
</template>
