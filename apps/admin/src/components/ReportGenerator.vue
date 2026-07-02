<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type {
  GenerateReportDTO,
  InspectionStatus,
  ReportDTO,
  ReportTypeDTO,
} from '@codecomply/validators'
import ReportDistributionPanel from './ReportDistributionPanel.vue'
import ReportMetadataPanel from './ReportMetadataPanel.vue'
import {
  ADMIN_REPORT_TYPE_OPTIONS,
  reportTypeLabel,
  useGenerateReportMutation,
  useInspectionDeficienciesForReports,
  useReportDownloadMutation,
} from '../composables/useAdminReports'

const props = defineProps<{
  inspections: Array<{
    id: string
    permitNumber: string
    address: string
    status: string
  }>
  inspectionsLoading?: boolean
  inspectionStatusFilter: InspectionStatus
  /** When true, inspection is fixed (document hub) — hide status filter and inspection picker. */
  fixedInspection?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:inspectionStatusFilter', value: InspectionStatus): void
  (e: 'generated', report: ReportDTO): void
}>()

const inspectionId = defineModel<string>('inspectionId', { default: '' })
const reportType = ref<ReportTypeDTO>('INSPECTION')
const deficiencyId = ref('')

const inspectionIdRef = computed(() => inspectionId.value)
const { data: deficiencies, isPending: deficienciesLoading } =
  useInspectionDeficienciesForReports(inspectionIdRef)

const generateMutation = useGenerateReportMutation(inspectionIdRef)
const downloadMutation = useReportDownloadMutation()

const lastGenerated = ref<ReportDTO | null>(null)
const downloadUrl = ref<string | null>(null)
const formError = ref<string | null>(null)

const selectedTypeOption = computed(() =>
  ADMIN_REPORT_TYPE_OPTIONS.find((o) => o.value === reportType.value),
)

const needsDeficiency = computed(() => !!selectedTypeOption.value?.needsDeficiency)

const deficiencyOptions = computed(() => {
  const rows = deficiencies.value ?? []
  if (selectedTypeOption.value?.stopWorkOnly) {
    return rows.filter((d) => d.isStopWork || d.isUnsafe)
  }
  return rows
})

const canGenerate = computed(() => {
  if (!inspectionId.value) return false
  if (selectedTypeOption.value?.disabled) return false
  if (needsDeficiency.value && !deficiencyId.value) return false
  return !generateMutation.isPending.value
})

watch(inspectionId, () => {
  deficiencyId.value = ''
  lastGenerated.value = null
  downloadUrl.value = null
  formError.value = null
})

watch(reportType, () => {
  deficiencyId.value = ''
  formError.value = null
})

const statusOptions: { value: InspectionStatus; label: string }[] = [
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'PASSED', label: 'Passed' },
  { value: 'FAILED', label: 'Failed' },
]

async function onGenerate() {
  formError.value = null
  downloadUrl.value = null
  lastGenerated.value = null

  const option = selectedTypeOption.value
  if (option?.disabled) {
    formError.value = option.disabledReason ?? 'This report type is not available'
    return
  }
  if (!inspectionId.value) {
    formError.value = 'Select an inspection'
    return
  }
  if (needsDeficiency.value && !deficiencyId.value) {
    formError.value = 'Select a deficiency for this report'
    return
  }

  const body: GenerateReportDTO = {
    inspectionId: inspectionId.value,
    type: reportType.value,
    ...(needsDeficiency.value ? { deficiencyId: deficiencyId.value } : {}),
  }

  try {
    const report = await generateMutation.mutateAsync(body)
    lastGenerated.value = report
    emit('generated', report)
    const { url } = await downloadMutation.mutateAsync(report.id)
    downloadUrl.value = url
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Report generation failed'
  }
}

function onDistributed() {
  if (lastGenerated.value) {
    lastGenerated.value = {
      ...lastGenerated.value,
      distributedAt: new Date().toISOString(),
    }
  }
}

async function onDownloadHistory(reportId: string) {
  formError.value = null
  try {
    const { url } = await downloadMutation.mutateAsync(reportId)
    window.open(url, '_blank', 'noopener,noreferrer')
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Download failed'
  }
}

defineExpose({ onDownloadHistory })
</script>

