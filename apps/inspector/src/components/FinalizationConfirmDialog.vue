<script setup lang="ts">
/**
 * Confirmation step before persisting finalization (GPS, outcome, signature).
 * Mobile-first modal aligned with PassAllConfirmDialog patterns.
 */
import { BottomSheet } from '@codecomply/ui'
import { computed, nextTick, ref, watch } from 'vue'

interface Props {
  modelValue: boolean
  loading?: boolean
  outcomeLabel: string
  permitSummary?: string
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
}

const props = withDefaults(defineProps<Props>(), {
  permitSummary: '',
  title: 'Finalize inspection?',
  message:
    'This action cannot be undone. Once finalized and synced, the inspection becomes read-only. This records your outcome, signature, location (when available), and timestamps the inspection.',
  confirmText: 'Finalize',
  cancelText: 'Cancel',
  loading: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const cancelButtonRef = ref<HTMLButtonElement | null>(null)

const isOpen = computed(() => props.modelValue)
const canClose = computed(() => props.loading !== true)

function close() {
  emit('update:modelValue', false)
}

function onCancel() {
  if (!canClose.value) return
  emit('cancel')
  close()
}

function onConfirm() {
  if (props.loading) return
  emit('confirm')
}

function onSheetModelUpdate(open: boolean) {
  if (!open && canClose.value) close()
}

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return
    await nextTick()
    cancelButtonRef.value?.focus()
  },
)
</script>

<template>
  <BottomSheet
    v-if="isOpen"
    :model-value="isOpen"
    :dismissible="canClose"
    max-width-class="max-w-md"
    labelled-by="finalization-confirm-title"
    overlay-test-id="finalization-confirm-overlay"
    data-testid="finalization-confirm-dialog"
    @update:model-value="onSheetModelUpdate"
    @close="onCancel"
  >
    <div class="p-5">
      <h2
        id="finalization-confirm-title"
        class="text-lg font-semibold text-text-primary"
        data-testid="finalization-confirm-title"
      >
        {{ title }}
      </h2>
      <p class="mt-2 text-base text-text-secondary" data-testid="finalization-confirm-message">
        {{ message }}
      </p>
      <dl class="mt-4 space-y-2 text-sm">
        <div v-if="permitSummary" class="flex flex-col gap-0.5">
          <dt class="font-medium text-text-secondary">Permit</dt>
          <dd class="text-text-primary" data-testid="finalization-confirm-permit">
            {{ permitSummary }}
          </dd>
        </div>
        <div class="flex flex-col gap-0.5">
          <dt class="font-medium text-text-secondary">Outcome</dt>
          <dd class="text-text-primary" data-testid="finalization-confirm-outcome">
            {{ outcomeLabel }}
          </dd>
        </div>
      </dl>
    </div>
    <div class="flex gap-2 p-5 pt-0">
      <button
        ref="cancelButtonRef"
        type="button"
        class="min-h-touch flex-1 rounded-xl border border-border-subtle bg-bg-surface px-4 text-base font-medium text-text-primary transition-all duration-200 ease-out hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary active:scale-95 dark:hover:bg-slate-800"
        data-testid="finalization-confirm-cancel"
        :disabled="!canClose"
        :class="!canClose ? 'cursor-not-allowed opacity-50' : ''"
        @click="onCancel"
      >
        {{ cancelText }}
      </button>
      <button
        type="button"
        class="min-h-touch flex-1 rounded-xl bg-primary px-4 text-base font-medium text-white transition-all duration-200 ease-out hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 active:scale-95"
        data-testid="finalization-confirm-ok"
        :disabled="loading"
        :class="loading ? 'cursor-not-allowed opacity-50' : ''"
        @click="onConfirm"
      >
        {{ loading ? 'Finalizing…' : confirmText }}
      </button>
    </div>
  </BottomSheet>
</template>
