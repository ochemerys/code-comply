<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import {
  isSessionExpiredRedirectError,
  useAdminPermitsList,
  usePermitSyncMutation,
  usePermitSyncStatus,
  type AdminPermitFilters,
} from '../composables/useAdminPermits'
import { usePermitSyncAuditLogs } from '../composables/useAdminAuditLogs'

const filters = ref<AdminPermitFilters>({
  permitNumber: '',
  address: '',
  status: '',
})

const permitNumberInput = ref('')
const addressInput = ref('')

let debounce: ReturnType<typeof setTimeout> | undefined
watch([permitNumberInput, addressInput], () => {
  clearTimeout(debounce)
  debounce = setTimeout(() => {
    filters.value = {
      ...filters.value,
      permitNumber: permitNumberInput.value,
      address: addressInput.value,
    }
  }, 300)
})

const { data, isPending, isFetching, error, refetch } = useAdminPermitsList(filters)
const { data: syncStatus } = usePermitSyncStatus()
const syncMutation = usePermitSyncMutation()
const { data: permitSyncAuditLogs, refetch: refetchAuditLogs } = usePermitSyncAuditLogs(5)

const loading = computed(() => isPending.value || isFetching.value)
const showError = computed(() => !!error.value && !isSessionExpiredRedirectError(error.value))

const displaySyncStatus = computed(() => {
  if (syncMutation.isPending.value) return 'syncing'
  return syncStatus.value?.status ?? 'idle'
})

const isSyncRunning = computed(() => displaySyncStatus.value === 'syncing')

const lastSyncedLabel = computed(() => {
  const at = syncStatus.value?.lastSyncedAt
  if (!at) return 'Never synced'
  return new Date(at).toLocaleString()
})

const syncSummary = ref<string | null>(null)

async function onSync() {
  syncSummary.value = null
  try {
    const result = await syncMutation.mutateAsync()
    syncSummary.value = `New: ${result.newPermits}, updated: ${result.updatedPermits}, unchanged: ${result.unchanged}`
    void refetch()
    void refetchAuditLogs()
  } catch (e) {
    syncSummary.value = e instanceof Error ? e.message : 'Sync failed'
  }
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ')
}
</script>

