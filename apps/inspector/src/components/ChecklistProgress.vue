<template>
  <div
    :class="[
      'checklist-progress',
      'bg-surface border border-subtle rounded-lg p-4 tablet:p-6',
      'transition-all duration-200',
      {
        'border-green-500 bg-green-50 dark:bg-green-900/10': isComplete,
      },
    ]"
    role="region"
    aria-label="Checklist Progress"
  >
    <!-- Progress Header -->
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-base tablet:text-lg font-semibold text-primary">Progress</h2>
      <span
        :class="[
          'text-2xl tablet:text-3xl font-bold',
          isComplete ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400',
        ]"
        aria-live="polite"
        aria-atomic="true"
      >
        {{ progressPercentage }}%
      </span>
    </div>

    <!-- Progress Bar -->
    <div
      class="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-4"
      role="progressbar"
      :aria-valuenow="progressPercentage"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="`${progressPercentage}% complete`"
    >
      <div
        :class="[
          'absolute top-0 left-0 h-full rounded-full transition-all duration-500 ease-out',
          isComplete ? 'bg-green-600 dark:bg-green-500' : 'bg-blue-600 dark:bg-blue-500',
        ]"
        :style="{ width: `${progressPercentage}%` }"
      />
    </div>

    <!-- Counts Grid -->
    <div class="grid grid-cols-2 tablet:grid-cols-4 gap-3 tablet:gap-4">
      <!-- Passed Count -->
      <div
        class="flex flex-col items-center p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
      >
        <div class="flex items-center gap-2 mb-1">
          <svg
            class="w-5 h-5 text-green-600 dark:text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span class="text-2xl font-bold text-green-600 dark:text-green-400" aria-live="polite">
            {{ passedCount }}
          </span>
        </div>
        <span class="text-xs tablet:text-sm font-medium text-green-700 dark:text-green-300">
          Passed
        </span>
      </div>

      <!-- Failed Count -->
      <div
        class="flex flex-col items-center p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
      >
        <div class="flex items-center gap-2 mb-1">
          <svg
            class="w-5 h-5 text-red-600 dark:text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          <span class="text-2xl font-bold text-red-600 dark:text-red-400" aria-live="polite">
            {{ failedCount }}
          </span>
        </div>
        <span class="text-xs tablet:text-sm font-medium text-red-700 dark:text-red-300">
          Failed
        </span>
      </div>

      <!-- N/A Count -->
      <div
        class="flex flex-col items-center p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg"
      >
        <div class="flex items-center gap-2 mb-1">
          <svg
            class="w-5 h-5 text-gray-600 dark:text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
          </svg>
          <span class="text-2xl font-bold text-gray-600 dark:text-gray-400" aria-live="polite">
            {{ naCount }}
          </span>
        </div>
        <span class="text-xs tablet:text-sm font-medium text-gray-700 dark:text-gray-300">
          N/A
        </span>
      </div>

      <!-- Unanswered Count -->
      <div
        class="flex flex-col items-center p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
      >
        <div class="flex items-center gap-2 mb-1">
          <svg
            class="w-5 h-5 text-blue-600 dark:text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span class="text-2xl font-bold text-blue-600 dark:text-blue-400" aria-live="polite">
            {{ unansweredCount }}
          </span>
        </div>
        <span class="text-xs tablet:text-sm font-medium text-blue-700 dark:text-blue-300">
          Remaining
        </span>
      </div>
    </div>

    <!-- Complete Badge -->
    <div
      v-if="isComplete"
      class="mt-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg"
      role="status"
      aria-live="polite"
    >
      <div class="flex items-center justify-center gap-2">
        <svg
          class="w-6 h-6 text-green-600 dark:text-green-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span class="text-base font-semibold text-green-700 dark:text-green-300">
          Checklist Complete
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface ChecklistProgressData {
  passedCount: number
  failedCount: number
  naCount: number
  unansweredCount: number
}

interface Props {
  progress: ChecklistProgressData
}

const props = defineProps<Props>()

// Computed: Total items
const totalItems = computed(() => {
  return (
    props.progress.passedCount +
    props.progress.failedCount +
    props.progress.naCount +
    props.progress.unansweredCount
  )
})

// Computed: Answered items
const answeredItems = computed(() => {
  return props.progress.passedCount + props.progress.failedCount + props.progress.naCount
})

// Computed: Progress percentage
const progressPercentage = computed(() => {
  if (totalItems.value === 0) return 0
  return Math.round((answeredItems.value / totalItems.value) * 100)
})

// Computed: Is complete
const isComplete = computed(() => {
  return props.progress.unansweredCount === 0 && totalItems.value > 0
})

// Expose counts for easy access
const passedCount = computed(() => props.progress.passedCount)
const failedCount = computed(() => props.progress.failedCount)
const naCount = computed(() => props.progress.naCount)
const unansweredCount = computed(() => props.progress.unansweredCount)
</script>

<style scoped>
.checklist-progress {
  -webkit-tap-highlight-color: transparent;
}

/* Smooth transitions for progress bar */
.checklist-progress [role='progressbar'] > div {
  transition-property: width, background-color;
  transition-timing-function: ease-out;
  transition-duration: 500ms;
}

/* Ensure counts update smoothly */
[aria-live='polite'] {
  transition: color 200ms ease-out;
}
</style>
