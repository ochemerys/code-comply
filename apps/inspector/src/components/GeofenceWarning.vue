<!--
  GeofenceWarning - Warns when inspector is outside configurable radius from permit location

  Shows a dismissible banner with distance and "Get Directions" when outside the geofence.
  Works with GPS watch mode. Warning is logged for audit via optional callback.

  @component
  @see M4-S8 Implement Geofence Warning
  @see Mobile-First Design Guide §3.2 - Touch targets (min 44px)
  @see Component Design Specification Mobile First
-->

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useGeofence, DEFAULT_GEOFENCE_RADIUS_METERS } from '@/composables/useGeofence'
import type { GeofenceWarningPayload } from '@/composables/useGeofence'

interface PermitLocation {
  latitude: number
  longitude: number
}

interface Props {
  /** Permit/site location (must have latitude/longitude) */
  permit: PermitLocation | null
  /** Geofence radius in meters (default 100) */
  radiusMeters?: number
  /** Called when warning is shown (audit log) */
  onAuditLog?: (payload: GeofenceWarningPayload) => void
}

const props = withDefaults(defineProps<Props>(), {
  radiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS,
})

const permitRef = ref<PermitLocation | null>(props.permit)

watch(
  () => props.permit,
  (p) => {
    permitRef.value = p
  },
  { immediate: true },
)

const { distanceMeters, isOutsideRadius, isDismissed, dismiss, start, stop, geoError } =
  useGeofence({
    target: permitRef,
    radiusMeters: props.radiusMeters,
    watchMode: true,
    onGeofenceWarning: props.onAuditLog,
  })

/** Whether to show the warning banner */
const showWarning = computed(() =>
  Boolean(permitRef.value && isOutsideRadius.value && !isDismissed.value),
)

/** Formatted distance for display */
const formattedDistance = computed(() => {
  const d = distanceMeters.value
  if (d === null) return '—'
  if (d < 1000) return `${Math.round(d)} m`
  return `${(d / 1000).toFixed(1)} km`
})

/** Formatted geofence radius so users can see inside vs outside the inspection area */
const formattedRadius = computed(() => {
  const r = props.radiusMeters
  if (r < 1000) return `${Math.round(r)} m`
  return `${(r / 1000).toFixed(1)} km`
})

/** Google Maps / Apple Maps URL for directions to permit */
const directionsUrl = computed(() => {
  const p = permitRef.value
  if (!p) return ''
  const { latitude, longitude } = p
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
})

function openDirections() {
  if (directionsUrl.value) window.open(directionsUrl.value, '_blank', 'noopener,noreferrer')
}

onMounted(() => {
  if (permitRef.value) start()
})

onUnmounted(() => {
  stop()
})

watch(permitRef, (p) => {
  if (p) start()
  else stop()
})
</script>

<template>
  <div v-if="showWarning" class="geofence-warning mb-4" role="alert">
    <div
      class="flex flex-col gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 shadow-sm"
    >
      <div class="flex items-start gap-3">
        <!-- Icon -->
        <span
          class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50"
          aria-hidden="true"
        >
          <svg
            class="h-6 w-6 text-amber-700 dark:text-amber-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </span>

        <div class="min-w-0 flex-1">
          <h3 class="text-base font-semibold text-amber-900 dark:text-amber-100">
            Outside Inspection Area
          </h3>
          <p
            class="mt-1 text-sm text-amber-800 dark:text-amber-200"
            data-testid="geofence-inspection-area-rule"
          >
            Inspection area: within {{ formattedRadius }} of the permit location.
          </p>
          <p
            class="mt-1 text-sm text-amber-800 dark:text-amber-200"
            data-testid="geofence-distance-message"
          >
            You are {{ formattedDistance }} from the permit location.
          </p>

          <div class="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              class="inline-flex h-11 min-w-[44px] items-center justify-center rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 px-4 text-sm font-medium text-amber-900 dark:text-amber-100 shadow-sm hover:bg-amber-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 active:scale-95 transition-all"
              data-testid="geofence-dismiss"
              @click="dismiss"
            >
              Dismiss
            </button>
            <a
              :href="directionsUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex h-11 min-w-[44px] items-center justify-center rounded-lg bg-amber-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 active:scale-95 transition-all"
              data-testid="geofence-get-directions"
              @click.prevent="openDirections"
            >
              Get Directions
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- GPS error (optional inline message) -->
    <p
      v-if="geoError"
      class="mt-2 text-xs text-red-600 dark:text-red-400"
      data-testid="geofence-gps-error"
    >
      Location unavailable. Distance may be inaccurate.
    </p>
  </div>
</template>
