<!--
  SyncStatus - Comprehensive sync status display component

  Displays detailed sync status information including online/offline state,
  pending items count, failed items, last sync time, and manual sync button.
  Combines SyncStatusBadge and SyncProgressBar for a complete status view.

  @component
  @see M3-S5 - Create Sync Status Indicator Components
  @see Mobile-First Design Guide §3.2 - Touch Targets (44px minimum)
  @see Mobile-First Design Guide §4.1 - Semantic Tokens
  @see Mobile-First Design Guide §5.1 - Component Contract
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useSyncStatus } from '@/composables/useSyncStatus'
import SyncStatusBadge from './SyncStatusBadge.vue'
import SyncProgressBar from './SyncProgressBar.vue'

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  /** Display variant */
  variant?: 'compact' | 'detailed' | 'full'
  /** Show manual sync button */
  showSyncButton?: boolean
  /** Show last sync time */
  showLastSync?: boolean
  /** Show failed items */
  showFailed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'detailed',
  showSyncButton: true,
  showLastSync: true,
  showFailed: true,
})

// ─── Composable ──────────────────────────────────────────────────────────────

const {
  status,
  isOnline,
  isSyncing,
  pendingCount,
  failedCount,
  lastSyncedAt,
  lastError,
  triggerSync,
  retryFailed,
  clearFailed,
} = useSyncStatus()

// ─── Computed ────────────────────────────────────────────────────────────────

/**
 * Formatted last sync time.
 */
const lastSyncText = computed(() => {
  if (!lastSyncedAt.value) return 'Never'

  const now = new Date()
  const diff = now.getTime() - lastSyncedAt.value.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
})

/**
 * Whether sync button should be disabled.
 */
const isSyncDisabled = computed(() => {
  return !isOnline.value || isSyncing.value
})

/**
 * Sync button text based on state.
 */
const syncButtonText = computed(() => {
  if (isSyncing.value) return 'Syncing...'
  if (!isOnline.value) return 'Offline'
  return 'Sync Now'
})

/**
 * Whether to show failed items section.
 */
const showFailedSection = computed(() => {
  return props.showFailed && failedCount.value > 0
})
</script>

