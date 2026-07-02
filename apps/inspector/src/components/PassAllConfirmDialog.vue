<script setup lang="ts">
import { BottomSheet } from '@codecomply/ui'
import { computed, nextTick, ref, watch } from 'vue'

interface Props {
  modelValue: boolean
  count: number
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Pass All Items?',
  message: 'This will mark {count} items as PASS',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const cancelButtonRef = ref<HTMLButtonElement | null>(null)

const isOpen = computed(() => props.modelValue)

const dialogMessage = computed(() => String(props.message).replace('{count}', String(props.count)))

function close() {
  emit('update:modelValue', false)
}

function onCancel() {
  emit('cancel')
  close()
}

function onConfirm() {
  emit('confirm')
  close()
}

function onSheetModelUpdate(open: boolean) {
  if (!open) close()
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
    max-width-class="max-w-md"
    labelled-by="pass-all-dialog-title"
    overlay-test-id="pass-all-dialog-overlay"
    data-testid="pass-all-dialog"
    @update:model-value="onSheetModelUpdate"
    @close="onCancel"
  >
    <div class="p-5">
      <h2
        id="pass-all-dialog-title"
        class="text-lg font-semibold text-text-primary"
        data-testid="pass-all-dialog-title"
      >
        {{ title }}
      </h2>
      <p class="mt-2 text-base text-text-secondary" data-testid="pass-all-dialog-message">
        {{ dialogMessage }}
      </p>
    </div>
    <div class="flex gap-2 p-5 pt-0">
      <button
        ref="cancelButtonRef"
        type="button"
        class="flex-1 min-h-touch px-4 rounded-xl border border-border-subtle bg-bg-surface text-text-primary text-base font-medium hover:bg-gray-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary active:scale-95 transition-all duration-200 ease-out"
        data-testid="pass-all-dialog-cancel"
        @click="onCancel"
      >
        {{ cancelText }}
      </button>
      <button
        type="button"
        class="flex-1 min-h-touch px-4 rounded-xl bg-primary text-white text-base font-medium hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary active:scale-95 transition-all duration-200 ease-out"
        data-testid="pass-all-dialog-confirm"
        @click="onConfirm"
      >
        {{ confirmText }}
      </button>
    </div>
  </BottomSheet>
</template>
