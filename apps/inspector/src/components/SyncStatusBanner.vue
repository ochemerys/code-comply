<script setup lang="ts">
import { computed } from 'vue'
import { useSyncStatus, type SyncStatusState } from '@/composables/useSyncStatus'
import SyncStatusBadge from './SyncStatusBadge.vue'

interface Props {
  statusOverride?: SyncStatusState
  pendingCountOverride?: number
  failedCountOverride?: number
  lastErrorOverride?: string | null
  syncingOverride?: boolean
  showWhenOnline?: boolean
  fixed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  statusOverride: undefined,
  pendingCountOverride: undefined,
  failedCountOverride: undefined,
  lastErrorOverride: undefined,
  syncingOverride: undefined,
  showWhenOnline: false,
  fixed: true,
})

const {
  status,
  isOnline,
  isSyncing,
  pendingCount,
  failedCount,
  lastError,
  triggerSync,
  retryFailed,
} = useSyncStatus()

const currentStatus = computed(() => props.statusOverride ?? status.value)
const currentPendingCount = computed(() => props.pendingCountOverride ?? pendingCount.value)
const currentFailedCount = computed(() => props.failedCountOverride ?? failedCount.value)
const currentLastError = computed(() => props.lastErrorOverride ?? lastError.value)
const currentlySyncing = computed(() => props.syncingOverride ?? isSyncing.value)

const hasProblem = computed(
  () =>
    currentStatus.value === 'error' ||
    currentFailedCount.value > 0 ||
    Boolean(currentLastError.value),
)

/**
 * AppHeader toolbar shows the compact sync badge + menu on all breakpoints.
 * This banner is only for offline, active sync, or errors — not pending-only state.
 */
const shouldRender = computed(() => {
  if (props.showWhenOnline) return true
  if (hasProblem.value) return true
  if (currentStatus.value === 'offline') return true
  if (currentStatus.value === 'syncing' || currentlySyncing.value) return true
  return false
})

const headline = computed(() => {
  if (hasProblem.value) return 'Sync needs attention'
  if (currentStatus.value === 'offline') return 'You are offline'
  if (currentStatus.value === 'syncing' || currentlySyncing.value) return 'Syncing changes'
  if (currentPendingCount.value > 0) return 'Changes pending sync'
  return 'All changes synced'
})

const detail = computed(() => {
  if (currentLastError.value) return currentLastError.value
  if (currentFailedCount.value > 0) {
    return `${currentFailedCount.value} item${currentFailedCount.value === 1 ? '' : 's'} could not sync.`
  }
  if (currentStatus.value === 'offline') {
    return currentPendingCount.value > 0
      ? `${currentPendingCount.value} item${currentPendingCount.value === 1 ? '' : 's'} will sync when you're back online.`
      : 'Changes are saved locally and will sync when you reconnect.'
  }
  if (currentStatus.value === 'syncing' || currentlySyncing.value) {
    return 'Uploading local changes and refreshing cached data.'
  }
  if (currentPendingCount.value > 0) {
    return `${currentPendingCount.value} item${currentPendingCount.value === 1 ? '' : 's'} queued for sync.`
  }
  return 'Your local data is up to date.'
})

const bannerClasses = computed(() => {
  if (hasProblem.value) {
    return 'border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950 dark:text-red-100'
  }
  if (currentStatus.value === 'syncing' || currentlySyncing.value) {
    return 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100'
  }
  return 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100'
})

const statusForBadge = computed<SyncStatusState>(() => {
  if (hasProblem.value) return 'error'
  if (currentStatus.value === 'syncing' || currentlySyncing.value) return 'syncing'
  return currentStatus.value
})

const showRetry = computed(() => currentFailedCount.value > 0)
const showSyncNow = computed(
  () =>
    !showRetry.value && currentPendingCount.value > 0 && isOnline.value && !currentlySyncing.value,
)
</script>

<template>
  <div
    v-if="shouldRender"
    data-testid="sync-status-banner"
    :class="[
      fixed ? 'fixed left-0 right-0 top-16 z-toast px-3 tablet-l:left-64' : 'w-full',
      'pointer-events-none',
    ]"
  >
    <section
      :class="[
        'pointer-events-auto mx-auto max-w-2xl rounded-2xl border px-4 py-3 shadow-lg',
        'flex items-start gap-3',
        bannerClasses,
      ]"
      role="status"
      aria-live="polite"
    >
      <SyncStatusBadge
        class="mt-0.5 shrink-0"
        :status="statusForBadge"
        :pending-count="currentPendingCount"
        :show-count="false"
        size="sm"
      />
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold">{{ headline }}</p>
        <p class="mt-0.5 text-sm opacity-90">{{ detail }}</p>
      </div>
      <button
        v-if="showRetry"
        type="button"
        class="h-9 shrink-0 rounded-lg border border-current/30 px-3 text-sm font-medium hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-current/40"
        @click="retryFailed"
      >
        Retry
      </button>
      <button
        v-else-if="showSyncNow"
        type="button"
        class="h-9 shrink-0 rounded-lg border border-current/30 px-3 text-sm font-medium hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-current/40"
        @click="triggerSync"
      >
        Sync now
      </button>
    </section>
  </div>
</template>
