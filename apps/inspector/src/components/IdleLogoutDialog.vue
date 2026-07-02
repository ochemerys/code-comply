<script setup lang="ts">
/**
 * Non-dismissible idle warning (M-07). User must interact to stay signed in.
 */
import { BottomSheet } from '@codecomply/ui'
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'stay-signed-in'): void
}>()

const stayButtonRef = ref<HTMLButtonElement | null>(null)

const isOpen = computed(() => props.modelValue)

function onStaySignedIn() {
  emit('stay-signed-in')
  emit('update:modelValue', false)
}

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return
    await nextTick()
    stayButtonRef.value?.focus()
  },
)
</script>

<template>
  <BottomSheet
    v-if="isOpen"
    :model-value="isOpen"
    :dismissible="false"
    role="alertdialog"
    max-width-class="max-w-md"
    labelled-by="idle-logout-title"
    overlay-test-id="idle-logout-overlay"
    data-testid="idle-logout-dialog"
  >
    <div class="p-5">
      <h2
        id="idle-logout-title"
        class="text-lg font-semibold text-text-primary"
        data-testid="idle-logout-title"
      >
        You've been idle
      </h2>
      <p class="mt-2 text-base text-text-secondary" data-testid="idle-logout-message">
        Stay signed in? Any interaction will keep your session active.
      </p>
    </div>
    <div class="p-5 pt-0">
      <button
        ref="stayButtonRef"
        type="button"
        class="min-h-touch w-full rounded-xl bg-primary px-4 text-base font-medium text-white transition-all duration-200 ease-out hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 active:scale-95"
        data-testid="idle-logout-stay"
        @click="onStaySignedIn"
      >
        Stay signed in
      </button>
    </div>
  </BottomSheet>
</template>
