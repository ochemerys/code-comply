<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { AdminInspectionWorkflowDetail } from '@codecomply/validators'
import { fromDateInput, toDateInputValue } from '../composables/useAdminInspectionDetail'

const props = defineProps<{
  workflow: AdminInspectionWorkflowDetail
  disabled?: boolean
  saving?: boolean
}>()

const emit = defineEmits<{
  save: [
    payload: {
      requestedDate: string | null
      plannedDate: string | null
      actualDate: string | null
    },
  ]
}>()

const form = reactive({
  requestedDate: '',
  plannedDate: '',
  actualDate: '',
})

watch(
  () => props.workflow,
  (wf) => {
    form.requestedDate = toDateInputValue(wf.requestedDate)
    form.plannedDate = toDateInputValue(wf.plannedDate)
    form.actualDate = toDateInputValue(wf.actualDate)
  },
  { immediate: true },
)

function onSave() {
  emit('save', {
    requestedDate: fromDateInput(form.requestedDate),
    plannedDate: fromDateInput(form.plannedDate),
    actualDate: fromDateInput(form.actualDate),
  })
}
</script>

<template>
  <section
    class="rounded-lg border border-border-subtle bg-bg-surface shadow-sm"
    data-testid="inspection-dates-panel"
  >
    <header class="border-b border-border-subtle px-4 py-3">
      <h2 class="text-base font-semibold text-text-primary">Inspection dates</h2>
      <p class="text-xs text-text-secondary mt-0.5">
        Requested, planned, and actual dates (LSC-A-01).
      </p>
    </header>
    <div class="px-4 py-4 grid gap-4 sm:grid-cols-3">
      <div>
        <label for="requested-date" class="block text-sm font-medium text-text-secondary mb-1">
          Requested date
        </label>
        <input
          id="requested-date"
          v-model="form.requestedDate"
          type="date"
          class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
          :disabled="disabled"
          data-testid="inspection-requested-date"
        />
      </div>
      <div>
        <label for="planned-date" class="block text-sm font-medium text-text-secondary mb-1">
          Planned inspection date
        </label>
        <input
          id="planned-date"
          v-model="form.plannedDate"
          type="date"
          class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
          :disabled="disabled"
          data-testid="inspection-planned-date"
        />
      </div>
      <div>
        <label for="actual-date" class="block text-sm font-medium text-text-secondary mb-1">
          Actual inspection date
        </label>
        <input
          id="actual-date"
          v-model="form.actualDate"
          type="date"
          class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
          :disabled="disabled"
          data-testid="inspection-actual-date"
        />
      </div>
    </div>
    <footer class="border-t border-border-subtle px-4 py-3 flex justify-end">
      <button
        type="button"
        class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        :disabled="disabled || saving"
        data-testid="inspection-dates-save"
        @click="onSave"
      >
        {{ saving ? 'Saving…' : 'Save dates' }}
      </button>
    </footer>
  </section>
</template>
