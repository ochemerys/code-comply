<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  EMPTY_DEFICIENCY_FILTERS,
  deficiencyStatusLabel,
  isSessionExpiredRedirectError,
  useAdminDeficienciesList,
  useAdminInspectionsForDeficiencies,
  type AdminDeficiencyFilters,
} from '../composables/useAdminDeficiencies'

const route = useRoute()

const filters = ref<AdminDeficiencyFilters>({
  ...EMPTY_DEFICIENCY_FILTERS,
  inspectionId: typeof route.query.inspectionId === 'string' ? route.query.inspectionId : '',
})

watch(
  () => route.query.inspectionId,
  (id) => {
    if (typeof id === 'string') {
      filters.value = { ...filters.value, inspectionId: id }
    }
  },
)

const { data: inspections } = useAdminInspectionsForDeficiencies()
const { data, isPending, isFetching, error, refetch } = useAdminDeficienciesList(
  filters,
  inspections,
)

const loading = computed(() => isPending.value || (isFetching.value && !data.value))
const showError = computed(() => !!error.value && !isSessionExpiredRedirectError(error.value))
const rows = computed(() => data.value ?? [])

const inspectionLabel = computed(() => {
  const map = new Map((inspections.value ?? []).map((i) => [i.id, i]))
  return (inspectionId: string) => {
    const insp = map.get(inspectionId)
    if (!insp) return inspectionId
    return `${insp.permitNumber} · ${insp.address}`
  }
})

function formatDue(iso: string | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' })
}
</script>

