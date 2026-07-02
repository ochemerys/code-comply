<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { InspectionStatus } from '@codecomply/validators'
import ReportGenerator from '../components/ReportGenerator.vue'
import {
  loadAdminReportsSelection,
  saveAdminReportsSelection,
} from '../composables/adminReportsSelectionStorage'
import {
  isSessionExpiredRedirectError,
  reportTypeLabel,
  useAdminInspectionsForReports,
  useInspectionReportHistory,
  useReportDownloadMutation,
} from '../composables/useAdminReports'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()

const inspectionStatusFilter = ref<InspectionStatus>('IN_PROGRESS')
const historyInspectionId = ref('')

onMounted(() => {
  const saved = loadAdminReportsSelection(auth.user?.id)
  if (!saved) return
  historyInspectionId.value = saved.inspectionId
  inspectionStatusFilter.value = saved.inspectionStatusFilter
})

watch([historyInspectionId, inspectionStatusFilter], ([inspectionId, statusFilter]) => {
  const userId = auth.user?.id
  if (!userId || !inspectionId) return

  saveAdminReportsSelection({
    userId,
    inspectionId,
    inspectionStatusFilter: statusFilter,
  })
})

const {
  data: inspections,
  isPending,
  isFetching,
  error,
  refetch,
} = useAdminInspectionsForReports(inspectionStatusFilter)

const historyIdRef = computed(() => historyInspectionId.value)
const {
  data: reportHistory,
  isPending: historyPending,
  refetch: refetchHistory,
} = useInspectionReportHistory(historyIdRef)

const downloadMutation = useReportDownloadMutation()
const downloadPending = computed(() => downloadMutation.isPending.value)
const historyError = ref<string | null>(null)

const loading = computed(() => isPending.value || (isFetching.value && !inspections.value))

const showFetchError = computed(() => !!error.value && !isSessionExpiredRedirectError(error.value))

const inspectionRows = computed(() =>
  (inspections.value ?? []).map((row) => ({
    id: row.id,
    permitNumber: row.permitNumber,
    address: row.address,
    status: row.status,
  })),
)