<template>
  <div class="sync-status">
    <!-- Compact Variant: Badge only -->
    <div v-if="variant === 'compact'" class="flex items-center gap-2">
      <SyncStatusBadge
        :status="status"
        :pending-count="pendingCount"
        :show-count="true"
        size="sm"
      />
    </div>

    <!-- Detailed Variant: Badge + Progress + Info -->
    <div
      v-else-if="variant === 'detailed'"
      class="flex flex-col gap-3 p-4 bg-surface rounded-lg border border-subtle"
    >
      <!-- Header Row -->
      <div class="flex items-center justify-between">
        <SyncStatusBadge
          :status="status"
          :pending-count="pendingCount"
          :show-count="true"
          size="md"
        />

        <!-- Manual Sync Button -->
        <button
          v-if="showSyncButton"
          type="button"
          :disabled="isSyncDisabled"
          :class="[
            'inline-flex items-center justify-center gap-2',
            'h-11 px-4 rounded-lg font-medium text-sm',
            'bg-blue-600 text-white hover:bg-blue-700',
            'active:scale-95',
            'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-all duration-200 ease-out',
            'dark:bg-blue-500 dark:hover:bg-blue-600',
          ]"
          :aria-label="syncButtonText"
          @click="triggerSync"
        >
          <!-- Sync Icon -->
          <svg
            :class="['w-4 h-4', { 'animate-spin': isSyncing }]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span class="hidden tablet:inline">{{ syncButtonText }}</span>
        </button>
      </div>

      <!-- Progress Bar -->
      <SyncProgressBar :status="status" :show-text="false" height="sm" />

      <!-- Info Row -->
      <div class="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <!-- Pending Count -->
        <div class="flex items-center gap-1.5">
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{{ pendingCount }} pending</span>
        </div>

        <!-- Last Sync Time -->
        <div v-if="showLastSync" class="flex items-center gap-1.5">
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{{ lastSyncText }}</span>
        </div>
      </div>

      <!-- Error Message -->
      <div
        v-if="lastError"
        class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400"
        role="alert"
      >
        <svg
          class="w-5 h-5 flex-shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>{{ lastError }}</span>
      </div>
    </div>

    <!-- Full Variant: Everything including failed items management -->
    <div
      v-else-if="variant === 'full'"
      class="flex flex-col gap-4 p-6 bg-surface rounded-xl border border-subtle shadow-sm"
    >
      <!-- Header -->
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Sync Status</h3>
        <SyncStatusBadge
          :status="status"
          :pending-count="pendingCount"
          :show-count="true"
          size="lg"
        />
      </div>

      <!-- Progress Bar -->
      <SyncProgressBar :status="status" :show-text="true" height="md" />

      <!-- Stats Grid -->
      <div class="grid grid-cols-2 gap-4">
        <!-- Pending Items -->
        <div class="flex flex-col gap-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <span class="text-sm text-gray-600 dark:text-gray-400">Pending</span>
          <span class="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {{ pendingCount }}
          </span>
        </div>

        <!-- Failed Items -->
        <div class="flex flex-col gap-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <span class="text-sm text-gray-600 dark:text-gray-400">Failed</span>
          <span class="text-2xl font-bold text-red-600 dark:text-red-400">
            {{ failedCount }}
          </span>
        </div>
      </div>

      <!-- Last Sync Info -->
      <div
        v-if="showLastSync"
        class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
      >
        <svg
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>Last synced {{ lastSyncText }}</span>
      </div>

      <!-- Error Message -->
      <div
        v-if="lastError"
        class="flex items-start gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400"
        role="alert"
      >
        <svg
          class="w-5 h-5 flex-shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div class="flex-1">
          <p class="font-medium mb-1">Sync Error</p>
          <p>{{ lastError }}</p>
        </div>
      </div>

      <!-- Failed Items Management -->
      <div v-if="showFailedSection" class="flex flex-col gap-3 pt-4 border-t border-subtle">
        <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100">
          Failed Items ({{ failedCount || 0 }})
        </h4>
        <div class="flex gap-2">
          <!-- Retry Button -->
          <button
            type="button"
            :class="[
              'flex-1 inline-flex items-center justify-center gap-2',
              'h-11 px-4 rounded-lg font-medium text-sm',
              'bg-blue-600 text-white hover:bg-blue-700',
              'active:scale-95',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
              'transition-all duration-200 ease-out',
              'dark:bg-blue-500 dark:hover:bg-blue-600',
            ]"
            @click="retryFailed"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Retry All
          </button>

          <!-- Clear Button -->
          <button
            type="button"
            :class="[
              'flex-1 inline-flex items-center justify-center gap-2',
              'h-11 px-4 rounded-lg font-medium text-sm',
              'bg-surface border border-subtle hover:bg-gray-50',
              'text-gray-700 dark:text-gray-300',
              'active:scale-95',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500',
              'transition-all duration-200 ease-out',
              'dark:hover:bg-slate-700',
            ]"
            @click="clearFailed"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Clear Failed
          </button>
        </div>
      </div>

      <!-- Manual Sync Button -->
      <button
        v-if="showSyncButton"
        type="button"
        :disabled="isSyncDisabled"
        :class="[
          'w-full inline-flex items-center justify-center gap-2',
          'h-touch px-6 rounded-lg font-medium text-base',
          'bg-blue-600 text-white hover:bg-blue-700',
          'active:scale-95',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-all duration-200 ease-out',
          'dark:bg-blue-500 dark:hover:bg-blue-600',
        ]"
        :aria-label="syncButtonText"
        @click="triggerSync"
      >
        <!-- Sync Icon -->
        <svg
          :class="['w-5 h-5', { 'animate-spin': isSyncing }]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        {{ syncButtonText }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/**
 * Custom CSS variables for semantic tokens.
 * These should ideally be defined in the global Tailwind config.
 */
.bg-surface {
  @apply bg-white dark:bg-slate-800;
}

.border-subtle {
  @apply border-slate-200 dark:border-slate-700;
}
</style>
