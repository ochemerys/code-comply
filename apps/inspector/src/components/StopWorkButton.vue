<script setup lang="ts">
/**
 * StopWorkButton — prominent field CTA to start the Stop Work workflow (M6-S15).
 */
defineProps<{
  /** Disable while other deficiency actions run */
  disabled?: boolean
}>()

defineEmits<{
  (e: 'request'): void
}>()
</script>

<template>
  <button
    type="button"
    class="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-red-700 bg-red-600 px-4 py-3 text-base font-bold uppercase tracking-wide text-white shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:border-red-500 dark:focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
    data-testid="stop-work-order-button"
    :disabled="disabled"
    aria-label="Issue Stop Work order for this deficiency"
    @click="$emit('request')"
  >
    <svg
      class="h-6 w-6 shrink-0"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
      />
    </svg>
    <span>Stop work order</span>
  </button>
</template>
