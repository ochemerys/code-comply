<template>
  <button
    type="button"
    class="deficiency-indicator inline-flex items-center justify-center gap-2 min-h-touch min-w-0 px-3 rounded-xl border-2 border-amber-500 bg-amber-50 text-amber-950 text-base font-semibold shadow-sm dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-100 dark:shadow-none hover:bg-amber-100 dark:hover:bg-amber-900/50 active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
    :aria-label="ariaLabel"
    data-testid="deficiency-indicator"
    @click="$emit('activate')"
  >
    <svg
      class="w-5 h-5 shrink-0 text-amber-700 dark:text-amber-300"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
    <span data-testid="deficiency-indicator-count">{{ count }}</span>
    <span class="text-sm font-medium opacity-90">{{
      count === 1 ? 'deficiency' : 'deficiencies'
    }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  /** Number of deficiencies linked to this checklist item (must be ≥ 1 when shown). */
  count: number
}>()

defineEmits<{
  /** User tapped to open the deficiency list for this item. */
  activate: []
}>()

const ariaLabel = computed(() => {
  const n = props.count
  const noun = n === 1 ? 'deficiency' : 'deficiencies'
  return `${n} linked ${noun} for this checklist item. Open deficiency list filtered to this item.`
})
</script>

<style scoped>
.deficiency-indicator {
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
</style>
