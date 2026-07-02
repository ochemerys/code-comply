<script setup lang="ts">
import type { PermitStatusFilter, PermitSortOption } from '@/composables/usePermitList'

/**
 * PermitFilters - Filter and sort controls for permit list (M4-S10).
 * Filters: status, hasScheduledInspection.
 * Sort: date, distance, permitNumber.
 */
const props = withDefaults(
  defineProps<{
    statusFilter: PermitStatusFilter
    hasScheduledInspectionOnly: boolean
    sortBy: PermitSortOption
    disabled?: boolean
    /** Flat style when nested inside another panel (e.g. Permits tools drawer) */
    embedded?: boolean
  }>(),
  { disabled: false, embedded: false },
)

const emit = defineEmits<{
  (e: 'update:statusFilter', value: PermitStatusFilter): void
  (e: 'update:hasScheduledInspectionOnly', value: boolean): void
  (e: 'update:sortBy', value: PermitSortOption): void
}>()

const STATUS_OPTIONS: { value: PermitStatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const SORT_OPTIONS: { value: PermitSortOption; label: string }[] = [
  { value: 'permitNumber', label: 'Permit number' },
  { value: 'date', label: 'Next inspection date' },
  { value: 'distance', label: 'Distance' },
]

function onStatusChange(event: Event): void {
  const target = event.target as HTMLSelectElement
  emit('update:statusFilter', target.value as PermitStatusFilter)
}

function onSortChange(event: Event): void {
  const target = event.target as HTMLSelectElement
  emit('update:sortBy', target.value as PermitSortOption)
}

function onHasScheduledChange(event: Event): void {
  const target = event.target as HTMLInputElement
  emit('update:hasScheduledInspectionOnly', target.checked)
}
</script>

<template>
  <!-- §5.2 Form Design Pattern: one card for search + filter/sort; grid-cols-1 (phone), md:grid-cols-2 (tablet) -->
  <div
    :class="[
      'permit-filters',
      props.embedded
        ? 'bg-transparent dark:bg-transparent border-0 shadow-none p-0'
        : 'bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-4 md:p-5',
    ]"
    role="group"
    aria-label="Search, filter and sort permits"
  >
    <slot v-if="$slots.default" />
    <div v-if="$slots.default" class="border-t border-gray-100 dark:border-slate-700 mt-4 pt-4" />
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
      <!-- Status filter -->
      <div>
        <label
          for="permit-status-filter"
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Status
        </label>
        <select
          id="permit-status-filter"
          :value="statusFilter"
          :disabled="disabled"
          class="w-full h-11 min-h-touch px-4 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Filter by permit status"
          @change="onStatusChange"
        >
          <option v-for="opt in STATUS_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <!-- Sort by -->
      <div>
        <label
          for="permit-sort"
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Sort by
        </label>
        <select
          id="permit-sort"
          :value="sortBy"
          :disabled="disabled"
          class="w-full h-11 min-h-touch px-4 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Sort permits"
          @change="onSortChange"
        >
          <option v-for="opt in SORT_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <!-- Checkbox: full-width row (§5.2 form stacks naturally) -->
      <div class="flex items-center md:col-span-2">
        <label class="flex items-center gap-3 min-h-touch cursor-pointer select-none py-1">
          <input
            id="permit-has-scheduled"
            type="checkbox"
            :checked="hasScheduledInspectionOnly"
            :disabled="disabled"
            class="h-5 w-5 min-h-[20px] min-w-[20px] rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
            aria-label="Show only permits with scheduled inspection"
            @change="onHasScheduledChange"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">
            Only with scheduled inspection
          </span>
        </label>
      </div>
    </div>
  </div>
</template>
