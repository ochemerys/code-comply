<script setup lang="ts">
import { computed, ref } from 'vue'
import WorkloadCalendar, {
  type CalendarVisibleRange,
  type WorkloadInspectionEvent,
} from '../components/WorkloadCalendar.vue'
import {
  defaultCalendarWorkloadRange,
  isSessionExpiredRedirectError,
  useCalendarWorkload,
  type CalendarWorkloadRange,
} from '../composables/useAdminAssignments'

const visibleRange = ref<CalendarWorkloadRange>(defaultCalendarWorkloadRange())

const { data, isPending, isFetching, error } = useCalendarWorkload(visibleRange)

const loading = computed(() => isPending.value || isFetching.value)
const showError = computed(() => !!error.value && !isSessionExpiredRedirectError(error.value))

const inspectors = computed(() => data.value?.inspectors ?? [])
const inspections = computed<WorkloadInspectionEvent[]>(
  () =>
    data.value?.events.map((e) => ({
      id: e.id,
      permitId: e.permitId,
      title: e.title,
      start: e.start,
      inspectorId: e.inspectorId,
      status: e.status as WorkloadInspectionEvent['status'],
    })) ?? [],
)

function onCalendarDatesSet(range: CalendarVisibleRange) {
  visibleRange.value = {
    from: range.start.toISOString(),
    to: range.end.toISOString(),
  }
}
</script>

<template>
  <div class="space-y-4 min-w-0 max-w-full" data-testid="workload-calendar-view">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <p class="text-text-secondary">
        Browse inspector workload by month or week with status cues and quick detail drill-down.
      </p>
    </div>

    <div
      v-if="showError"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
      data-testid="workload-calendar-error"
    >
      {{ error instanceof Error ? error.message : 'Failed to load workload' }}
    </div>

    <WorkloadCalendar
      :inspectors="inspectors"
      :inspections="inspections"
      :loading="loading"
      @dates-set="onCalendarDatesSet"
    />
  </div>
</template>
