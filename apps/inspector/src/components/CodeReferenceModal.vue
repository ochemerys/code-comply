<script setup lang="ts">
import { BottomSheet } from '@codecomply/ui'
import { computed, nextTick, ref, watch } from 'vue'
import CodeReferenceSearch from '@/components/CodeReferenceSearch.vue'
import type { CodeReference } from '@/lib/db/types'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    /** Checklist item label for context (optional) */
    itemLabel?: string
  }>(),
  { itemLabel: '' },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'select', ref: CodeReference): void
  (e: 'cancel'): void
}>()

const searchRef = ref<InstanceType<typeof CodeReferenceSearch> | null>(null)

const isOpen = computed(() => props.modelValue)

function close() {
  emit('update:modelValue', false)
}

function onCancel() {
  emit('cancel')
  close()
}

function onSelect(ref: CodeReference) {
  emit('select', ref)
  close()
}

function onSheetModelUpdate(open: boolean) {
  if (!open) close()
}

function onSheetClose() {
  emit('cancel')
}

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return
    await nextTick()
    searchRef.value?.focusSearch()
  },
)
</script>

<template>
  <BottomSheet
    v-if="isOpen"
    :model-value="isOpen"
    panel-class="max-h-[85dvh]"
    labelled-by="code-reference-modal-title"
    overlay-test-id="code-reference-modal-overlay"
    data-testid="code-reference-modal"
    @update:model-value="onSheetModelUpdate"
    @close="onSheetClose"
  >
    <div class="flex-shrink-0 p-5 border-b border-border-subtle">
      <h2
        id="code-reference-modal-title"
        class="text-lg font-semibold text-text-primary"
        data-testid="code-reference-modal-title"
      >
        Select code reference
      </h2>
      <p v-if="itemLabel" class="mt-1 text-sm text-text-secondary line-clamp-2">
        {{ itemLabel }}
      </p>
      <p class="mt-2 text-sm text-text-secondary" data-testid="code-reference-modal-hint">
        Search cached and synced codes. Your choice is saved with this failed item.
      </p>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5">
      <CodeReferenceSearch ref="searchRef" @select="onSelect" />
    </div>

    <div class="flex-shrink-0 p-5 pt-0">
      <button
        type="button"
        class="w-full min-h-touch px-4 rounded-xl border border-border-subtle bg-bg-surface text-text-primary text-base font-medium hover:bg-gray-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
        data-testid="code-reference-modal-cancel"
        @click="onCancel"
      >
        Cancel
      </button>
    </div>
  </BottomSheet>
</template>
