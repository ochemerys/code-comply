<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { InspectionMonitorRow } from '../composables/useInspectionMonitor'

defineProps<{
  items: InspectionMonitorRow[]
  loading: boolean
}>()

function syncBadgeClasses(syncStatus: InspectionMonitorRow['syncStatus']) {
  switch (syncStatus) {
    case 'SYNCED':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    case 'SYNCING':
      return 'bg-amber-50 text-amber-700 ring-amber-200'
    case 'OFFLINE':
      return 'bg-bg-app text-text-secondary ring-border-subtle'
  }
}

function statusBadgeClasses(status: InspectionMonitorRow['status']) {
  switch (status) {
    case 'IN_PROGRESS':
      return 'bg-primary-50 text-primary-700 ring-primary-200'
    case 'REVIEW':
      return 'bg-purple-50 text-purple-700 ring-purple-200'
    case 'PENDING_SUBMISSION':
      return 'bg-amber-50 text-amber-700 ring-amber-200'
    case 'SUBMITTED':
      return 'bg-indigo-50 text-indigo-700 ring-indigo-200'
    case 'COMPLETED':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  }
}
</script>

<template>
  <section
    class="rounded-lg border border-border-subtle bg-bg-surface shadow-sm"
    data-testid="inspection-status"
  >
    <header
      class="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-4 py-3"
    >
      <h2 class="text-base sm:text-lg font-semibold text-text-primary">Inspection status</h2>
      <p class="text-xs sm:text-sm text-text-dim">Auto-refreshes every 30 seconds</p>
    </header>

    <div v-if="loading" class="px-4 py-6 text-sm text-text-dim">Loading…</div>

    <ul v-else-if="items.length" class="divide-y divide-border-subtle">
      <li
        v-for="row in items"
        :key="row.id"
        class="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        :data-testid="`inspection-status-row-${row.id}`"
      >
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-semibold text-text-primary">{{ row.permitId }}</span>
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
              :class="statusBadgeClasses(row.status)"
              :data-testid="`inspection-status-badge-${row.id}`"
            >
              {{ row.status }}
            </span>
            <span
              v-if="row.pendingSubmission"
              class="inline-flex items-center rounded-full bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200 px-2 py-0.5 text-xs font-medium"
              :data-testid="`inspection-pending-${row.id}`"
            >
              Pending submission
            </span>
            <span
              v-if="row.stopWorkAlert"
              class="inline-flex items-center rounded-full bg-red-50 text-red-800 ring-1 ring-inset ring-red-200 px-2 py-0.5 text-xs font-semibold"
              :data-testid="`inspection-stop-work-${row.id}`"
            >
              Stop Work
            </span>
          </div>
          <div class="text-xs sm:text-sm text-text-secondary mt-1 truncate">
            Inspector: <span class="font-medium text-text-primary">{{ row.inspectorName }}</span>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 sm:justify-end">
          <RouterLink
            :to="{ name: 'inspection-detail', params: { id: row.id } }"
            class="text-xs font-medium text-primary-700 hover:underline"
            :data-testid="`inspection-workflow-link-${row.id}`"
          >
            Workflow
          </RouterLink>
          <span
            class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
            :class="syncBadgeClasses(row.syncStatus)"
            :data-testid="`inspection-sync-${row.id}`"
          >
            {{ row.syncStatus }}
          </span>
          <span class="text-xs text-text-dim" :data-testid="`inspection-updated-${row.id}`">
            Updated {{ new Date(row.updatedAt).toLocaleTimeString() }}
          </span>
        </div>
      </li>
    </ul>

    <div v-else class="px-4 py-6 text-sm text-text-dim" data-testid="inspection-status-empty">
      No active inspections.
    </div>
  </section>
</template>