const sortedHistory = computed(() => {
  const rows = reportHistory.value ?? []
  return [...rows].sort(
    (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime(),
  )
})

function onGenerated() {
  if (historyInspectionId.value) {
    void refetchHistory()
  }
}

function formatWhen(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

async function downloadReport(reportId: string) {
  historyError.value = null
  try {
    const { url } = await downloadMutation.mutateAsync(reportId)
    window.open(url, '_blank', 'noopener,noreferrer')
  } catch (e) {
    historyError.value = e instanceof Error ? e.message : 'Download failed'
  }
}
</script>

<template>
  <div data-testid="report-generation-view" class="max-w-5xl mx-auto space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <p class="text-text-secondary">Generate PDF reports and download prior versions</p>
      <button
        type="button"
        class="inline-flex items-center justify-center rounded-lg border border-border-strong bg-bg-surface px-4 py-2 text-sm font-semibold text-text-secondary shadow-sm hover:bg-bg-app disabled:opacity-50"
        data-testid="report-generation-refresh"
        :disabled="isFetching"
        @click="() => refetch()"
      >
        Refresh inspections
      </button>
    </div>

    <div
      v-if="showFetchError"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      role="alert"
      data-testid="report-generation-error"
    >
      {{ error?.message ?? 'Could not load inspections.' }}
    </div>

    <ReportGenerator
      :inspections="inspectionRows"
      :inspections-loading="loading"
      v-model:inspection-id="historyInspectionId"
      v-model:inspection-status-filter="inspectionStatusFilter"
      @generated="onGenerated"
    />

    <section
      class="rounded-lg border border-border-subtle bg-bg-surface p-5 shadow-sm"
      data-testid="report-history"
    >
      <h3 class="text-lg font-semibold text-text-primary">Report history</h3>
      <p class="mt-1 text-sm text-text-secondary">
        Reports generated for the selected inspection (newest first). Post-sync automatic generation
        is handled by the API distribution service; use generate above for manual PDFs.
      </p>

      <p
        v-if="historyError"
        class="mt-3 text-sm text-red-700"
        role="alert"
        data-testid="report-history-error"
      >
        {{ historyError }}
      </p>

      <div
        v-if="!historyInspectionId"
        class="mt-4 rounded-lg border border-dashed border-border-strong bg-bg-app p-8 text-center text-sm text-text-secondary"
        data-testid="report-history-empty-selection"
      >
        Select an inspection above to view report history.
      </div>

      <div
        v-else-if="historyPending"
        class="mt-4 text-sm text-text-secondary"
        data-testid="report-history-loading"
      >
        Loading report history…
      </div>

      <div
        v-else-if="sortedHistory.length === 0"
        class="mt-4 rounded-lg border border-dashed border-border-strong bg-bg-app p-8 text-center text-sm text-text-secondary"
        data-testid="report-history-empty"
      >
        No reports generated yet for this inspection.
      </div>

      <template v-else>
        <div class="mt-4 hidden overflow-x-auto md:block" data-testid="report-history-desktop">
          <table
            class="min-w-full divide-y divide-border-subtle text-sm"
            data-testid="report-history-table"
          >
            <thead class="bg-bg-app">
              <tr>
                <th class="px-3 py-2 text-left font-medium text-text-secondary">Type</th>
                <th class="px-3 py-2 text-left font-medium text-text-secondary">File</th>
                <th class="px-3 py-2 text-left font-medium text-text-secondary">Generated</th>
                <th class="px-3 py-2 text-left font-medium text-text-secondary">Distribution</th>
                <th class="px-3 py-2 text-right font-medium text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border-subtle">
              <tr
                v-for="row in sortedHistory"
                :key="row.id"
                :data-testid="`report-history-row-${row.id}`"
              >
                <td class="px-3 py-2 text-text-primary">{{ reportTypeLabel(row.type) }}</td>
                <td class="px-3 py-2 text-text-secondary font-mono text-xs">{{ row.filename }}</td>
                <td class="px-3 py-2 text-text-secondary">{{ formatWhen(row.generatedAt) }}</td>
                <td class="px-3 py-2 text-text-secondary">
                  <span v-if="row.distributedAt" data-testid="report-history-distributed">
                    Sent {{ formatWhen(row.distributedAt) }}
                  </span>
                  <span v-else class="text-text-dim">Not sent</span>
                </td>
                <td class="px-3 py-2 text-right">
                  <button
                    type="button"
                    class="text-sm font-semibold text-primary-700 hover:text-primary-900 disabled:opacity-50"
                    :data-testid="`report-history-download-${row.id}`"
                    :disabled="downloadPending"
                    @click="downloadReport(row.id)"
                  >
                    Download
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <ul class="mt-4 space-y-3 md:hidden" data-testid="report-history-mobile" role="list">
          <li
            v-for="row in sortedHistory"
            :key="row.id"
            class="rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-sm"
            :data-testid="`report-history-card-${row.id}`"
          >
            <div class="flex items-start justify-between gap-3">
              <span class="font-medium text-text-primary">{{ reportTypeLabel(row.type) }}</span>
              <button
                type="button"
                class="shrink-0 text-sm font-semibold text-primary-700 hover:text-primary-900 disabled:opacity-50"
                :data-testid="`report-history-card-download-${row.id}`"
                :disabled="downloadPending"
                @click="downloadReport(row.id)"
              >
                Download
              </button>
            </div>
            <p class="mt-1 font-mono text-xs text-text-secondary">{{ row.filename }}</p>
            <dl class="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt class="text-text-dim">Generated</dt>
                <dd class="text-text-primary">{{ formatWhen(row.generatedAt) }}</dd>
              </div>
              <div>
                <dt class="text-text-dim">Distribution</dt>
                <dd class="text-text-primary">
                  <span v-if="row.distributedAt">Sent {{ formatWhen(row.distributedAt) }}</span>
                  <span v-else class="text-text-dim">Not sent</span>
                </dd>
              </div>
            </dl>
          </li>
        </ul>
      </template>
    </section>
  </div>
</template>
