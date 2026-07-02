<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useNearbyPermits } from '@/composables/useNearbyPermits'
import type { PermitListDTO } from '@codecomply/validators'

const router = useRouter()

/**
 * FindNearbyPermits Component
 *
 * GPS-based permit discovery with configurable radius.
 * Displays nearby permits in a list view with distance information.
 *
 * Features:
 * - "Find Near Me" button triggers GPS request
 * - Radius selector (1km, 5km, 10km, 20km)
 * - Results list with permit details and distance
 * - Loading spinner during fetch
 * - Error handling for GPS failures
 * - Empty state when no permits found
 *
 * Design: Mobile-first, tablet-optimized
 * - Touch-friendly buttons (min 44px height)
 * - Responsive grid layout
 * - Clear visual feedback
 */

// Available radius options in meters
const RADIUS_OPTIONS = [
  { label: '1 km', value: 1000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
  { label: '20 km', value: 20000 },
]

// Selected radius (reactive)
const selectedRadius = ref(5000) // Default 5km
const isSearchingNearby = ref(false)

// Nearby permits composable
const {
  permits,
  isLoading,
  error,
  position,
  gpsError,
  isGettingLocation,
  isGpsSupported,
  radius,
  fetchNearbyPermits,
  refetch,
  totalWithCoordinates,
  lastNewlyCachedCount,
} = useNearbyPermits({
  onSearchPhaseStart: () => {
    isSearchingNearby.value = true
  },
})

// Update radius and refetch when changed
const handleRadiusChange = async () => {
  radius.value = selectedRadius.value
  if (position.value) {
    try {
      await refetch()
    } catch (err) {
      console.error('Failed to refetch with new radius:', err)
    }
  }
}

// Computed: Has results
const hasResults = computed(() => permits.value.length > 0)

// Computed: Show results section
const showResults = computed(() => position.value && !isLoading.value)

// Computed: Error message
const errorMessage = computed(() => {
  if (localError.value) {
    return localError.value
  }
  if (gpsError.value) {
    return gpsError.value.message
  }
  if (error.value) {
    return error.value.message
  }
  return null
})

// Computed: Empty state message (when no permits in radius)
const emptyStateTitle = computed(() => {
  const total = totalWithCoordinates.value
  if (total === 0) {
    return 'No permits have GPS coordinates'
  }
  if (total != null && total > 0) {
    return 'No permits within this radius'
  }
  return 'No permits found in this area'
})

const emptyStateHint = computed(() => {
  const total = totalWithCoordinates.value
  if (total === 0) {
    return 'Permits need latitude/longitude in the database to appear here. Run the seed (pnpm db:seed) or add coordinates to permits.'
  }
  if (total != null && total > 0) {
    return 'Try increasing the search radius'
  }
  return 'Try increasing the search radius'
})

const emit = defineEmits<{
  (e: 'select-permit', permit: PermitListDTO): void
  (e: 'permits-added', count: number): void
}>()

// Smart success message: how many found in system, how many newly added to local cache
interface FindResult {
  totalFound: number
  newlyAdded: number
}
const findResult = ref<FindResult | null>(null)
const localError = ref<string | null>(null)
let findResultTimeout: ReturnType<typeof setTimeout> | null = null

function messageFromUnknown(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: string }).message)
  }
  return 'Could not find nearby permits. Please try again.'
}

async function handleFindNearMeWithEmit() {
  findResult.value = null
  localError.value = null
  if (findResultTimeout) {
    clearTimeout(findResultTimeout)
    findResultTimeout = null
  }
  isSearchingNearby.value = true
  try {
    await fetchNearbyPermits()
    const totalFound = permits.value.length
    if (totalFound > 0) {
      emit('permits-added', totalFound)
      const newlyAdded = lastNewlyCachedCount.value
      findResult.value = { totalFound, newlyAdded }
      findResultTimeout = setTimeout(() => {
        findResult.value = null
        findResultTimeout = null
      }, 5000)
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message?.includes('not authenticated')) {
      router.push({
        name: 'login',
        query: { redirect: router.currentRoute.value.fullPath },
      })
    } else {
      localError.value = messageFromUnknown(err)
      console.error('Failed to find nearby permits:', err)
    }
  } finally {
    isSearchingNearby.value = false
  }
}
</script>

