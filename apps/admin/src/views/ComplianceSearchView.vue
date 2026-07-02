<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AdvancedSearch from '../components/AdvancedSearch.vue'
import CertificationSnapshotPanel from '../components/CertificationSnapshotPanel.vue'
import {
  EMPTY_COMPLIANCE_SEARCH_CRITERIA,
  exportComplianceResultsCsv,
  isSessionExpiredRedirectError,
  useAdminInspectorsForSearch,
  useComplianceSearch,
  type ComplianceSearchCriteria,
} from '../composables/useAdminComplianceSearch'
import { useInspectionCertificationSnapshot } from '../composables/useInspectionCertificationSnapshot'

const route = useRoute()
const criteria = ref<ComplianceSearchCriteria>({ ...EMPTY_COMPLIANCE_SEARCH_CRITERIA })
const submittedCriteria = ref<ComplianceSearchCriteria | null>(null)

onMounted(() => {
  const permitNumber =
    typeof route?.query?.permitNumber === 'string' ? route.query.permitNumber : ''
  if (permitNumber) {
    criteria.value = { ...criteria.value, permitNumber }
    submittedCriteria.value = { ...criteria.value }
  }
})

const { data: inspectors, isPending: inspectorsPending } = useAdminInspectorsForSearch()

const activeCriteria = computed(() => submittedCriteria.value ?? EMPTY_COMPLIANCE_SEARCH_CRITERIA)
const searchActive = computed(() => submittedCriteria.value !== null)

const { data, isPending, isFetching, error, refetch } = useComplianceSearch(
  activeCriteria,
  searchActive,
)

const searchLoading = computed(() => {
  if (!searchActive.value) return false
  return isPending.value || isFetching.value
})
const showFetchError = computed(() => !!error.value && !isSessionExpiredRedirectError(error.value))
const results = computed(() => data.value?.results ?? [])
const total = computed(() => data.value?.total ?? 0)
const searchAuditId = computed(() => data.value?.searchAuditId)

function onSearch() {
  submittedCriteria.value = { ...criteria.value }
}

function onReset() {
  criteria.value = { ...EMPTY_COMPLIANCE_SEARCH_CRITERIA }
  submittedCriteria.value = null
}

