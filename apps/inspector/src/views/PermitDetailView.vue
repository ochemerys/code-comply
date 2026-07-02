<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PermitDetails from '@/components/PermitDetails.vue'
import InspectionScheduleList from '@/components/InspectionScheduleList.vue'
import GeofenceWarning from '@/components/GeofenceWarning.vue'
import { usePermitDetail } from '@/composables/usePermitDetail'
import type { PermitDetailInspection } from '@/composables/usePermitDetail'
import { resolveChecklistExecutionRouteForConnectivity } from '@/composables/useStartInspectionNavigation'
import { useConnectivity } from '@/composables/useConnectivity'
import { useAuthStore } from '@/stores/auth'

/**
 * PermitDetailView - Full permit detail with info, location, schedule, actions (M4-S11).
 * Start/Continue inspection is only on scheduled inspection tiles (`InspectionScheduleList`), not duplicated in Actions.
 * Works offline with cached data. Sections: Permit Information, Location Details, Scheduled Inspections, Actions.
 */
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { isConnectionAvailable } = useConnectivity()
const permitId = computed(() => route.params.id as string | undefined)

const { permit, isLoading, error, refresh } = usePermitDetail(permitId)

const inspections = computed(() => {
  const p = permit.value
  return (p?.inspections ?? []) as PermitDetailInspection[]
})

const permitLocation = computed(() => {
  const p = permit.value
  if (p?.latitude == null || p?.longitude == null) return null
  return { latitude: p.latitude, longitude: p.longitude }
})

const startInspectionError = ref<string | null>(null)

const unableToEnterInspection = computed(() => {
  return inspections.value.find((i) => i.status === 'SCHEDULED' || i.status === 'IN_PROGRESS')
})

function goUnableToEnter() {
  const insp = unableToEnterInspection.value
  const pid = permitId.value?.trim()
  if (!insp || !pid) return
  void router.push({
    name: 'unable-to-enter',
    params: { inspectionId: insp.id },
    query: { fromPermit: pid },
  })
}

function goBack() {
  router.push({ name: 'permits' })
}

function openDirections() {
  const p = permit.value
  if (p?.latitude != null && p?.longitude != null) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

async function onStartInspection(inspection: PermitDetailInspection) {
  startInspectionError.value = null
  try {
    const { inspectionId, executionId } = await resolveChecklistExecutionRouteForConnectivity(
      inspection,
      isConnectionAvailable.value,
      authStore.accessToken,
    )
    const fromPermit = permitId.value?.trim()
    await router.push({
      name: 'checklist-execution',
      params: { inspectionId, executionId },
      ...(fromPermit ? { query: { fromPermit } } : {}),
    })
  } catch (e) {
    startInspectionError.value = e instanceof Error ? e.message : 'Could not open checklist'
  }
}

function viewHistory() {
  // Placeholder for future milestone
}
</script>

<template>
  <div class="bg-bg-app">
    <main class="px-4 pt-3 tablet:px-6 tablet:pt-5">
      <div class="max-w-2xl mx-auto w-full">
        <header class="flex items-center gap-3 mb-5 tablet:mb-6">
          <button
            type="button"
            class="flex-shrink-0 flex items-center justify-center w-11 h-11 min-h-touch min-w-touch rounded-xl text-text-secondary bg-bg-surface border border-border-subtle hover:bg-bg-elevated active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            aria-label="Back to Permits"
            data-testid="back-to-permits"
            @click="goBack"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </button>
          <div class="min-w-0 flex-1">
            <h1 class="text-xl font-bold text-text-primary truncate tablet:text-2xl">
              Permit details
            </h1>
          </div>
        </header>

        <!-- Loading -->
        <div
          v-if="isLoading"
          class="flex flex-col items-center justify-center py-12"
          data-testid="permit-detail-loading"
        >
          <svg
            class="animate-spin h-10 w-10 text-primary-600 dark:text-primary-400 mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p class="text-sm text-text-secondary">Loading permit...</p>
        </div>

        <!-- Error -->
        <div
          v-else-if="error"
          class="bg-bg-surface rounded-2xl border border-border-subtle p-8 text-center"
          data-testid="permit-detail-error"
        >
          <p class="text-text-secondary mb-4">
            {{ error.message }}
          </p>
          <button
            type="button"
            class="h-11 px-4 rounded-lg font-medium bg-primary-600 text-white hover:bg-primary-700 active:scale-95"
            @click="refresh"
          >
            Try again
          </button>
        </div>

        <!-- Not found -->
        <div
          v-else-if="!isLoading && !permit && permitId"
          class="bg-bg-surface rounded-2xl border border-border-subtle p-8 text-center"
          data-testid="permit-detail-not-found"
        >
          <p class="text-text-secondary mb-4">Permit not found.</p>
          <button
            type="button"
            class="h-11 px-4 rounded-lg font-medium bg-primary-600 text-white hover:bg-primary-700 active:scale-95"
            @click="goBack"
          >
            Back to permits
          </button>
        </div>

        <!-- Content - Scrollable -->
        <div v-else-if="permit">
          <GeofenceWarning v-if="permitLocation" :permit="permitLocation" />

          <PermitDetails :permit="permit" class="mb-6" />

          <InspectionScheduleList
            :inspections="inspections"
            class="mb-6"
            @start-inspection="onStartInspection"
          />

          <p
            v-if="startInspectionError"
            class="mb-3 text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {{ startInspectionError }}
          </p>

          <!-- Actions -->
          <section class="flex flex-col gap-3" aria-label="Actions">
            <button
              v-if="unableToEnterInspection"
              type="button"
              class="w-full min-h-[48px] flex items-center justify-center gap-2 px-6 rounded-xl font-semibold bg-amber-600 text-white hover:bg-amber-700 active:scale-95 transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
              data-testid="unable-to-enter-button"
              @click="goUnableToEnter"
            >
              Unable to enter
            </button>
            <button
              type="button"
              class="w-full min-h-[48px] flex items-center justify-center gap-2 px-6 rounded-xl font-medium bg-bg-surface border border-border-subtle text-text-secondary hover:bg-bg-elevated active:scale-95 transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="get-directions-button"
              :disabled="permit.latitude == null || permit.longitude == null"
              @click="openDirections"
            >
              Get Directions
            </button>
            <button
              type="button"
              class="w-full min-h-[48px] flex items-center justify-center gap-2 px-6 rounded-xl font-medium bg-bg-surface border border-border-subtle text-text-dim hover:bg-bg-elevated active:scale-95 transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              data-testid="view-history-button"
              disabled
              @click="viewHistory"
            >
              View History (coming soon)
            </button>
          </section>
        </div>
      </div>
    </main>
  </div>
</template>
