<script setup lang="ts">
import { ref, onMounted, nextTick, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useOnline } from '@vueuse/core'
import FindNearbyPermits from '../components/FindNearbyPermits.vue'
import PermitListView from './PermitListView.vue'
import PermitFilters from '../components/PermitFilters.vue'
import PermitSearch from '../components/PermitSearch.vue'
import type { PermitListDTO } from '@codecomply/validators'
import { useAuthStore } from '@/stores/auth'
import { usePermitList } from '@/composables/usePermitList'
import { syncAssignedPermitsFromApi } from '@/lib/db/assigned-permits-sync'
import {
  hasCompletedFirstAssignedSync,
  deleteOrphanPermitFromCache,
} from '@/lib/permit-orphan-sync'

const router = useRouter()
const authStore = useAuthStore()
const online = useOnline()
const assignedLoadError = ref<string | null>(null)
const firstAssignedSyncDone = ref(false)

const searchQuery = ref('')
const { permits, isLoading, statusFilter, hasScheduledInspectionOnly, sortBy, refresh } =
  usePermitList({ searchQuery })

/** Remove orphan only when online and after a successful assigned sync has completed at least once */
const allowOrphanDelete = computed(() => online.value && firstAssignedSyncDone.value)

/** Client-side search / filter / sort only; collapsed by default to prioritize the list */
const filterPanelExpanded = ref(false)

const handleSelectPermit = (permit: PermitListDTO) => {
  router.push({ name: 'permit-detail', params: { id: permit.id } })
}

async function handleDeleteOrphanPermit(permit: PermitListDTO): Promise<void> {
  if (!navigator.onLine || !firstAssignedSyncDone.value) return
  await deleteOrphanPermitFromCache(permit.id)
  await refresh()
}

async function onPermitsAdded() {
  await nextTick()
  await refresh()
}

/** Populate local list from inspections assigned to this inspector (no GPS required). */
async function loadAssignedPermitsFromApi(): Promise<void> {
  assignedLoadError.value = null
  if (!authStore.accessToken) return

  try {
    await syncAssignedPermitsFromApi()
    firstAssignedSyncDone.value = true
    await nextTick()
    await refresh()
  } catch (e) {
    console.warn('[PermitsView] assigned permits:', e)
    assignedLoadError.value = 'Could not load assigned permits'
  }
}

onMounted(() => {
  firstAssignedSyncDone.value = hasCompletedFirstAssignedSync()
  void loadAssignedPermitsFromApi()
})
</script>

<template>
  <div class="bg-bg-app">
    <main class="px-4 pt-3 tablet:px-6 tablet:pt-5">
      <div class="max-w-4xl mx-auto">
        <header class="mb-4 tablet:mb-5">
          <h1 class="text-xl font-bold text-text-primary truncate tablet:text-2xl">Permits</h1>
          <p class="text-sm text-text-dim mt-0.5">
            Assigned permits sync to this device when you open the page.
            <span class="font-medium text-text-secondary">Find Near Me</span>
            fetches more permits from the server. Expand
            <span class="font-medium text-text-secondary"> Search, filter &amp; sort </span>
            to narrow the list already saved on your device (offline-friendly).
          </p>
          <p
            v-if="assignedLoadError"
            class="mt-2 text-sm text-amber-700 dark:text-amber-300"
            role="status"
          >
            {{ assignedLoadError }}
          </p>
        </header>

        <!-- Server: always visible -->
        <section
          class="mb-4 p-4 md:p-5 rounded-2xl bg-bg-surface border border-border-subtle shadow-sm"
          aria-label="Add permits from server"
        >
          <p class="text-xs text-text-dim mb-3">
            Add permits from the server by location (uses GPS).
          </p>
          <FindNearbyPermits @select-permit="handleSelectPermit" @permits-added="onPermitsAdded" />
        </section>

        <!-- Client: local cache only — collapsible -->
        <section
          class="mb-4 rounded-2xl border border-border-subtle bg-bg-surface shadow-sm overflow-hidden"
          aria-label="Search and filter your list"
        >
          <button
            id="permits-tools-toggle"
            type="button"
            class="w-full flex items-center justify-between gap-3 px-4 py-3 text-left min-h-touch rounded-none bg-bg-elevated/80 hover:bg-bg-surface/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            :aria-expanded="filterPanelExpanded"
            aria-controls="permits-tools-panel"
            data-testid="permits-tools-toggle"
            @click="filterPanelExpanded = !filterPanelExpanded"
          >
            <span class="font-medium text-text-primary pr-2"> Search, filter &amp; sort </span>
            <svg
              class="w-5 h-5 flex-shrink-0 text-text-dim transition-transform duration-200"
              :class="{ 'rotate-180': filterPanelExpanded }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          <div
            v-show="filterPanelExpanded"
            id="permits-tools-panel"
            class="px-4 pb-4 pt-1 border-t border-border-subtle"
          >
            <p class="text-xs text-text-dim pt-3 pb-3">
              Applies to permits already saved on this device — no server request.
            </p>
            <PermitFilters
              v-model:status-filter="statusFilter"
              v-model:has-scheduled-inspection-only="hasScheduledInspectionOnly"
              v-model:sort-by="sortBy"
              embedded
              :disabled="isLoading"
            >
              <PermitSearch v-model:search-query="searchQuery" />
            </PermitFilters>
          </div>
        </section>

        <section aria-label="Your permit list" class="pb-2">
          <PermitListView
            :permits="permits"
            :is-loading="isLoading"
            :search-query="searchQuery"
            :allow-orphan-delete="allowOrphanDelete"
            @select-permit="handleSelectPermit"
            @delete-orphan-permit="handleDeleteOrphanPermit"
            @refresh="refresh"
          />
        </section>
      </div>
    </main>
  </div>
</template>
