<!--
  SyncStatusBadge - Compact sync status indicator badge

  Displays a small badge showing the current sync status with icon and color.
  Used in navigation bars, headers, or anywhere a compact status indicator is needed.

  @component
  @see M3-S5 - Create Sync Status Indicator Components
  @see Mobile-First Design Guide §4.1 - Semantic Tokens
  @see Mobile-First Design Guide §3.2 - Touch Targets
-->

<script setup lang="ts">
import { computed } from 'vue'
import type { SyncStatusState } from '@/composables/useSyncStatus'

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  /** Current sync status */
  status: SyncStatusState
  /** Number of pending items */
  pendingCount?: number
  /** Show pending count badge */
  showCount?: boolean
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  pendingCount: 0,
  showCount: true,
  size: 'md',
})

// ─── Computed ───────────────��────────────────────────────────────────────────

/**
 * Status icon based on current state.
 */
const statusIcon = computed(() => {
  switch (props.status) {
    case 'online':
      return 'check-circle'
    case 'offline':
      return 'wifi-off'
    case 'syncing':
      return 'refresh-cw'
    case 'error':
      return 'alert-circle'
    default:
      return 'help-circle'
  }
})

/**
 * Status color classes based on current state.
 * Uses semantic tokens from design guide.
 */
const statusColorClasses = computed(() => {
  switch (props.status) {
    case 'online':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    case 'offline':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
    case 'syncing':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'error':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
  }
})

/**
 * Status label text.
 */
const statusLabel = computed(() => {
  switch (props.status) {
    case 'online':
      return 'Synced'
    case 'offline':
      return 'Offline'
    case 'syncing':
      return 'Syncing'
    case 'error':
      return 'Error'
    default:
      return 'Unknown'
  }
})

/**
 * Size classes based on size prop.
 */
const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'px-2 py-1 text-xs gap-1'
    case 'md':
      return 'px-3 py-1.5 text-sm gap-1.5'
    case 'lg':
      return 'px-4 py-2 text-base gap-2'
    default:
      return 'px-3 py-1.5 text-sm gap-1.5'
  }
})

/**
 * Icon size classes.
 */
const iconSizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'w-3 h-3'
    case 'md':
      return 'w-4 h-4'
    case 'lg':
      return 'w-5 h-5'
    default:
      return 'w-4 h-4'
  }
})

/**
 * Whether to show the pending count badge.
 */
const showPendingBadge = computed(() => {
  return props.showCount && props.pendingCount > 0
})
</script>

<template>
  <div class="relative inline-flex items-center">
    <!-- Status Badge -->
    <div
      :class="[
        'inline-flex items-center rounded-full font-medium',
        'transition-all duration-200 ease-out',
        statusColorClasses,
        sizeClasses,
      ]"
      role="status"
      :aria-label="`Sync status: ${statusLabel}`"
    >
      <!-- Icon -->
      <svg
        :class="[iconSizeClasses, 'flex-shrink-0', { 'animate-spin': status === 'syncing' }]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <!-- Online (check-circle) -->
        <path
          v-if="statusIcon === 'check-circle'"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <!-- Offline (wifi-off) -->
        <path
          v-else-if="statusIcon === 'wifi-off'"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3l2.293 2.293m0 0a8.959 8.959 0 012.356-1.457"
        />
        <!-- Syncing (refresh-cw) -->
        <path
          v-else-if="statusIcon === 'refresh-cw'"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
        <!-- Error (alert-circle) -->
        <path
          v-else-if="statusIcon === 'alert-circle'"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <!-- Unknown (help-circle) -->
        <path
          v-else
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>

      <!-- Label (hidden on small screens for compact display) -->
      <span class="hidden tablet:inline">{{ statusLabel }}</span>
    </div>

    <!-- Pending Count Badge -->
    <div
      v-if="showPendingBadge"
      class="absolute -top-1 -right-1 flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 bg-amber-500 text-white text-xs font-bold rounded-full border-2 border-white dark:border-slate-900"
      role="status"
      :aria-label="`${pendingCount} items pending sync`"
    >
      {{ pendingCount > 99 ? '99+' : pendingCount }}
    </div>
  </div>
</template>
