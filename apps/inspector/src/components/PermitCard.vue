<script setup lang="ts">
import { computed } from 'vue'
import type { PermitListDTO } from '@codecomply/validators'

/**
 * PermitCard - Single permit card for list view (M4-S10).
 * Displays: permit number, address, status badge, next inspection date, distance (GPS).
 * Orphan permits (no longer on server) show a persistent warning; Remove from device
 * appears only when online after the first successful assigned sync (parent-controlled).
 */
const props = defineProps<{
  permit: PermitListDTO
  /** When true with permit.isOrphan, show Remove from device */
  showOrphanDelete?: boolean
}>()

defineEmits<{
  (e: 'click', permit: PermitListDTO): void
  (e: 'delete-orphan', permit: PermitListDTO): void
}>()

const isOrphan = computed(() => props.permit.isOrphan === true)
const showDelete = computed(() => isOrphan.value && props.showOrphanDelete === true)

const statusBadgeClasses = computed(() => {
  const s = props.permit.status
  const base = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium'
  const statusMap: Record<string, string> = {
    ACTIVE: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    COMPLETED: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    EXPIRED: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
    CANCELLED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  }
  return `${base} ${statusMap[s] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`
})

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}
</script>

<template>
  <article
    class="permit-card w-full text-left bg-bg-surface rounded-2xl shadow-sm border transition-all duration-200 ease-out overflow-hidden flex flex-col min-h-[100px]"
    :class="
      isOrphan
        ? 'border-amber-300 dark:border-amber-600/50 ring-1 ring-amber-200/80 dark:ring-amber-900/40'
        : 'border-transparent dark:border-border-subtle hover:shadow-md hover:border-gray-200 dark:hover:border-border-strong'
    "
  >
    <div
      v-if="isOrphan"
      class="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200/90 dark:border-amber-800/60"
      role="status"
    >
      <p class="text-xs font-medium text-amber-900 dark:text-amber-100 flex gap-2 items-start">
        <svg
          class="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-700 dark:text-amber-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span>
          Not found on server — this copy may be outdated (e.g. after a data reset). You can remove
          it from this device when online.
        </span>
      </p>
    </div>

    <div
      role="button"
      tabindex="0"
      class="p-5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 min-h-touch flex-1 flex flex-col"
      @click="$emit('click', permit)"
      @keydown.enter="$emit('click', permit)"
      @keydown.space.prevent="$emit('click', permit)"
    >
      <div class="flex items-start justify-between gap-4 mb-2">
        <div class="min-w-0 flex-1">
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 break-words">
            {{ permit.permitNumber }}
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
            {{ permit.address }}
          </p>
        </div>
        <div class="flex flex-shrink-0 flex-col items-end gap-1.5">
          <span :class="statusBadgeClasses">{{ permit.status }}</span>
          <span
            v-if="permit.distance != null"
            class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
          >
            {{ formatDistance(permit.distance) }}
          </span>
        </div>
      </div>
      <div class="text-sm text-gray-500 dark:text-slate-400 space-y-1">
        <div>
          <span>Next inspection:</span>
          <span class="ml-1 font-medium text-gray-700 dark:text-gray-300">
            {{ formatDate(permit.nextInspectionDate) }}
          </span>
        </div>
        <div v-if="permit.inspectionStageLabel">
          <span>Stage:</span>
          <span
            class="ml-1 font-medium text-gray-700 dark:text-gray-300"
            data-testid="permit-card-stage"
          >
            {{ permit.inspectionStageLabel }}
          </span>
        </div>
      </div>
      <div class="flex justify-end mt-2" aria-hidden="true">
        <svg
          class="w-5 h-5 text-gray-400 dark:text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>

    <div v-if="showDelete" class="px-4 pb-4 pt-0 flex justify-end border-t border-transparent">
      <button
        type="button"
        class="min-h-touch px-4 py-2 rounded-lg text-sm font-medium border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 active:scale-[0.98] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500"
        data-testid="permit-card-remove-orphan"
        @click.stop="$emit('delete-orphan', permit)"
      >
        Remove from device
      </button>
    </div>
  </article>
</template>
