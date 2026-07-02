<script setup lang="ts">
import { computed, ref } from 'vue'
import BulkAssignment from '../components/BulkAssignment.vue'
import type { BulkAssignmentRow } from '../components/BulkAssignment.vue'
import {
  isSessionExpiredRedirectError,
  useBulkAssignMutation,
  useBulkAssignmentData,
} from '../composables/useAdminAssignments'

const bulkRef = ref<InstanceType<typeof BulkAssignment> | null>(null)

const { inspectorsQuery, inspectionsQuery } = useBulkAssignmentData()
const bulkMutation = useBulkAssignMutation()

const loading = computed(() => inspectorsQuery.isPending.value || inspectionsQuery.isPending.value)

const showError = computed(
  () =>
    (!!inspectorsQuery.error.value &&
      !isSessionExpiredRedirectError(inspectorsQuery.error.value)) ||
    (!!inspectionsQuery.error.value &&
      !isSessionExpiredRedirectError(inspectionsQuery.error.value)),
)

const inspectors = computed(() =>
  (inspectorsQuery.data.value ?? []).map((u) => ({ id: u.id, name: u.name })),
)

const inspections = computed<BulkAssignmentRow[]>(() => {
  const insp = inspectors.value
  return (inspectionsQuery.data.value ?? []).map((row) => {
    const match = insp.find((i) => i.name === row.assignedInspectorName)
    return {
      id: row.id,
      permitId: row.permitNumber,
      label: row.status,
      inspectorId: match?.id ?? null,
      inspectorName: row.assignedInspectorName ?? null,
    }
  })
})

async function onConfirm(payload: { inspectionIds: string[]; inspectorId: string }) {
  try {
    await bulkMutation.mutateAsync(
      payload.inspectionIds.map((inspectionId) => ({
        inspectionId,
        userId: payload.inspectorId,
      })),
    )
    const name =
      inspectors.value.find((i) => i.id === payload.inspectorId)?.name ?? payload.inspectorId
    bulkRef.value?.showSuccess(
      `Assigned ${payload.inspectionIds.length} inspection${payload.inspectionIds.length === 1 ? '' : 's'} to ${name}.`,
    )
    void inspectionsQuery.refetch()
  } catch (e) {
    bulkRef.value?.showError(e instanceof Error ? e.message : 'Bulk assignment failed')
  }
}
</script>

<template>
  <div class="space-y-4 min-w-0 max-w-full" data-testid="bulk-assignment-view">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <p class="text-text-secondary">
        Select inspections, choose an inspector, preview changes, then confirm a bulk assignment.
      </p>
    </div>

    <div
      v-if="showError"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
      data-testid="bulk-assignment-view-error"
    >
      Failed to load bulk assignment data.
    </div>

    <BulkAssignment
      ref="bulkRef"
      :inspectors="inspectors"
      :inspections="inspections"
      :loading="loading"
      :submitting="bulkMutation.isPending.value"
      @confirm="onConfirm"
    />
  </div>
</template>
