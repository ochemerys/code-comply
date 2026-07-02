import { ref, computed, watch, onUnmounted, isRef, type Ref, type ComputedRef } from 'vue'
import { useGeolocation } from './useGeolocation'

/** Default geofence radius in meters (per M4-S8) */
export const DEFAULT_GEOFENCE_RADIUS_METERS = 100

/**
 * Haversine distance between two WGS84 points in meters.
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

export interface GeofenceTarget {
  latitude: number
  longitude: number
}

export interface UseGeofenceOptions {
  /** Permit/site location to check distance against */
  target: Ref<GeofenceTarget | null> | GeofenceTarget | null
  /** Radius in meters; inspector is "inside" when distance <= radius */
  radiusMeters?: number
  /** Use GPS watch mode for continuous updates (default true for geofence) */
  watchMode?: boolean
  /** Called when user goes outside radius (for audit logging) */
  onGeofenceWarning?: (payload: GeofenceWarningPayload) => void
}

export interface GeofenceWarningPayload {
  permitLatitude: number
  permitLongitude: number
  userLatitude: number
  userLongitude: number
  distanceMeters: number
  radiusMeters: number
  timestamp: string
}

export interface UseGeofenceReturn {
  /** Distance from current position to target in meters, or null if unknown */
  distanceMeters: Ref<number | null>
  /** True when user is outside the configured radius */
  isOutsideRadius: ComputedRef<boolean>
  /** Whether the warning has been dismissed by the user */
  isDismissed: Ref<boolean>
  /** Dismiss the warning (hides until next time outside radius) */
  dismiss: () => void
  /** Start monitoring position (call when viewing a permit). Uses watch if watchMode, else single getCurrentPosition. */
  start: () => Promise<void>
  /** Stop monitoring (call on leave permit view) */
  stop: () => void
  /** Whether position is currently being watched */
  isWatching: Ref<boolean>
  /** Geolocation error if any */
  geoError: Ref<unknown>
}

/**
 * Geofence composable: warns when inspector is outside a configurable radius from permit location.
 *
 * - Configurable radius (default 100m)
 * - Works with GPS watch mode for continuous updates
 * - Exposes distance and isOutsideRadius
 * - Dismissible warning; audit callback for logging
 *
 * @see M4-S8 Implement Geofence Warning
 */
export function useGeofence(options: UseGeofenceOptions): UseGeofenceReturn {
  const {
    target,
    radiusMeters = DEFAULT_GEOFENCE_RADIUS_METERS,
    watchMode = true,
    onGeofenceWarning,
  } = options

  const targetRef: Ref<GeofenceTarget | null> = isRef(target) ? target : ref(target)

  const {
    position,
    error: geoError,
    watchPosition,
    stopWatching,
    getCurrentPosition,
  } = useGeolocation()

  const distanceMeters = ref<number | null>(null)
  const isDismissed = ref(false)
  const isWatching = ref(false)

  /** Last time we fired audit callback for this "outside" session to avoid spam */
  let lastAuditTimestamp = 0
  const AUDIT_THROTTLE_MS = 60_000 // log at most once per minute per "outside" period

  const isOutsideRadius = computed(() => {
    const d = distanceMeters.value
    if (d === null) return false
    return d > radiusMeters
  })

  function updateDistance() {
    const pos = position.value
    const t = targetRef.value
    if (!pos?.coords || !t) {
      distanceMeters.value = null
      return
    }
    const d = haversineDistanceMeters(
      pos.coords.latitude,
      pos.coords.longitude,
      t.latitude,
      t.longitude,
    )
    distanceMeters.value = d

    // Audit: when outside radius, call callback (throttled)
    if (d > radiusMeters && onGeofenceWarning) {
      const now = Date.now()
      if (now - lastAuditTimestamp >= AUDIT_THROTTLE_MS) {
        lastAuditTimestamp = now
        onGeofenceWarning({
          permitLatitude: t.latitude,
          permitLongitude: t.longitude,
          userLatitude: pos.coords.latitude,
          userLongitude: pos.coords.longitude,
          distanceMeters: d,
          radiusMeters,
          timestamp: new Date().toISOString(),
        })
      }
    }
  }

  watch([position, targetRef], () => updateDistance(), { immediate: true })

  function dismiss() {
    isDismissed.value = true
  }

  async function start() {
    isDismissed.value = false
    if (watchMode) {
      watchPosition()
      isWatching.value = true
    } else {
      await getCurrentPosition()
      updateDistance()
    }
  }

  function stop() {
    if (watchMode) {
      stopWatching()
      isWatching.value = false
    }
    distanceMeters.value = null
  }

  onUnmounted(() => {
    stop()
  })

  return {
    distanceMeters,
    isOutsideRadius,
    isDismissed,
    dismiss,
    start,
    stop,
    isWatching,
    geoError,
  }
}
