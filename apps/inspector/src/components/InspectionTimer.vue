<script setup lang="ts">
/**
 * Elapsed inspection timer display (M5-S17) — HH:MM:SS, tablet-friendly, aria-live while running.
 */
defineProps<{
  displayTime: string
  isRunning: boolean
}>()
</script>

<template>
  <div
    class="flex items-center gap-2 min-h-touch px-3 rounded-xl border border-border-subtle bg-bg-surface tabular-nums"
    data-testid="inspection-timer"
    role="timer"
    :aria-label="`Inspection elapsed time ${displayTime}`"
    :aria-live="isRunning ? 'polite' : 'off'"
  >
    <span class="text-xs font-medium uppercase tracking-wide text-text-secondary">Elapsed</span>
    <time
      class="text-base font-semibold text-text-primary"
      :data-testid="isRunning ? 'inspection-timer-running' : 'inspection-timer-stopped'"
    >
      {{ displayTime }}
    </time>
  </div>
</template>
