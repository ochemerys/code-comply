<!--
  UploadProgress — aggregate photo upload progress, counts, retry, and cancel.

  @component
  @see M7-S15 - Build Upload Progress Indicator
  @see Mobile-First Design Guide — touch targets, semantic tokens
-->

<script setup lang="ts">
import { computed } from 'vue'

export type UploadProgressItemStatus = 'pending' | 'uploading' | 'uploaded' | 'failed'

export interface UploadProgressItem {
  id: string
  status: UploadProgressItemStatus
  /** Per-item progress 0–100 while uploading */
  progress?: number
  /** Optional label (e.g. file name) */
  label?: string
}

const props = defineProps<{
  items: UploadProgressItem[]
}>()

const emit = defineEmits<{
  retry: [id: string]
  cancel: [id: string]
}>()

const pendingItems = computed(() => props.items.filter((i) => i.status === 'pending'))
const failedItems = computed(() => props.items.filter((i) => i.status === 'failed'))

const pendingCount = computed(() => props.items.filter((i) => i.status === 'pending').length)
const uploadingCount = computed(() => props.items.filter((i) => i.status === 'uploading').length)
const uploadedCount = computed(() => props.items.filter((i) => i.status === 'uploaded').length)
const failedCount = computed(() => props.items.filter((i) => i.status === 'failed').length)

/**
 * Overall percent: each item contributes 0–100; uploaded=100, uploading=clamp(progress), pending/failed=0.
 */
const overallPercent = computed(() => {
  const list = props.items
  if (!list.length) return 0
  let sum = 0
  for (const item of list) {
    if (item.status === 'uploaded') sum += 100
    else if (item.status === 'uploading') sum += Math.max(0, Math.min(100, item.progress ?? 0))
  }
  return Math.round(sum / list.length)
})

const progressBarStyle = computed(() => ({
  width: `${Math.max(0, Math.min(100, overallPercent.value))}%`,
}))

const ariaLabel = computed(() => `Photo upload ${overallPercent.value} percent complete`)
</script>

<template>
  <div
    class="w-full rounded-lg border border-subtle bg-surface p-4 shadow-sm dark:border-slate-700 dark:shadow-none"
  >
    <div class="mb-3 flex items-end justify-between gap-3">
      <span class="text-base font-medium text-gray-900 dark:text-gray-100">Upload progress</span>
      <span
        data-testid="upload-percent-text"
        class="text-base font-semibold tabular-nums text-gray-900 dark:text-gray-100"
        aria-live="polite"
      >
        {{ overallPercent }}%
      </span>
    </div>

    <div
      class="mb-4 h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
      role="progressbar"
      data-testid="upload-progress-bar"
      :aria-valuenow="overallPercent"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="ariaLabel"
    >
      <div
        class="h-full rounded-full bg-blue-600 transition-all duration-300 ease-out dark:bg-blue-500"
        data-testid="upload-progress-bar-fill"
        :style="progressBarStyle"
      />
    </div>

    <div
      class="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-700 dark:text-gray-300"
      data-testid="upload-counts"
    >
      <span data-testid="upload-count-pending">
        Pending: <span class="font-medium tabular-nums">{{ pendingCount }}</span>
      </span>
      <span v-if="uploadingCount > 0" data-testid="upload-count-uploading">
        Uploading: <span class="font-medium tabular-nums">{{ uploadingCount }}</span>
      </span>
      <span data-testid="upload-count-uploaded">
        Uploaded: <span class="font-medium tabular-nums">{{ uploadedCount }}</span>
      </span>
      <span
        data-testid="upload-count-failed"
        :class="[
          'font-medium',
          failedCount > 0 ? 'text-red-700 dark:text-red-400' : 'text-gray-700 dark:text-gray-300',
        ]"
      >
        Failed:
        <span class="tabular-nums">{{ failedCount }}</span>
      </span>
    </div>

    <div v-if="failedItems.length" class="mb-4 space-y-2" data-testid="upload-failed-section">
      <p class="text-sm font-medium text-red-800 dark:text-red-300">Failed uploads</p>
      <ul class="space-y-2" role="list">
        <li
          v-for="item in failedItems"
          :key="item.id"
          :data-testid="`upload-failed-row-${item.id}`"
          class="flex min-h-touch flex-wrap items-center justify-between gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 dark:border-red-800 dark:bg-red-950/40"
        >
          <span class="text-sm text-red-900 dark:text-red-100">
            {{ item.label ?? item.id }}
          </span>
          <button
            type="button"
            class="min-h-touch shrink-0 rounded-lg bg-red-600 px-4 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            :data-testid="`upload-retry-${item.id}`"
            @click="emit('retry', item.id)"
          >
            Retry
          </button>
        </li>
      </ul>
    </div>

    <div v-if="pendingItems.length" class="space-y-2" data-testid="upload-pending-section">
      <p class="text-sm font-medium text-gray-800 dark:text-gray-200">Pending uploads</p>
      <ul class="space-y-2" role="list">
        <li
          v-for="item in pendingItems"
          :key="item.id"
          :data-testid="`upload-pending-row-${item.id}`"
          class="flex min-h-touch flex-wrap items-center justify-between gap-2 rounded-lg border border-subtle bg-gray-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-800/60"
        >
          <span class="text-sm text-gray-800 dark:text-gray-200">
            {{ item.label ?? item.id }}
          </span>
          <button
            type="button"
            class="min-h-touch shrink-0 rounded-lg border border-subtle bg-surface px-4 text-base font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-slate-600 dark:text-gray-100 dark:hover:bg-slate-700 dark:focus:ring-offset-gray-900"
            :data-testid="`upload-cancel-${item.id}`"
            @click="emit('cancel', item.id)"
          >
            Cancel
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
