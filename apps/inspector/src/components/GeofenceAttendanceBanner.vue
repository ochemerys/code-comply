<!--
  GeofenceAttendanceBanner — confirms GPS attendance at the permit site (LSC-A-03).
  Complements GeofenceWarning (outside radius) with a positive inside-geofence indicator.
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useGeofence, DEFAULT_GEOFENCE_RADIUS_METERS } from '@/composables/useGeofence'

interface PermitLocation {
  latitude: number
  longitude: number
}

const props = withDefaults(
  defineProps<{
    permit: PermitLocation | null
    radiusMeters?: number
  }>(),
  {
    radiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS,
  },
)

const permitRef = ref<PermitLocation | null>(props.permit)

watch(
  () => props.permit,
  (p) => {
    permitRef.value = p
  },
  { immediate: true },
)

const { distanceMeters, isOutsideRadius, start, stop, geoError } = useGeofence({
  target: permitRef,
  radiusMeters: props.radiusMeters,
  watchMode: true,
})

const showConfirmed = computed(() =>
  Boolean(permitRef.value && distanceMeters.value != null && !isOutsideRadius.value),
)

const formattedDistance = computed(() => {
  const d = distanceMeters.value
  if (d === null) return '—'
  if (d < 1000) return `${Math.round(d)} m`
  return `${(d / 1000).toFixed(1)} km`
})

onMounted(() => {
  if (permitRef.value) void start()
})

onUnmounted(() => {
  stop()
})

watch(permitRef, (p) => {
  if (p) void start()
  else stop()
})
</script>

<template>
  <div
    v-if="showConfirmed"
    class="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/40"
    role="status"
    data-testid="geofence-attendance-confirmed"
  >
    <p class="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
      GPS attendance confirmed
    </p>
    <p
      class="mt-1 text-sm text-emerald-800 dark:text-emerald-200"
      data-testid="geofence-attendance-distance"
    >
      You are {{ formattedDistance }} from the permit location (within inspection area).
    </p>
  </div>
  <p
    v-else-if="permitRef && geoError"
    class="mb-4 text-sm text-amber-800 dark:text-amber-200"
    data-testid="geofence-attendance-pending"
  >
    Waiting for GPS to confirm site attendance…
  </p>
  <p
    v-else-if="permitRef && isOutsideRadius"
    class="mb-4 text-sm text-amber-800 dark:text-amber-200"
    data-testid="geofence-attendance-outside"
  >
    Move within the inspection area to confirm GPS attendance before recording unable to enter.
  </p>
</template>
