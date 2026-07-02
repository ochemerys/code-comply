<script setup lang="ts">
import PermitCard from '@/components/PermitCard.vue'
import type { PermitListDTO } from '@codecomply/validators'

/**
 * Permit list: loading, empty, and card grid (M4-S10).
 * Search, filter, sort, and Find Near Me live in PermitsView.
 */
defineProps<{
  permits: PermitListDTO[]
  isLoading: boolean
  searchQuery: string
  /** Online + completed first assigned sync — enables Remove from device on orphan tiles */
  allowOrphanDelete?: boolean
}>()

const emit = defineEmits<{
  (e: 'select-permit', permit: PermitListDTO): void
  (e: 'delete-orphan-permit', permit: PermitListDTO): void
  (e: 'refresh'): void
}>()

function handleSelectPermit(permit: PermitListDTO): void {
  emit('select-permit', permit)
}

function handleDeleteOrphan(permit: PermitListDTO): void {
  emit('delete-orphan-permit', permit)
}
</script>

<template>
  <div class="permit-list-view">
    <header class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h2 class="text-lg font-semibold text-text-primary">Your permits</h2>
      <span
        v-if="!isLoading"
        class="text-sm tabular-nums text-text-dim"
        data-testid="permit-list-count"
      >
        {{ permits.length }}
        {{ permits.length === 1 ? 'permit' : 'permits' }}
      </span>
    </header>

    <!-- Loading -->
    <div
      v-if="isLoading"
      class="flex flex-col items-center justify-center py-12"
      data-testid="permit-list-loading"
    >
      <svg
        class="animate-spin h-10 w-10 text-primary-600 dark:text-primary-400 mb-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <p class="text-sm text-text-secondary">Loading permits...</p>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="permits.length === 0"
      class="bg-bg-elevated rounded-2xl border border-border-subtle p-8 text-center"
      data-testid="permit-list-empty"
    >
      <svg
        class="w-12 h-12 text-text-dim mx-auto mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <p class="text-text-secondary mb-2">
        {{
          searchQuery?.trim().length >= 2
            ? `No matches for "${searchQuery.trim()}"`
            : 'No permits to show'
        }}
      </p>
      <p class="text-sm text-text-dim mb-4">
        {{
          searchQuery?.trim().length >= 2
            ? 'Try a different search or clear the search box to see all permits.'
            : 'Use Find Near Me to fetch permits from the server, or wait for assigned permits to sync.'
        }}
      </p>
      <button
        type="button"
        class="h-11 px-4 rounded-lg font-medium bg-primary-600 text-white hover:bg-primary-700 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
        @click="emit('refresh')"
      >
        Refresh
      </button>
    </div>

    <!-- Card grid §5.3: 1 col (phone), 2 col @768px+ (tablet), 3 col @1024px+ (iPad Pro / desktop). Uses default Tailwind breakpoints (md/lg) for reliable iPad PWA. -->
    <div
      v-else
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 pb-2"
      data-testid="permit-list-cards"
      role="list"
    >
      <PermitCard
        v-for="permit in permits"
        :key="permit.id"
        :permit="permit"
        :show-orphan-delete="allowOrphanDelete"
        role="listitem"
        @click="handleSelectPermit"
        @delete-orphan="handleDeleteOrphan"
      />
    </div>
  </div>
</template>