<template>
  <div class="space-y-4 min-w-0 max-w-full" data-testid="permits-view">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <p class="text-text-secondary">
        Search active permits and sync from the municipal system (A-02).
      </p>
      <button
        type="button"
        class="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 min-h-[44px]"
        data-testid="permits-sync-button"
        :disabled="syncMutation.isPending.value"
        @click="onSync"
      >
        {{ syncMutation.isPending.value ? 'Syncing…' : 'Sync Permits' }}
      </button>
    </div>

    <div
      class="rounded-lg border border-border-subtle bg-bg-app px-4 py-3 text-sm text-text-primary flex flex-wrap items-center gap-x-6 gap-y-1"
      data-testid="permits-sync-status"
    >
      <span class="inline-flex items-center gap-2">
        Municipal sync:
        <strong class="text-text-primary">{{ displaySyncStatus }}</strong>
        <span
          v-if="isSyncRunning"
          class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-600 border-t-transparent"
          data-testid="permits-sync-running-indicator"
          aria-hidden="true"
        />
        <span v-if="isSyncRunning" class="sr-only">Sync in progress</span>
      </span>
      <span>
        Last sync:
        <strong class="text-text-primary">{{ lastSyncedLabel }}</strong>
      </span>
      <span v-if="syncSummary" data-testid="permits-sync-summary">{{ syncSummary }}</span>
    </div>

    <section
      v-if="(permitSyncAuditLogs?.entries ?? []).length > 0"
      class="rounded-lg border border-border-subtle bg-bg-surface px-4 py-3 text-sm"
      data-testid="permits-sync-audit-log"
      aria-label="Municipal sync audit log"
    >
      <h3 class="font-medium text-text-primary mb-2">Recent PERMIT_SYNC audit entries</h3>
      <ul class="space-y-2" role="list">
        <li
          v-for="entry in permitSyncAuditLogs?.entries ?? []"
          :key="entry.id"
          class="text-text-secondary"
          :data-testid="`permits-sync-audit-entry-${entry.id}`"
        >
          <time :datetime="entry.timestamp">{{ new Date(entry.timestamp).toLocaleString() }}</time>
          — New:
          <strong class="text-text-primary">{{ entry.metadata?.newPermits ?? '—' }}</strong
          >, Updated:
          <strong class="text-text-primary">{{ entry.metadata?.updatedPermits ?? '—' }}</strong
          >, Unchanged:
          <strong class="text-text-primary">{{ entry.metadata?.unchanged ?? '—' }}</strong>
        </li>
      </ul>
    </section>

    <div class="grid gap-3 sm:grid-cols-3">
      <div>
        <label
          for="permits-filter-number"
          class="block text-sm font-medium text-text-secondary mb-1"
        >
          Permit number
        </label>
        <input
          id="permits-filter-number"
          v-model="permitNumberInput"
          type="search"
          class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
          data-testid="permits-filter-number"
        />
      </div>
      <div>
        <label
          for="permits-filter-address"
          class="block text-sm font-medium text-text-secondary mb-1"
        >
          Address
        </label>
        <input
          id="permits-filter-address"
          v-model="addressInput"
          type="search"
          class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
          data-testid="permits-filter-address"
        />
      </div>
      <div>
        <label
          for="permits-filter-status"
          class="block text-sm font-medium text-text-secondary mb-1"
        >
          Status
        </label>
        <select
          id="permits-filter-status"
          v-model="filters.status"
          class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm bg-bg-surface"
          data-testid="permits-filter-status"
        >
          <option value="">All</option>
          <option value="ACTIVE">Active</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>
    </div>

    <div
      v-if="showError"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
      data-testid="permits-error"
    >
      {{ error instanceof Error ? error.message : 'Failed to load permits' }}
    </div>

    <div v-if="loading" class="text-sm text-text-secondary" data-testid="permits-loading">
      Loading permits…
    </div>

    <div
      v-else
      class="hidden rounded-lg border border-border-subtle overflow-hidden bg-bg-surface shadow md:block"
      data-testid="permits-desktop"
    >
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm" data-testid="permits-table">
          <thead class="bg-bg-app border-b border-border-subtle">
            <tr class="text-left text-text-secondary">
              <th class="px-4 py-3 font-medium">Permit</th>
              <th class="px-4 py-3 font-medium">Address</th>
              <th class="px-4 py-3 font-medium">Legal land description</th>
              <th class="px-4 py-3 font-medium">Status</th>
              <th class="px-4 py-3 font-medium text-right">Inspections</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in data ?? []"
              :key="row.id"
              class="border-b border-border-subtle last:border-0"
              :data-testid="`permits-row-${row.permitNumber}`"
            >
              <td class="px-4 py-3 font-medium text-text-primary">
                <RouterLink
                  :to="{ name: 'permit-detail', params: { id: row.id } }"
                  class="text-primary-700 hover:text-primary-900 hover:underline"
                  :data-testid="`permits-open-${row.permitNumber}`"
                >
                  {{ row.permitNumber }}
                </RouterLink>
                <div
                  v-if="row.triage && !row.triage.assignmentEligible"
                  class="mt-1 flex flex-wrap gap-1"
                >
                  <span
                    v-if="row.triage.missingLld"
                    class="inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200"
                    :data-testid="`permits-flag-missing-lld-${row.permitNumber}`"
                  >
                    Missing LLD
                  </span>
                  <span
                    v-if="row.triage.stopWorkLockedOut"
                    class="inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold bg-red-50 text-red-900 border border-red-200"
                    :data-testid="`permits-flag-stop-work-${row.permitNumber}`"
                  >
                    Stop Work
                  </span>
                  <span
                    v-if="row.status === 'CANCELLED' || row.status === 'EXPIRED'"
                    class="inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold bg-bg-app text-text-secondary border border-border-subtle"
                  >
                    Not assignable
                  </span>
                </div>
              </td>
              <td class="px-4 py-3 text-text-secondary">
                {{ row.address }}
              </td>
              <td
                class="px-4 py-3 text-text-secondary"
                :data-testid="`permits-lld-${row.permitNumber}`"
              >
                {{ row.legalLandDesc || '—' }}
              </td>
              <td class="px-4 py-3 text-text-secondary capitalize">
                {{ formatStatus(row.status) }}
              </td>
              <td class="px-4 py-3 text-right">
                <RouterLink
                  :to="{
                    name: 'compliance-search',
                    query: { permitNumber: row.permitNumber },
                  }"
                  class="text-sm font-medium text-primary-600 hover:text-primary-800"
                  :data-testid="`permits-search-${row.permitNumber}`"
                >
                  Search
                </RouterLink>
              </td>
            </tr>
            <tr v-if="(data ?? []).length === 0">
              <td colspan="5" class="px-4 py-8 text-center text-text-dim">
                No permits match your filters.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <ul v-if="!loading" class="space-y-3 md:hidden" data-testid="permits-mobile" role="list">
      <li
        v-for="row in data ?? []"
        :key="row.id"
        class="rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-sm"
        :data-testid="`permits-card-${row.permitNumber}`"
      >
        <div class="flex items-start justify-between gap-3">
          <RouterLink
            :to="{ name: 'permit-detail', params: { id: row.id } }"
            class="font-medium text-primary-700 hover:text-primary-900 hover:underline"
            :data-testid="`permits-card-open-${row.permitNumber}`"
          >
            {{ row.permitNumber }}
          </RouterLink>
          <span class="shrink-0 text-xs font-medium text-text-secondary capitalize">
            {{ formatStatus(row.status) }}
          </span>
        </div>
        <p class="mt-1 text-sm text-text-secondary">{{ row.address }}</p>
        <div v-if="row.triage && !row.triage.assignmentEligible" class="mt-2 flex flex-wrap gap-1">
          <span
            v-if="row.triage.missingLld"
            class="inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200"
          >
            Missing LLD
          </span>
          <span
            v-if="row.triage.stopWorkLockedOut"
            class="inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold bg-red-50 text-red-900 border border-red-200"
          >
            Stop Work
          </span>
        </div>
        <p
          v-if="row.legalLandDesc"
          class="mt-1 text-sm text-text-secondary"
          :data-testid="`permits-card-lld-${row.permitNumber}`"
        >
          {{ row.legalLandDesc }}
        </p>
        <div class="mt-3 flex justify-end">
          <RouterLink
            :to="{ name: 'compliance-search', query: { permitNumber: row.permitNumber } }"
            class="text-sm font-medium text-primary-600 hover:text-primary-800"
            :data-testid="`permits-card-search-${row.permitNumber}`"
          >
            Search inspections
          </RouterLink>
        </div>
      </li>
      <li
        v-if="(data ?? []).length === 0"
        class="rounded-lg border border-border-subtle bg-bg-surface px-4 py-8 text-center text-text-dim"
        data-testid="permits-mobile-empty"
      >
        No permits match your filters.
      </li>
    </ul>
  </div>
</template>
