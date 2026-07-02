<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import {
  INSPECTION_STAGE_LABELS,
  type AdminInspectionWorkflowDetail,
  type InspectionStageDTO,
} from '@codecomply/validators'

const STAGE_OPTIONS = Object.entries(INSPECTION_STAGE_LABELS) as [InspectionStageDTO, string][]

const props = defineProps<{
  workflow: AdminInspectionWorkflowDetail
  disabled?: boolean
  saving?: boolean
}>()

const emit = defineEmits<{
  save: [
    payload: {
      stages: InspectionStageDTO[]
      otherStageDescription: string | null
      noFurtherInspectionsRequired: boolean
    },
  ]
}>()

const form = reactive({
  stages: [] as InspectionStageDTO[],
  otherStageDescription: '',
  noFurtherInspectionsRequired: false,
})

const showOtherDescription = computed(() => form.stages.includes('OTHER'))

watch(
  () => props.workflow,
  (wf) => {
    form.stages = [...wf.stages]
    form.otherStageDescription = wf.otherStageDescription ?? ''
    form.noFurtherInspectionsRequired = wf.noFurtherInspectionsRequired
  },
  { immediate: true },
)

function toggleStage(stage: InspectionStageDTO) {
  if (form.stages.includes(stage)) {
    form.stages = form.stages.filter((s) => s !== stage)
  } else {
    form.stages = [...form.stages, stage]
  }
}

function onSave() {
  emit('save', {
    stages: form.stages,
    otherStageDescription: showOtherDescription.value ? form.otherStageDescription.trim() : null,
    noFurtherInspectionsRequired: form.noFurtherInspectionsRequired,
  })
}
</script>

<template>
  <section
    class="rounded-lg border border-border-subtle bg-bg-surface shadow-sm"
    data-testid="inspection-stages-panel"
  >
    <header class="border-b border-border-subtle px-4 py-3">
      <h2 class="text-base font-semibold text-text-primary">Inspection stages</h2>
      <p class="text-xs text-text-secondary mt-0.5">
        Multi-select stages and closure flag (LSC-A-02).
      </p>
    </header>
    <div class="px-4 py-4 space-y-4">
      <fieldset class="space-y-2" data-testid="inspection-stages-checkboxes">
        <legend class="sr-only">Inspection stages</legend>
        <label
          v-for="[value, label] in STAGE_OPTIONS"
          :key="value"
          class="flex items-center gap-2 text-sm text-text-primary"
          :data-testid="`inspection-stage-${value}`"
        >
          <input
            type="checkbox"
            :checked="form.stages.includes(value)"
            class="rounded border-border-strong"
            :disabled="disabled"
            @change="toggleStage(value)"
          />
          {{ label }}
        </label>
      </fieldset>
      <div v-if="showOtherDescription">
        <label for="other-stage-desc" class="block text-sm font-medium text-text-secondary mb-1">
          Other stage description
        </label>
        <input
          id="other-stage-desc"
          v-model="form.otherStageDescription"
          type="text"
          class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
          :disabled="disabled"
          data-testid="inspection-other-stage-description"
        />
      </div>
      <label class="flex items-center gap-2 text-sm text-text-primary">
        <input
          v-model="form.noFurtherInspectionsRequired"
          type="checkbox"
          class="rounded border-border-strong"
          :disabled="disabled"
          data-testid="inspection-no-further-required"
        />
        No further inspections required
      </label>
    </div>
    <footer class="border-t border-border-subtle px-4 py-3 flex justify-end">
      <button
        type="button"
        class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        :disabled="disabled || saving"
        data-testid="inspection-stages-save"
        @click="onSave"
      >
        {{ saving ? 'Saving…' : 'Save stages' }}
      </button>
    </footer>
  </section>
</template>
