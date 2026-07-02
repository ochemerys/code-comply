<script setup lang="ts">
/**
 * Non-dismissible idle warning (NFR-A-01). User must interact to stay signed in.
 */
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
  <teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-testid="idle-logout-overlay"
      role="presentation"
    >
      <div
        class="w-full max-w-md rounded-lg border border-border-subtle bg-bg-surface shadow-lg"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="idle-logout-title"
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
          <p class="mt-2 text-sm text-text-secondary" data-testid="idle-logout-message">
            Stay signed in? Any interaction will keep your session active.
          </p>
        </div>
        <div class="p-5 pt-0">
          <button
            ref="stayButtonRef"
            type="button"
            class="w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            data-testid="idle-logout-stay"
            @click="onStaySignedIn"
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>
