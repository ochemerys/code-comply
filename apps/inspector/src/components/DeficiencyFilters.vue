<script setup lang="ts">
/**
 * DeficiencyFilters — status + severity filters for deficiency list (M6-S8).
 */
import { computed } from 'vue'
import type { DeficiencySeverity, DeficiencyStatus } from '@/lib/db/types'

const props = withDefaults(
  defineProps<{
    statusFilter?: DeficiencyStatus | 'all'
    severityFilter?: DeficiencySeverity | 'all'
  }>(),
  { statusFilter: 'all', severityFilter: 'all' },
)

const emit = defineEmits<{
  'update:statusFilter': [DeficiencyStatus | 'all']
  'update:severityFilter': [DeficiencySeverity | 'all']
}>()

const statusModel = computed({
  get: () => props.statusFilter,
  set: (v: DeficiencyStatus | 'all') => emit('update:statusFilter', v),
})

const severityModel = computed({
  get: () => props.severityFilter,
  set: (v: DeficiencySeverity | 'all') => emit('update:severityFilter', v),
})

const statusOptions: { value: DeficiencyStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'VOC_SUBMITTED', label: 'VOC submitted' },
  { value: 'VOC_ACCEPTED', label: 'VOC accepted' },
  { value: 'VOC_REJECTED', label: 'VOC rejected' },
  { value: 'CLOSED', label: 'Closed' },
]

const severityOptions: { value: DeficiencySeverity | 'all'; label: string }[] = [
  { value: 'all', label: 'All severities' },
  { value: 'MINOR', label: 'Minor' },
  { value: 'MAJOR', label: 'Major' },
  { value: 'CRITICAL', label: 'Critical' },
]
</script>

<template>
  <div
    class="flex flex-col gap-4 rounded-2xl border border-border-subtle bg-bg-elevated p-4 shadow-sm dark:shadow-none tablet:flex-row tablet:items-end tablet:gap-6"
    data-testid="deficiency-filters"
  >
    <div class="flex min-w-0 flex-1 flex-col gap-1.5">
      <label
        for="deficiency-filter-status"
        class="text-sm font-medium text-gray-900 dark:text-gray-100"
      >
        Status
      </label>
      <select
        id="deficiency-filter-status"
        v-model="statusModel"
        class="h-11 min-h-touch w-full rounded-lg border border-border-subtle bg-white px-3 text-base text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:text-gray-100"
        data-testid="deficiency-filter-status"
      >
        <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>
    <div class="flex min-w-0 flex-1 flex-col gap-1.5">
      <label
        for="deficiency-filter-severity"
        class="text-sm font-medium text-gray-900 dark:text-gray-100"
      >
        Severity
      </label>
      <select
        id="deficiency-filter-severity"
        v-model="severityModel"
        class="h-11 min-h-touch w-full rounded-lg border border-border-subtle bg-white px-3 text-base text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:text-gray-100"
        data-testid="deficiency-filter-severity"
      >
        <option v-for="opt in severityOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>
  </div>
</template>
