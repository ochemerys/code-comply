<script setup lang="ts">
import { computed, ref } from 'vue'
import AssignmentGrid from '../components/AssignmentGrid.vue'
import {
  isSessionExpiredRedirectError,
  startOfWeekMondayIso,
  useAssignInspectionMutation,
  useAssignmentGrid,
} from '../composables/useAdminAssignments'

const weekStartIso = ref(startOfWeekMondayIso())
const assignError = ref<string | null>(null)

const { data, isPending, isFetching, error, refetch } = useAssignmentGrid(weekStartIso)
const assignMutation = useAssignInspectionMutation()

const loading = computed(() => isPending.value || isFetching.value)

const showError = computed(
  () =>
    (!!error.value && !isSessionExpiredRedirectError(error.value)) ||
    !!assignError.value ||
    !!assignMutation.error.value,
)

const errorMessage = computed(
  () =>
    assignError.value ??
    (assignMutation.error.value instanceof Error ? assignMutation.error.value.message : null) ??
    (error.value instanceof Error ? error.value.message : 'Failed to load assignment grid'),
)

const inspectors = computed(() => data.value?.inspectors ?? [])
const unassigned = computed(() => data.value?.unassigned ?? [])
const assignments = computed(() => data.value?.assignments ?? [])
const maxAssignmentsPerDay = computed(() => data.value?.maxAssignmentsPerDay ?? 5)

async function persistAssign(payload: {
  inspectionId: string
  inspectorId: string
  isoDate: string
}) {
  assignError.value = null
  try {
    await assignMutation.mutateAsync({
      inspectionId: payload.inspectionId,
      userId: payload.inspectorId,
      scheduledDate: `${payload.isoDate}T12:00:00.000Z`,
    })
  } catch (e) {
    assignError.value = e instanceof Error ? e.message : 'Assignment failed'
  }
}
</script>

<template>
  <div class="space-y-4 min-w-0 max-w-full" data-testid="assignment-grid-view">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <p class="text-text-secondary">Plan and rebalance inspector workloads across the week.</p>
      <button
        type="button"
        class="text-sm font-medium text-primary-600 hover:text-primary-800"
        data-testid="assignment-grid-refresh"
        @click="refetch()"
      >
        Refresh
      </button>
    </div>

    <div
      v-if="showError"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
      data-testid="assignment-grid-error"
    >
      {{ errorMessage }}
    </div>

    <AssignmentGrid
      v-model:week-start-iso="weekStartIso"
      :inspectors="inspectors"
      :unassigned="unassigned"
      :assignments="assignments"
      :max-assignments-per-day="maxAssignmentsPerDay"
      :loading="loading"
      @assign="persistAssign"
      @reassign="persistAssign"
    />
  </div>
</template>
