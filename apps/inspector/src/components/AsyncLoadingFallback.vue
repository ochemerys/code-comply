<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string
    testId?: string
  }>(),
  {
    label: 'Loading…',
    testId: 'async-loading-fallback',
  },
)
</script>

<template>
  <div
    class="flex min-h-[12rem] flex-col items-center justify-center gap-3 p-6"
    role="status"
    aria-live="polite"
    :aria-label="label"
    :data-testid="testId"
  >
    <div
      class="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary"
      aria-hidden="true"
    />
    <p class="text-sm font-medium text-text-secondary">{{ label }}</p>
  </div>
</template>
