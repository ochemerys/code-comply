<script setup lang="ts">
import { computed, ref } from 'vue'
import InspectionSelector, { type InspectionSelectorRow } from './InspectionSelector.vue'

export interface BulkAssignmentInspector {
  id: string
  name: string
}

export interface BulkAssignmentRow extends InspectionSelectorRow {
  inspectorId: string | null
  inspectorName?: string | null
}

const props = withDefaults(
  defineProps<{
    inspectors: BulkAssignmentInspector[]
    inspections: BulkAssignmentRow[]
    loading?: boolean
    submitting?: boolean
  }>(),
  {
    loading: false,
    submitting: false,
  },
)

const emit = defineEmits<{
  confirm: [payload: { inspectionIds: string[]; inspectorId: string }]
}>()

const selectedIds = ref<string[]>([])
const targetInspectorId = ref<string>('')

type Feedback = { type: 'success' | 'error'; message: string } | null
const feedback = ref<Feedback>(null)

const inspectorNameById = computed(() => {
  const m = new Map<string, string>()
  for (const i of props.inspectors) m.set(i.id, i.name)
  return m
})

const selectorRows = computed<InspectionSelectorRow[]>(() =>
  props.inspections.map(({ id, permitId, label }) => ({ id, permitId, label })),
)

const selectedRows = computed(() => {
  const set = new Set(selectedIds.value)
  return props.inspections.filter((r) => set.has(r.id))
})

const targetInspectorName = computed(() => {
  if (!targetInspectorId.value) return ''
  return inspectorNameById.value.get(targetInspectorId.value) ?? targetInspectorId.value
})

const previewRows = computed(() => {
  if (!targetInspectorId.value || selectedIds.value.length === 0) return []
  return selectedRows.value.map((r) => ({
    id: r.id,
    permitId: r.permitId,
    label: r.label,
    fromName:
      r.inspectorId === null
        ? 'Unassigned'
        : (r.inspectorName ?? inspectorNameById.value.get(r.inspectorId) ?? r.inspectorId),
    toName: targetInspectorName.value,
  }))
})

function clearFeedback() {
  feedback.value = null
}

function confirmBulkAssign() {
  clearFeedback()
  if (selectedIds.value.length === 0) {
    feedback.value = {
      type: 'error',
      message: 'Select at least one inspection before confirming.',
    }
    return
  }
  if (!targetInspectorId.value) {
    feedback.value = {
      type: 'error',
      message: 'Choose an inspector to assign.',
    }
    return
  }

  emit('confirm', {
    inspectionIds: [...selectedIds.value],
    inspectorId: targetInspectorId.value,
  })
}

function showSuccess(message: string) {
  const n = selectedIds.value.length
  selectedIds.value = []
  feedback.value = {
    type: 'success',
    message:
      message || `Assigned ${n} inspection${n === 1 ? '' : 's'} to ${targetInspectorName.value}.`,
  }
}

function showError(message: string) {
  feedback.value = { type: 'error', message }
}

defineExpose({ showSuccess, showError })
</script>

<template>
  <section
    class="bg-bg-surface rounded-lg shadow border border-border-subtle p-4 sm:p-6 max-w-full min-w-0 space-y-6"
    data-testid="bulk-assignment"
  >
    <div v-if="loading" class="text-sm text-text-secondary" data-testid="bulk-assignment-loading">
      Loading inspections…
    </div>

    <div class="grid gap-6 lg:grid-cols-2 lg:items-start">
      <InspectionSelector v-model:selected-ids="selectedIds" :inspections="selectorRows" />

      <div class="space-y-4 min-w-0">
        <div>
          <label
            for="bulk-assignment-inspector"
            class="block text-sm font-semibold text-text-primary mb-2"
          >
            Assign to inspector
          </label>
          <select
            id="bulk-assignment-inspector"
            v-model="targetInspectorId"
            class="w-full rounded-lg border border-border-strong bg-bg-surface px-3 py-2.5 text-sm text-text-primary shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px]"
            data-testid="bulk-assignment-inspector"
            @change="clearFeedback"
          >
            <option value="">Choose inspector…</option>
            <option v-for="insp in inspectors" :key="insp.id" :value="insp.id">
              {{ insp.name }}
            </option>
          </select>
        </div>

        <div
          v-if="previewRows.length > 0"
          class="rounded-lg border border-border-subtle overflow-hidden"
          data-testid="bulk-assignment-preview"
        >
          <div
            class="bg-bg-app px-3 py-2 text-sm font-semibold text-text-primary border-b border-border-subtle"
          >
            Preview
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead>
                <tr class="border-b border-border-subtle text-left text-text-secondary">
                  <th class="px-3 py-2 font-medium">Permit</th>
                  <th class="px-3 py-2 font-medium hidden sm:table-cell">Type</th>
                  <th class="px-3 py-2 font-medium">From</th>
                  <th class="px-3 py-2 font-medium">To</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in previewRows"
                  :key="row.id"
                  class="border-b border-border-subtle last:border-0"
                  :data-testid="`bulk-assignment-preview-row-${row.id}`"
                >
                  <td class="px-3 py-2 font-medium text-text-primary">
                    {{ row.permitId }}
                  </td>
                  <td class="px-3 py-2 text-text-secondary hidden sm:table-cell">
                    {{ row.label }}
                  </td>
                  <td class="px-3 py-2 text-text-secondary">
                    {{ row.fromName }}
                  </td>
                  <td class="px-3 py-2 text-text-primary">
                    {{ row.toName }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:pointer-events-none min-h-[44px] min-w-[8rem]"
            data-testid="bulk-assignment-confirm"
            :disabled="submitting"
            @click="confirmBulkAssign"
          >
            {{ submitting ? 'Assigning…' : 'Confirm bulk assign' }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="feedback"
      role="status"
      class="rounded-lg px-4 py-3 text-sm font-medium"
      :class="
        feedback.type === 'success'
          ? 'bg-green-50 text-green-900 border border-green-200'
          : 'bg-red-50 text-red-900 border border-red-200'
      "
      data-testid="bulk-assignment-feedback"
    >
      {{ feedback.message }}
    </div>
  </section>
</template>
