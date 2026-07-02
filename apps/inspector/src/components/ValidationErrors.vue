<script setup lang="ts">
import ValidationErrorList, { type ValidationErrorListItem } from './ValidationErrorList.vue'

export type ValidationError = {
  message: string
  hint?: string
  targetId?: string
  actionLabel?: string
  checklistItemId?: string
}

const props = defineProps<{
  errors: ValidationError[]
}>()

const emit = defineEmits<{
  'checklist-item': [itemId: string]
}>()

const mapped = (errors: ValidationError[]): ValidationErrorListItem[] =>
  errors.map((e) => ({
    message: e.message,
    hint: e.hint,
    targetId: e.targetId,
    actionLabel: e.actionLabel,
    checklistItemId: e.checklistItemId,
    severity: 'error',
  }))
</script>

<template>
  <ValidationErrorList
    :errors="mapped(props.errors)"
    data-testid="validation-errors"
    @checklist-item="(id) => emit('checklist-item', id)"
  />
</template>
