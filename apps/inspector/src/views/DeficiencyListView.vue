<script setup lang="ts">
/**
 * DeficiencyListView — inspection-scoped deficiency list with filters (M6-S8).
 * Matches `_docs/user-manuals/inspector-app-user-workflow.md` §3: optional `?checklistItemId=` filter;
 * **Add deficiency** preserves that query when creating another linked record.
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DeficiencyCard from '@/components/DeficiencyCard.vue'
import DeficiencyFilters from '@/components/DeficiencyFilters.vue'
import { useDeficiencies } from '@/composables/useDeficiencies'
import { useInspectionReadOnly } from '@/composables/useInspectionReadOnly'
import type { DeficiencySeverity, DeficiencyStatus } from '@/lib/db/types'

const route = useRoute()
const router = useRouter()

const inspectionId = computed(() => {
  const id = String(route.params.inspectionId ?? '').trim()
  return id || undefined
})

/** M6-S14: deep-link from checklist row — filter list to deficiencies linked to this item. */
const checklistItemFilterId = computed(() => {
  const q = route.query.checklistItemId
  const raw = Array.isArray(q) ? q[0] : q
  const id = typeof raw === 'string' ? raw.trim() : ''
  return id || undefined
})

const { deficiencies, isLoading, error, refresh } = useDeficiencies({
  inspectionId,
})

const { isReadOnlyAfterSync } = useInspectionReadOnly({ inspectionId })

const statusFilter = ref<DeficiencyStatus | 'all'>('all')
const severityFilter = ref<DeficiencySeverity | 'all'>('all')

const filteredDeficiencies = computed(() => {
  let list = deficiencies.value
  const chkId = checklistItemFilterId.value
  if (chkId) {
    list = list.filter((d) => d.checklistItemId === chkId)
  }
  if (statusFilter.value !== 'all') {
    list = list.filter((d) => d.status === statusFilter.value)
  }
  if (severityFilter.value !== 'all') {
    list = list.filter((d) => d.severity === severityFilter.value)
  }
  return list
})

const showEmpty = computed(
  () => !isLoading.value && !error.value && filteredDeficiencies.value.length === 0,
)

function goBack() {
  if (window.history.length > 1) router.back()
  else void router.push({ name: 'home' })
}

function goToNew() {
  if (isReadOnlyAfterSync.value) return
  const id = inspectionId.value
  if (!id) return
  const q = checklistItemFilterId.value
  void router.push({
    name: 'create-deficiency',
    params: { inspectionId: id },
    ...(q ? { query: { checklistItemId: q } } : {}),
  })
}

function clearChecklistItemFilter() {
  const id = inspectionId.value
  if (!id) return
  void router.replace({ name: 'deficiency-list', params: { inspectionId: id } })
}
</script>

<template>
  <div class="h-full min-h-0 flex flex-col bg-bg-app" data-testid="deficiency-list-view">
    <main class="flex-1 overflow-y-auto px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div class="mx-auto max-w-2xl">
        <div class="mb-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="h-11 min-w-[44px] rounded-lg border border-border-subtle bg-bg-elevated px-3 text-sm font-medium text-text-primary hover:bg-bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Go back"
            data-testid="deficiency-list-back"
            @click="goBack"
          >
            Back
          </button>
          <h1 class="text-xl font-semibold text-text-primary">Deficiencies</h1>
          <button
            v-if="inspectionId"
            type="button"
            class="ml-auto h-11 min-w-[44px] rounded-lg bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-bg-app"
            data-testid="deficiency-list-add"
            :disabled="isReadOnlyAfterSync"
            :class="isReadOnlyAfterSync ? 'cursor-not-allowed opacity-50' : ''"
            @click="goToNew"
          >
            Add deficiency
          </button>
        </div>

        <p v-if="!inspectionId" class="text-sm text-red-600 dark:text-red-400" role="alert">
          Missing inspection. Open this list from a valid inspection link.
        </p>

        <template v-else>
          <div
            v-if="isReadOnlyAfterSync"
            class="mb-4 rounded-xl border border-border-subtle bg-bg-elevated px-4 py-3 text-sm text-text-primary"
            data-testid="inspection-read-only-banner"
            role="status"
          >
            This inspection has been finalized and synced. It’s now read-only.
          </div>

          <div
            v-if="checklistItemFilterId"
            class="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
            data-testid="deficiency-list-checklist-filter-banner"
            role="status"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span>Showing deficiencies linked to this checklist item.</span>
              <button
                type="button"
                class="h-9 shrink-0 rounded-lg border border-amber-700/30 px-3 text-sm font-medium text-amber-950 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-50 dark:hover:bg-amber-900/40"
                data-testid="deficiency-list-clear-checklist-filter"
                @click="clearChecklistItemFilter"
              >
                Show all
              </button>
            </div>
          </div>

          <DeficiencyFilters
            v-model:status-filter="statusFilter"
            v-model:severity-filter="severityFilter"
            class="mb-6"
          />

          <div
            v-if="isLoading"
            class="rounded-2xl border border-border-subtle bg-bg-elevated px-4 py-8 text-center text-sm text-text-secondary"
            data-testid="deficiency-list-loading"
          >
            Loading deficiencies…
          </div>

          <p
            v-else-if="error"
            class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
            data-testid="deficiency-list-error"
            role="alert"
          >
            {{ error.message }}
            <button
              type="button"
              class="ml-2 font-medium text-red-900 underline dark:text-red-100"
              data-testid="deficiency-list-retry"
              @click="refresh()"
            >
              Retry
            </button>
          </p>

          <div
            v-else-if="showEmpty"
            class="rounded-2xl border border-dashed border-border-subtle bg-bg-elevated px-6 py-12 text-center"
            data-testid="deficiency-list-empty"
          >
            <p class="text-base font-medium text-text-primary">No deficiencies yet</p>
            <p class="mt-2 text-sm text-text-secondary">
              Add a deficiency to record issues for this inspection. Your entries sync when you are
              back online.
            </p>
            <button
              type="button"
              class="mt-6 h-11 rounded-lg bg-primary-600 px-5 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary"
              data-testid="deficiency-list-empty-add"
              :disabled="isReadOnlyAfterSync"
              :class="isReadOnlyAfterSync ? 'cursor-not-allowed opacity-50' : ''"
              @click="goToNew"
            >
              Add deficiency
            </button>
          </div>

          <ul
            v-else
            class="flex flex-col gap-4"
            data-testid="deficiency-list"
            aria-label="Deficiencies for this inspection"
          >
            <li v-for="d in filteredDeficiencies" :key="d.id">
              <DeficiencyCard :deficiency="d" />
            </li>
          </ul>
        </template>
      </div>
    </main>
  </div>
</template>