<template>
  <div class="find-nearby-permits">
    <!-- GPS Not Supported (compact) -->
    <div v-if="!isGpsSupported" class="space-y-3 mb-4">
      <div
        class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3"
      >
        <p class="text-sm text-red-700 dark:text-red-400">
          <strong>GPS Not Supported</strong> — GPS is not supported. Use search or permit list
          instead.
        </p>
      </div>
      <button
        type="button"
        class="h-11 min-h-touch w-full flex items-center justify-center gap-2 px-5 rounded-xl bg-blue-600 text-white text-sm font-medium opacity-50 cursor-not-allowed"
        disabled
        aria-disabled="true"
      >
        Find Near Me
      </button>
    </div>

    <!-- Single row: Radius + Find Near Me (stack on narrow, row on tablet) -->
    <div v-else class="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:gap-4">
      <div class="flex-1 tablet:min-w-[140px] tablet:max-w-[180px]">
        <label for="radius-select" class="sr-only">Search radius</label>
        <select
          id="radius-select"
          v-model="selectedRadius"
          class="w-full h-11 min-h-touch px-4 rounded-xl border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 text-gray-900 dark:text-gray-100 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          :disabled="isLoading"
          @change="handleRadiusChange"
        >
          <option v-for="option in RADIUS_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>
      <button
        type="button"
        class="h-11 min-h-touch flex flex-1 tablet:flex-initial items-center justify-center gap-2 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        :disabled="isLoading"
        @click="handleFindNearMeWithEmit"
      >
        <svg
          v-if="isGettingLocation"
          class="animate-spin h-5 w-5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
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
        <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        <span>{{ isGettingLocation ? 'Getting Location...' : 'Find Near Me' }}</span>
      </button>
    </div>

    <!-- Error (compact) -->
    <div
      v-if="localError || (errorMessage && !isLoading)"
      class="mt-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3"
    >
      <div class="flex items-start gap-3">
        <svg
          class="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p class="text-sm text-amber-700 dark:text-amber-400">
          {{ localError || errorMessage }}
        </p>
      </div>
    </div>

    <!-- Loading (compact) -->
    <div
      v-if="(isLoading && !isGettingLocation) || (isSearchingNearby && !isGettingLocation)"
      class="mt-3 flex items-center justify-center gap-3 py-4"
      data-testid="loading-spinner"
    >
      <svg
        class="animate-spin h-6 w-6 text-blue-600 dark:text-blue-400"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <p class="text-sm text-gray-600 dark:text-gray-400">Searching for nearby permits...</p>
    </div>

    <!-- Success: how many found in system, how many newly added to local cache -->
    <div
      v-if="findResult"
      class="mt-3 flex items-start gap-2 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-800 dark:text-green-300"
    >
      <svg
        class="w-5 h-5 flex-shrink-0 mt-0.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      <span>
        <strong
          >{{ findResult.totalFound }} permit{{
            findResult.totalFound !== 1 ? 's' : ''
          }}
          found</strong
        >
        in your area.
        <template v-if="findResult.newlyAdded > 0">
          {{ findResult.newlyAdded }} new to your list below.
        </template>
        <template v-else> All already in your list. </template>
      </span>
    </div>

    <!-- Empty radius (no coords or none in radius): brief message only -->
    <div
      v-else-if="showResults && !hasResults"
      class="mt-3 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-4 py-3 text-sm text-gray-600 dark:text-gray-400"
    >
      {{ emptyStateTitle }} {{ emptyStateHint }}
    </div>
  </div>
</template>

<style scoped>
/* Component-specific styles if needed */
</style>
