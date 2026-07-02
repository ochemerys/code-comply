<script setup lang="ts">
import type { PermitDetailInspection } from '@/composables/usePermitDetail'

/**
 * InspectionScheduleList - Scheduled inspections for a permit (M4-S11).
 * Lists inspections with date, status, assigned inspector. Start Inspection for SCHEDULED.
 * Mobile-first: semantic tokens, touch targets, dark mode.
 */
defineProps<{
  inspections: PermitDetailInspection[]
}>()

defineEmits<{
  (e: 'start-inspection', inspection: PermitDetailInspection): void
}>()

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

const statusClasses: Record<string, string> = {
  SCHEDULED: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200',
  IN_PROGRESS: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  PASSED: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  FAILED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  CANCELLED: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
}
</script>

<template>
  <section
    class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-5"
    aria-labelledby="schedule-heading"
  >
    <h2 id="schedule-heading" class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
      Scheduled Inspections
    </h2>

    <div
      v-if="inspections.length === 0"
      class="text-sm text-gray-500 dark:text-gray-400 py-4"
      data-testid="inspection-schedule-empty"
    >
      No scheduled inspections.
    </div>

    <ul v-else class="space-y-3" role="list" data-testid="inspection-schedule-list">
      <li
        v-for="inspection in inspections"
        :key="inspection.id"
        class="flex flex-col gap-2 rounded-xl border border-gray-200 dark:border-slate-600 p-4"
        role="listitem"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-sm font-medium text-gray-900 dark:text-gray-100">
            {{ formatDate(inspection.scheduledDate) }}
          </span>
          <span
            :class="[
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
              statusClasses[inspection.status] ??
                'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
            ]"
          >
            {{ inspection.status.replace('_', ' ') }}
          </span>
        </div>
        <p v-if="inspection.assignedInspectorName" class="text-sm text-gray-500 dark:text-gray-400">
          {{ inspection.assignedInspectorName }}
        </p>
        <button
          v-if="inspection.status === 'SCHEDULED' || inspection.status === 'IN_PROGRESS'"
          type="button"
          class="self-start min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-2 px-4 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          :data-testid="
            inspection.status === 'IN_PROGRESS' ? 'continue-inspection-btn' : 'start-inspection-btn'
          "
          @click="$emit('start-inspection', inspection)"
        >
          {{ inspection.status === 'IN_PROGRESS' ? 'Continue inspection' : 'Start inspection' }}
        </button>
      </li>
    </ul>
  </section>
</template>