<template>
  <section
    class="rounded-lg border border-border-subtle bg-bg-surface p-5 shadow-sm"
    data-testid="report-generator"
  >
    <h3 class="text-lg font-semibold text-text-primary">Generate report</h3>
    <p class="mt-1 text-sm text-text-secondary">
      Choose an inspection and report type, then generate a PDF stored in the document repository.
    </p>

    <div
      v-if="generateMutation.isPending.value"
      class="mt-4 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3"
      data-testid="report-generator-progress"
      role="status"
    >
      <div class="flex items-center gap-3 text-sm text-primary-900">
        <span
          class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary-600 border-t-transparent"
          aria-hidden="true"
        />
        Generating {{ reportTypeLabel(reportType) }}…
      </div>
      <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-primary-100">
        <div class="h-full w-2/3 animate-pulse rounded-full bg-primary-600" aria-hidden="true" />
      </div>
    </div>

    <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
      <label v-if="!props.fixedInspection" class="flex flex-col gap-1 text-sm text-text-secondary">
        <span class="font-medium">Inspection status filter</span>
        <select
          :value="inspectionStatusFilter"
          class="rounded-md border border-border-strong px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          data-testid="report-generator-status-filter"
          @change="
            emit(
              'update:inspectionStatusFilter',
              ($event.target as HTMLSelectElement).value as InspectionStatus,
            )
          "
        >
          <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </label>

      <label
        v-if="!props.fixedInspection"
        class="flex flex-col gap-1 text-sm text-text-secondary"
        :class="{ 'md:col-span-2': props.fixedInspection }"
      >
        <span class="font-medium">Inspection</span>
        <select
          v-model="inspectionId"
          class="rounded-md border border-border-strong px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          data-testid="report-generator-inspection"
          :disabled="inspectionsLoading"
        >
          <option value="">Select inspection…</option>
          <option v-for="row in inspections" :key="row.id" :value="row.id">
            {{ row.permitNumber }} — {{ row.address }} ({{ row.status }})
          </option>
        </select>
      </label>

      <label class="flex flex-col gap-1 text-sm text-text-secondary">
        <span class="font-medium">Report type</span>
        <select
          v-model="reportType"
          class="rounded-md border border-border-strong px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          data-testid="report-generator-type"
        >
          <option
            v-for="opt in ADMIN_REPORT_TYPE_OPTIONS"
            :key="opt.value"
            :value="opt.value"
            :disabled="opt.disabled"
          >
            {{ opt.label }}{{ opt.disabled ? ' (unavailable)' : '' }}
          </option>
        </select>
        <span v-if="selectedTypeOption?.disabledReason" class="text-xs text-amber-700">
          {{ selectedTypeOption.disabledReason }}
        </span>
      </label>

      <label
        v-if="needsDeficiency"
        class="flex flex-col gap-1 text-sm text-text-secondary md:col-span-2"
      >
        <span class="font-medium">Deficiency</span>
        <select
          v-model="deficiencyId"
          class="rounded-md border border-border-strong px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          data-testid="report-generator-deficiency"
          :disabled="!inspectionId || deficienciesLoading"
        >
          <option value="">Select deficiency…</option>
          <option v-for="d in deficiencyOptions" :key="d.id" :value="d.id">
            {{ d.severity }} — {{ d.description.slice(0, 80) }}
          </option>
        </select>
      </label>
    </div>

    <p
      v-if="formError"
      class="mt-4 text-sm text-red-700"
      role="alert"
      data-testid="report-generator-error"
    >
      {{ formError }}
    </p>

    <div
      v-if="lastGenerated && downloadUrl"
      class="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm"
      data-testid="report-generator-download"
    >
      <p class="font-medium text-emerald-900">{{ reportTypeLabel(lastGenerated.type) }} ready</p>
      <p class="mt-1 text-emerald-800">
        {{ lastGenerated.filename }} · generated
        {{ new Date(lastGenerated.generatedAt).toLocaleString() }}
      </p>
      <a
        :href="downloadUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="mt-2 inline-flex items-center text-sm font-semibold text-primary-700 hover:text-primary-900"
        data-testid="report-generator-download-link"
      >
        Download PDF
      </a>

      <ReportMetadataPanel :report="lastGenerated" />
      <ReportDistributionPanel
        v-if="inspectionId"
        :report="lastGenerated"
        :inspection-id="inspectionId"
        @distributed="onDistributed"
      />
    </div>

    <div class="mt-5">
      <button
        type="button"
        class="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
        data-testid="report-generator-submit"
        :disabled="!canGenerate"
        @click="onGenerate"
      >
        {{ generateMutation.isPending.value ? 'Generating…' : 'Generate report' }}
      </button>
    </div>
  </section>
</template>
