<script setup lang="ts">
/**
 * EditDeficiencyModal — mobile-first modal for editing an existing deficiency (M6-S10).
 * Wraps DeficiencyForm in a dialog; save/cancel and validation follow the shared form.
 */
import { BottomSheet } from '@codecomply/ui'
import { computed } from 'vue'
import type { LocalDeficiency } from '@/lib/db/types'
import DeficiencyForm from '@/components/DeficiencyForm.vue'
import type { DeficiencyFormPayload } from '@/components/deficiency-form.types'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    inspectionId: string
    deficiency: LocalDeficiency | null
    submitting?: boolean
  }>(),
  { submitting: false },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'submit', value: DeficiencyFormPayload): void
  (e: 'cancel'): void
}>()

const isVisible = computed(() => props.modelValue && props.deficiency != null)

function close() {
  emit('update:modelValue', false)
}

function onSheetModelUpdate(open: boolean) {
  if (!open) close()
}

function onSheetClose() {
  emit('cancel')
}

function onCancel() {
  emit('cancel')
  close()
}

function onSubmit(payload: DeficiencyFormPayload) {
  emit('submit', payload)
}
</script>

<template>
  <BottomSheet
    v-if="isVisible && deficiency"
    :model-value="isVisible"
    labelled-by="edit-deficiency-modal-title"
    overlay-test-id="edit-deficiency-modal-overlay"
    data-testid="edit-deficiency-modal"
    @update:model-value="onSheetModelUpdate"
    @close="onSheetClose"
  >
    <div class="flex-shrink-0 border-b border-border-subtle px-5 py-4">
      <h2
        id="edit-deficiency-modal-title"
        class="text-lg font-semibold text-gray-900 dark:text-gray-100"
        data-testid="edit-deficiency-modal-title"
      >
        Edit deficiency
      </h2>
      <p class="mt-1 text-sm text-text-secondary">
        Update description, severity, location, code reference, and due date. Changes work offline
        and sync when you are back online.
      </p>
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
      <DeficiencyForm
        variant="edit"
        :inspection-id="inspectionId"
        :checklist-item-id="deficiency.checklistItemId"
        :initial-deficiency="deficiency"
        :submitting="submitting"
        @submit="onSubmit"
        @cancel="onCancel"
      />
    </div>
  </BottomSheet>
</template>
