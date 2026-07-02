<!--
  SyncProgressBar - Animated progress bar for sync operations

  Displays a progress bar with animation during sync operations.
  Shows indeterminate progress when syncing, and completion state when done.

  @component
  @see M3-S5 - Create Sync Status Indicator Components
  @see Mobile-First Design Guide §8.1 - Transitions
  @see Mobile-First Design Guide §4.1 - Semantic Tokens
-->

<script setup lang="ts">
import { computed } from 'vue'
import type { SyncStatusState } from '@/composables/useSyncStatus'

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  /** Current sync status */
  status: SyncStatusState
  /** Progress percentage (0-100) - if undefined, shows indeterminate */
  progress?: number
  /** Show progress text */
  showText?: boolean
  /** Height variant */
  height?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  progress: undefined,
  showText: false,
  height: 'md',
})

// ─── Computed ────────��───────────────────────────────────────────────────────

/**
 * Whether to show the progress bar.
 * Only show when syncing or if there's an error.
 */
const showProgress = computed(() => {
  return props.status === 'syncing' || props.status === 'error'
})

/**
 * Whether progress is indeterminate (no specific percentage).
 */
const isIndeterminate = computed(() => {
  return props.progress === undefined || props.progress < 0
})

/**
 * Progress bar color classes based on status.
 */
const progressColorClasses = computed(() => {
  switch (props.status) {
    case 'syncing':
      return 'bg-blue-600 dark:bg-blue-500'
    case 'error':
      return 'bg-red-600 dark:bg-red-500'
    case 'online':
      return 'bg-green-600 dark:bg-green-500'
    default:
      return 'bg-gray-600 dark:bg-gray-500'
  }
})

/**
 * Height classes based on height prop.
 */
const heightClasses = computed(() => {
  switch (props.height) {
    case 'sm':
      return 'h-1'
    case 'md':
      return 'h-2'
    case 'lg':
      return 'h-3'
    default:
      return 'h-2'
  }
})

/**
 * Progress percentage clamped to 0-100.
 */
const progressPercent = computed(() => {
  if (isIndeterminate.value) return 0
  return Math.max(0, Math.min(100, props.progress ?? 0))
})

/**
 * Progress text to display.
 */
const progressText = computed(() => {
  if (props.status === 'error') return 'Sync failed'
  if (props.status === 'syncing') {
    if (isIndeterminate.value) return 'Syncing...'
    return `Syncing ${progressPercent.value}%`
  }
  return 'Synced'
})
</script>

<template>
  <div v-if="showProgress" class="w-full">
    <!-- Progress Text (optional) -->
    <div
      v-if="showText"
      class="flex items-center justify-between mb-1 text-sm text-gray-700 dark:text-gray-300"
    >
      <span>{{ progressText }}</span>
      <span v-if="!isIndeterminate" class="font-medium">{{ progressPercent }}%</span>
    </div>

    <!-- Progress Bar Container -->
    <div
      :class="['w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden', heightClasses]"
      role="progressbar"
      :aria-valuenow="isIndeterminate ? undefined : progressPercent"
      :aria-valuemin="0"
      :aria-valuemax="100"
      :aria-label="progressText"
    >
      <!-- Indeterminate Progress (animated) -->
      <div
        v-if="isIndeterminate"
        :class="['h-full rounded-full', 'animate-progress-indeterminate', progressColorClasses]"
        style="width: 40%"
      />

      <!-- Determinate Progress -->
      <div
        v-else
        :class="['h-full rounded-full transition-all duration-300 ease-out', progressColorClasses]"
        :style="{ width: `${progressPercent}%` }"
      />
    </div>
  </div>
</template>

<style scoped>
/**
 * Indeterminate progress animation.
 * Moves the progress bar from left to right continuously.
 */
@keyframes progress-indeterminate {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(350%);
  }
}

.animate-progress-indeterminate {
  animation: progress-indeterminate 1.5s ease-in-out infinite;
}
</style>
