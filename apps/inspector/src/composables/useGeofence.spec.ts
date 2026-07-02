import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { useGeofence, haversineDistanceMeters, DEFAULT_GEOFENCE_RADIUS_METERS } from './useGeofence'

// Mock useGeolocation so we control position
const mockPosition = ref<GeolocationPosition | null>(null)
const mockError = ref<unknown>(null)
const mockWatchPosition = vi.fn()
const mockStopWatching = vi.fn()
const mockGetCurrentPosition = vi.fn()

vi.mock('./useGeolocation', () => ({
  useGeolocation: () => ({
    position: mockPosition,
    error: mockError,
    watchPosition: mockWatchPosition,
    stopWatching: mockStopWatching,
    getCurrentPosition: mockGetCurrentPosition,
  }),
}))

describe('haversineDistanceMeters', () => {
  it('returns 0 for same point', () => {
    expect(haversineDistanceMeters(51.0447, -114.0719, 51.0447, -114.0719)).toBe(0)
  })

  it('returns positive distance for different points', () => {
    const d = haversineDistanceMeters(51.0447, -114.0719, 51.045, -114.072)
    expect(d).toBeGreaterThan(0)
    expect(Number.isFinite(d)).toBe(true)
  })

  it('returns ~111km per degree latitude at equator (approx)', () => {
    const d = haversineDistanceMeters(0, 0, 1, 0)
    expect(d).toBeGreaterThan(110_000)
    expect(d).toBeLessThan(112_000)
  })
})

describe('useGeofence', () => {
  const permitLocation = { latitude: 51.0447, longitude: -114.0719 }

  beforeEach(() => {
    vi.clearAllMocks()
    mockPosition.value = null
    mockError.value = null
  })

  describe('distance calculation', () => {
    it('sets distanceMeters when position and target are set', async () => {
      const target = ref(permitLocation)
      const { distanceMeters, start } = useGeofence({ target, watchMode: true })

      expect(distanceMeters.value).toBeNull()

      mockPosition.value = {
        coords: {
          latitude: 51.0447,
          longitude: -114.0719,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      }

      await start()
      expect(distanceMeters.value).toBe(0)
    })

    it('computes distance when user is away from target', async () => {
      const target = ref(permitLocation)
      const { distanceMeters, start } = useGeofence({ target, radiusMeters: 100, watchMode: true })

      mockPosition.value = {
        coords: {
          latitude: 51.05,
          longitude: -114.08,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      }

      await start()
      expect(distanceMeters.value).not.toBeNull()
      expect(distanceMeters.value).toBeGreaterThan(100)
    })
  })

  describe('isOutsideRadius', () => {
    it('is false when inside radius', async () => {
      const target = ref(permitLocation)
      const { isOutsideRadius, start } = useGeofence({ target, radiusMeters: 500, watchMode: true })

      mockPosition.value = {
        coords: {
          latitude: 51.0448,
          longitude: -114.072,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      }

      await start()
      expect(isOutsideRadius.value).toBe(false)
    })

    it('is true when outside radius', async () => {
      const target = ref(permitLocation)
      const { isOutsideRadius, start } = useGeofence({ target, radiusMeters: 100, watchMode: true })

      mockPosition.value = {
        coords: {
          latitude: 51.05,
          longitude: -114.08,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      }

      await start()
      expect(isOutsideRadius.value).toBe(true)
    })

    it('does not trigger when distance is null', async () => {
      const target = ref(permitLocation)
      const { isOutsideRadius } = useGeofence({ target, watchMode: true })
      mockPosition.value = null
      expect(isOutsideRadius.value).toBe(false)
    })
  })

  describe('dismiss', () => {
    it('sets isDismissed to true', async () => {
      const target = ref(permitLocation)
      const { isDismissed, dismiss } = useGeofence({ target })
      expect(isDismissed.value).toBe(false)
      dismiss()
      expect(isDismissed.value).toBe(true)
    })
  })

  describe('audit logging', () => {
    it('calls onGeofenceWarning when outside radius', async () => {
      const onGeofenceWarning = vi.fn()
      const target = ref(permitLocation)
      const { start } = useGeofence({
        target,
        radiusMeters: 100,
        watchMode: true,
        onGeofenceWarning,
      })

      mockPosition.value = {
        coords: {
          latitude: 51.05,
          longitude: -114.08,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      }

      await start()
      expect(onGeofenceWarning).toHaveBeenCalled()
      const payload = onGeofenceWarning.mock.calls[0][0]
      expect(payload).toMatchObject({
        permitLatitude: 51.0447,
        permitLongitude: -114.0719,
        userLatitude: 51.05,
        userLongitude: -114.08,
        radiusMeters: 100,
      })
      expect(payload.distanceMeters).toBeGreaterThan(100)
      expect(typeof payload.timestamp).toBe('string')
    })

    it('does not call onGeofenceWarning when inside radius', async () => {
      const onGeofenceWarning = vi.fn()
      const target = ref(permitLocation)
      const { start } = useGeofence({
        target,
        radiusMeters: 5000,
        watchMode: true,
        onGeofenceWarning,
      })

      mockPosition.value = {
        coords: {
          latitude: 51.0448,
          longitude: -114.072,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      }

      await start()
      expect(onGeofenceWarning).not.toHaveBeenCalled()
    })
  })

  describe('start / stop', () => {
    it('calls watchPosition when start() and watchMode true', async () => {
      const target = ref(permitLocation)
      const { start, stop } = useGeofence({ target, watchMode: true })
      await start()
      expect(mockWatchPosition).toHaveBeenCalled()
      stop()
      expect(mockStopWatching).toHaveBeenCalled()
    })

    it('uses default radius when not provided', async () => {
      const onGeofenceWarning = vi.fn()
      const target = ref(permitLocation)
      mockPosition.value = {
        coords: {
          latitude: 51.05,
          longitude: -114.08,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      }
      const { start } = useGeofence({ target, onGeofenceWarning })
      await start()
      expect(onGeofenceWarning).toHaveBeenCalled()
      expect(onGeofenceWarning.mock.calls[0][0].radiusMeters).toBe(DEFAULT_GEOFENCE_RADIUS_METERS)
    })
  })
})