<template>
  <div class="space-y-6" data-testid="deficiency-list-view">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-text-secondary">
        Manage inspection deficiencies, code references, and resolution status (LSC-A-04).
      </p>
      <RouterLink
        :to="{
          name: 'deficiency-create',
          query: filters.inspectionId ? { inspectionId: filters.inspectionId } : {},
        }"
        class="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        data-testid="deficiency-list-create"
      >
        Create deficiency
      </RouterLink>
    </header>

    <div
      class="grid gap-3 rounded-lg border border-border-subtle bg-bg-app p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <div>
        <label
          for="def-filter-inspection"
          class="mb-1 block text-sm font-medium text-text-secondary"
        >
          Inspection ID
        </label>
        <input
          id="def-filter-inspection"
          v-model="filters.inspectionId"
          type="search"
          class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm font-mono"
          data-testid="deficiency-filter-inspection"
        />
      </div>
      <div>
        <label for="def-filter-permit" class="mb-1 block text-sm font-medium text-text-secondary">
          Permit number
        </label>
        <input
          id="def-filter-permit"
          v-model="filters.permitNumber"
          type="search"
          class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
          data-testid="deficiency-filter-permit"
        />
      </div>
      <div>
        <label for="def-filter-status" class="mb-1 block text-sm font-medium text-text-secondary">
          Status
        </label>
        <select
          id="def-filter-status"
          v-model="filters.status"
          class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
          data-testid="deficiency-filter-status"
        >
          <option value="">All</option>
          <option value="OPEN">Open</option>
          <option value="VOC_SUBMITTED">VoC pending</option>
          <option value="VOC_REJECTED">VoC rejected</option>
          <option value="CLOSED">Resolved</option>
        </select>
      </div>
      <div>
        <label for="def-filter-severity" class="mb-1 block text-sm font-medium text-text-secondary">
          Severity
        </label>
        <select
          id="def-filter-severity"
          v-model="filters.severity"
          class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
          data-testid="deficiency-filter-severity"
        >
          <option value="">All</option>
          <option value="MINOR">Minor</option>
          <option value="MAJOR">Major</option>
          <option value="CRITICAL">Critical</option>
        </select>
      </div>
      <div>
        <label for="def-filter-due-from" class="mb-1 block text-sm font-medium text-text-secondary">
          Due from
        </label>
        <input
          id="def-filter-due-from"
          v-model="filters.dueDateFrom"
          type="date"
          class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
          data-testid="deficiency-filter-due-from"
        />
      </div>
      <div>
        <label for="def-filter-due-to" class="mb-1 block text-sm font-medium text-text-secondary">
          Due to
        </label>
        <input
          id="def-filter-due-to"
          v-model="filters.dueDateTo"
          type="date"
          class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
          data-testid="deficiency-filter-due-to"
        />
      </div>
    </div>

    <div class="flex gap-2">
      <button
        type="button"
        class="rounded-lg border border-border-strong bg-bg-surface px-3 py-2 text-sm font-medium text-text-primary"
        data-testid="deficiency-list-refresh"
        :disabled="isFetching"
        @click="refetch()"
      >
        Refresh
      </button>
    </div>

    <p v-if="showError" class="text-sm text-red-700" data-testid="deficiency-list-error">
      {{ error instanceof Error ? error.message : 'Failed to load deficiencies' }}
    </p>

    <div
      v-if="loading"
      class="rounded-lg border border-border-subtle bg-bg-surface px-4 py-8 text-center text-sm text-text-secondary"
      data-testid="deficiency-list-loading"
    >
      Loading deficiencies…
    </div>

    <div
      v-else-if="!rows.length"
      class="rounded-lg border border-border-subtle bg-bg-surface px-4 py-8 text-center text-sm text-text-secondary"
      data-testid="deficiency-list-empty"
    >
      No deficiencies match the current filters.
    </div>

    <template v-else>
      <div
        class="hidden overflow-hidden rounded-lg border border-border-subtle bg-bg-surface shadow md:block"
        data-testid="deficiency-list-desktop"
      >
        <table class="min-w-full text-sm" data-testid="deficiency-list-table">
          <thead class="border-b border-border-subtle bg-bg-app">
            <tr>
              <th class="px-4 py-3 text-left font-semibold text-text-secondary">Description</th>
              <th class="px-4 py-3 text-left font-semibold text-text-secondary">Inspection</th>
              <th class="px-4 py-3 text-left font-semibold text-text-secondary">Severity</th>
              <th class="px-4 py-3 text-left font-semibold text-text-secondary">Status</th>
              <th class="px-4 py-3 text-left font-semibold text-text-secondary">Due</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="row.id"
              class="border-b border-border-subtle last:border-0 hover:bg-bg-app"
              :data-testid="`deficiency-row-${row.id}`"
            >
              <td class="px-4 py-3">
                <RouterLink
                  :to="{ name: 'deficiency-detail', params: { id: row.id } }"
                  class="font-medium text-primary-700 hover:underline"
                >
                  {{ row.description }}
                </RouterLink>
              </td>
              <td class="px-4 py-3 text-text-secondary">
                <RouterLink
                  :to="{ name: 'inspection-record', params: { id: row.inspectionId } }"
                  class="text-primary-700 hover:underline"
                >
                  {{ inspectionLabel(row.inspectionId) }}
                </RouterLink>
              </td>
              <td class="px-4 py-3">{{ row.severity }}</td>
              <td class="px-4 py-3">{{ deficiencyStatusLabel(row.status) }}</td>
              <td class="px-4 py-3">{{ formatDue(row.dueDate) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <ul class="space-y-3 md:hidden" data-testid="deficiency-list-mobile" role="list">
        <li
          v-for="row in rows"
          :key="row.id"
          class="rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-sm"
          :data-testid="`deficiency-card-${row.id}`"
        >
          <div class="flex items-start justify-between gap-3">
            <RouterLink
              :to="{ name: 'deficiency-detail', params: { id: row.id } }"
              class="font-medium text-primary-700 hover:underline"
              :data-testid="`deficiency-card-detail-${row.id}`"
            >
              {{ row.description }}
            </RouterLink>
            <span class="shrink-0 text-xs font-medium text-text-secondary">
              {{ deficiencyStatusLabel(row.status) }}
            </span>
          </div>
          <RouterLink
            :to="{ name: 'inspection-record', params: { id: row.inspectionId } }"
            class="mt-1 block text-sm text-primary-700 hover:underline"
          >
            {{ inspectionLabel(row.inspectionId) }}
          </RouterLink>
          <dl class="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt class="text-text-dim">Severity</dt>
              <dd class="text-text-primary">{{ row.severity }}</dd>
            </div>
            <div>
              <dt class="text-text-dim">Due</dt>
              <dd class="text-text-primary">{{ formatDue(row.dueDate) }}</dd>
            </div>
          </dl>
        </li>
      </ul>
    </template>
  </div>
</template>
