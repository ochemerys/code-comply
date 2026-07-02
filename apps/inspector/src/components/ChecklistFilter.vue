<script setup lang="ts">
import { computed } from 'vue'

export type ChecklistFilterMode = 'all' | 'failed' | 'unanswered'

const props = withDefaults(
  defineProps<{
    modelValue: ChecklistFilterMode
    failedCount: number
    unansweredCount: number
  }>(),
  {
    modelValue: 'all',
    failedCount: 0,
    unansweredCount: 0,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: ChecklistFilterMode): void
}>()

const options = computed(
  () =>
    [
      { id: 'all', label: 'All items', badge: undefined },
      { id: 'failed', label: 'Failed only', badge: props.failedCount },
      { id: 'unanswered', label: 'Unanswered only', badge: props.unansweredCount },
    ] as const,
)

function setMode(mode: ChecklistFilterMode) {
  emit('update:modelValue', mode)
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2" data-testid="checklist-filter">
    <div
      class="inline-flex flex-wrap items-stretch gap-2 rounded-2xl"
      role="group"
      aria-label="Checklist filter"
    >
      <button
        v-for="opt in options"
        :key="opt.id"
        type="button"
        class="min-h-touch px-4 rounded-xl border border-border-subtle bg-bg-elevated text-text-primary text-base font-medium hover:bg-gray-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
        :class="modelValue === opt.id ? 'ring-2 ring-primary border-primary' : ''"
        :aria-pressed="modelValue === opt.id"
        :data-testid="`checklist-filter-${opt.id}`"
        @click="setMode(opt.id)"
      >
        <span class="inline-flex items-center gap-2">
          <span>{{ opt.label }}</span>
          <span
            v-if="typeof opt.badge === 'number'"
            class="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full text-sm font-semibold bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-100 tabular-nums"
            :data-testid="`checklist-filter-${opt.id}-count`"
          >
            {{ opt.badge }}
          </span>
        </span>
      </button>
    </div>
  </div>
</template>