function formatDate(iso: string | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

function onExport() {
  if (results.value.length === 0) return
  exportComplianceResultsCsv(results.value)
}

const snapshotInspectionId = ref<string | null>(null)
const snapshotPanelOpen = computed(() => snapshotInspectionId.value !== null)

const {
  data: snapshotData,
  isPending: snapshotLoading,
  error: snapshotError,
} = useInspectionCertificationSnapshot(snapshotInspectionId, snapshotPanelOpen)

function openSnapshot(inspectionId: string) {
  snapshotInspectionId.value = inspectionId
}

function closeSnapshot() {
  snapshotInspectionId.value = null
}
</script>

<template>
  <div data-testid="compliance-search-view" class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <p class="text-text-secondary">
        FOIP-compliant advanced search for inspection records and compliance requests
      </p>
      <button
        v-if="searchActive"
        type="button"
        class="inline-flex items-center justify-center rounded-lg border border-border-strong bg-bg-surface px-4 py-2 text-sm font-semibold text-text-secondary shadow-sm hover:bg-bg-app disabled:opacity-50"
        data-testid="compliance-search-refresh"
        :disabled="isFetching"
        @click="() => refetch()"
      >
        Refresh
      </button>
    </div>

    <AdvancedSearch
      v-model:criteria="criteria"
      :inspectors="inspectors ?? []"
      :inspectors-loading="inspectorsPending"
      :searching="searchLoading"
      @search="onSearch"
      @reset="onReset"
    />

    <div
      v-if="showFetchError"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      role="alert"
      data-testid="compliance-search-error"
    >
      {{ error?.message ?? 'Search failed.' }}
    </div>

    <section
      class="rounded-lg border border-border-subtle bg-bg-surface p-5 shadow-sm"
      data-testid="compliance-search-results"
    >
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 class="text-lg font-semibold text-text-primary">Results</h3>
          <p v-if="searchActive && !searchLoading" class="mt-1 text-sm text-text-secondary">
            {{ total }} record{{ total === 1 ? '' : 's' }} found
            <span v-if="searchAuditId" class="text-text-dim">
              · Search logged (audit {{ searchAuditId.slice(0, 8) }}…)
            </span>
          </p>
        </div>
        <button
          v-if="results.length > 0"
          type="button"
          class="inline-flex min-h-10 items-center justify-center rounded-lg border border-border-strong bg-bg-surface px-4 py-2 text-sm font-semibold text-text-secondary shadow-sm hover:bg-bg-app"
          data-testid="compliance-search-export"
          @click="onExport"
        >
          Export CSV
        </button>
      </div>

      <div
        v-if="!searchActive"
        class="mt-4 rounded-lg border border-dashed border-border-strong bg-bg-app p-8 text-center text-sm text-text-secondary"
        data-testid="compliance-search-prompt"
      >
        Enter search criteria above and click Search to find compliance records.
      </div>

      <div
        v-else-if="searchLoading"
        class="mt-4 text-sm text-text-secondary"
        data-testid="compliance-search-loading"
      >
        Searching records…
      </div>

      <div
        v-else-if="results.length === 0"
        class="mt-4 rounded-lg border border-dashed border-border-strong bg-bg-app p-8 text-center text-sm text-text-secondary"
        data-testid="compliance-search-empty"
      >
        No records match your search criteria.
      </div>

      <template v-else>
        <div class="mt-4 hidden overflow-x-auto md:block" data-testid="compliance-search-desktop">
          <table
            class="min-w-full divide-y divide-border-subtle text-sm"
            data-testid="compliance-search-table"
          >
            <thead class="bg-bg-app">
              <tr>
                <th class="px-3 py-2 text-left font-medium text-text-secondary">Record</th>
                <th class="px-3 py-2 text-left font-medium text-text-secondary">Permit</th>
                <th class="px-3 py-2 text-left font-medium text-text-secondary">Legal land</th>
                <th class="px-3 py-2 text-left font-medium text-text-secondary">Address</th>
                <th class="px-3 py-2 text-left font-medium text-text-secondary">Status</th>
                <th class="px-3 py-2 text-left font-medium text-text-secondary">Scheduled</th>
                <th class="px-3 py-2 text-left font-medium text-text-secondary">Inspector</th>
                <th class="px-3 py-2 text-right font-medium text-text-secondary">Deficiencies</th>
                <th class="px-3 py-2 text-right font-medium text-text-secondary">Cert snapshot</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border-subtle">
              <tr
                v-for="row in results"
                :key="row.inspectionId"
                :data-testid="`compliance-search-row-${row.inspectionId}`"
              >
                <td class="px-3 py-2 space-x-2">
                  <RouterLink
                    :to="{ name: 'inspection-detail', params: { id: row.inspectionId } }"
                    class="text-sm font-medium text-primary-600 hover:text-primary-800"
                    :data-testid="`compliance-search-workflow-${row.inspectionId}`"
                  >
                    Workflow
                  </RouterLink>
                  <RouterLink
                    :to="{ name: 'inspection-record', params: { id: row.inspectionId } }"
                    class="text-sm font-medium text-primary-600 hover:text-primary-800"
                    :data-testid="`compliance-search-record-${row.inspectionId}`"
                  >
                    Record
                  </RouterLink>
                </td>
                <td class="px-3 py-2 font-mono text-xs text-text-primary">
                  {{ row.permitNumber }}
                </td>
                <td class="px-3 py-2 text-text-secondary">{{ row.legalLandDescription ?? '—' }}</td>
                <td class="px-3 py-2 text-text-secondary">{{ row.address }}</td>
                <td class="px-3 py-2 text-text-secondary">{{ row.status }}</td>
                <td class="px-3 py-2 text-text-secondary">{{ formatDate(row.scheduledDate) }}</td>
                <td class="px-3 py-2 text-text-secondary">{{ row.inspectorName ?? '—' }}</td>
                <td class="px-3 py-2 text-right text-text-secondary">
                  <RouterLink
                    v-if="row.deficiencyCount > 0"
                    :to="{
                      name: 'deficiencies',
                      query: { inspectionId: row.inspectionId },
                    }"
                    class="font-medium text-primary-600 hover:text-primary-800"
                    :data-testid="`compliance-search-deficiencies-${row.inspectionId}`"
                  >
                    {{ row.deficiencyCount }}
                  </RouterLink>
                  <span v-else>0</span>
                </td>
                <td class="px-3 py-2 text-right">
                  <button
                    v-if="row.hasCertificationSnapshot"
                    type="button"
                    class="text-sm font-medium text-primary-600 hover:text-primary-800"
                    :data-testid="`compliance-search-snapshot-${row.inspectionId}`"
                    @click="openSnapshot(row.inspectionId)"
                  >
                    View
                  </button>
                  <span v-else class="text-text-dim">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <ul class="mt-4 space-y-3 md:hidden" data-testid="compliance-search-mobile" role="list">
          <li
            v-for="row in results"
            :key="row.inspectionId"
            class="rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-sm"
            :data-testid="`compliance-search-card-${row.inspectionId}`"
          >
            <div class="flex items-start justify-between gap-3">
              <span class="font-mono text-sm font-semibold text-text-primary">
                {{ row.permitNumber }}
              </span>
              <span class="shrink-0 text-xs font-medium text-text-secondary">{{ row.status }}</span>
            </div>
            <p class="mt-1 text-sm text-text-secondary">{{ row.address }}</p>
            <dl class="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt class="text-text-dim">Scheduled</dt>
                <dd class="text-text-primary">{{ formatDate(row.scheduledDate) }}</dd>
              </div>
              <div>
                <dt class="text-text-dim">Inspector</dt>
                <dd class="text-text-primary">{{ row.inspectorName ?? '—' }}</dd>
              </div>
            </dl>
            <div class="mt-3 flex flex-wrap items-center gap-3">
              <RouterLink
                :to="{ name: 'inspection-detail', params: { id: row.inspectionId } }"
                class="text-sm font-medium text-primary-600 hover:text-primary-800"
                :data-testid="`compliance-search-card-workflow-${row.inspectionId}`"
              >
                Workflow
              </RouterLink>
              <RouterLink
                :to="{ name: 'inspection-record', params: { id: row.inspectionId } }"
                class="text-sm font-medium text-primary-600 hover:text-primary-800"
                :data-testid="`compliance-search-card-record-${row.inspectionId}`"
              >
                Record
              </RouterLink>
              <RouterLink
                v-if="row.deficiencyCount > 0"
                :to="{ name: 'deficiencies', query: { inspectionId: row.inspectionId } }"
                class="text-sm font-medium text-primary-600 hover:text-primary-800"
                :data-testid="`compliance-search-card-deficiencies-${row.inspectionId}`"
              >
                {{ row.deficiencyCount }} deficiencies
              </RouterLink>
              <button
                v-if="row.hasCertificationSnapshot"
                type="button"
                class="text-sm font-medium text-primary-600 hover:text-primary-800"
                :data-testid="`compliance-search-card-snapshot-${row.inspectionId}`"
                @click="openSnapshot(row.inspectionId)"
              >
                Cert snapshot
              </button>
            </div>
          </li>
        </ul>
      </template>
    </section>

    <div
      v-if="snapshotPanelOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-testid="compliance-search-snapshot-dialog"
      @click.self="closeSnapshot"
    >
      <div
        class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border-subtle bg-bg-surface p-6 shadow-xl"
        role="dialog"
        aria-labelledby="cert-snapshot-title"
      >
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 id="cert-snapshot-title" class="text-lg font-semibold text-text-primary">
              Certification snapshot
            </h3>
            <p class="text-sm text-text-secondary font-mono">{{ snapshotInspectionId }}</p>
          </div>
          <button
            type="button"
            class="text-sm font-medium text-text-secondary hover:text-text-primary"
            data-testid="compliance-search-snapshot-close"
            @click="closeSnapshot"
          >
            Close
          </button>
        </div>
        <CertificationSnapshotPanel
          :data="snapshotData"
          :loading="snapshotLoading"
          :error="snapshotError instanceof Error ? snapshotError : null"
        />
      </div>
    </div>
  </div>
</template>
