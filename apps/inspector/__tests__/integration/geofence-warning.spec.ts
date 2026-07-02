/**
 * Integration tests for Geofence Warning (M4-S8)
 *
 * Tests the geofence workflow: GPS watch, distance calculation,
 * warning display when outside radius, dismiss, and audit logging.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import GeofenceWarning from '@/components/GeofenceWarning.vue'

const permitLocation = { latitude: 51.0447, longitude: -114.0719 }

describe('Geofence Warning Integration', () => {
  let watchCallback: (position: GeolocationPosition) => void

  beforeEach(() => {
    vi.clearAllMocks()
    const mockGeolocation = {
      getCurrentPosition: vi.fn(),
      watchPosition: vi.fn((success: (p: GeolocationPosition) => void) => {
        watchCallback = success
        return 1
      }),
      clearWatch: vi.fn(),
    }
    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows warning when position is outside radius and audit callback is invoked', async () => {
    const onAuditLog = vi.fn()
    const wrapper = mount(GeofenceWarning, {
      props: {
        permit: permitLocation,
        radiusMeters: 100,
        onAuditLog,
      },
    })

    await flushPromises()
    expect(watchCallback).toBeDefined()

    // Simulate position far from permit (> 100m)
    watchCallback({
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
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Outside Inspection Area')
    expect(wrapper.find('[data-testid="geofence-inspection-area-rule"]').text()).toContain(
      'Inspection area: within 100 m of the permit location.',
    )
    expect(wrapper.find('[data-testid="geofence-distance-message"]').text()).toContain(
      'from the permit location',
    )
    expect(onAuditLog).toHaveBeenCalled()
    const payload = onAuditLog.mock.calls[0][0]
    expect(payload.distanceMeters).toBeGreaterThan(100)
    expect(payload.radiusMeters).toBe(100)
  })

  it('dismiss hides the warning', async () => {
    const wrapper = mount(GeofenceWarning, {
      props: { permit: permitLocation, radiusMeters: 100 },
    })

    await flushPromises()
    expect(watchCallback).toBeDefined()

    watchCallback({
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
    })

    await flushPromises()
    expect(wrapper.text()).toContain('Outside Inspection Area')

    await wrapper.find('[data-testid="geofence-dismiss"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('.geofence-warning').exists()).toBe(false)
  })

  it('does not show warning when inside radius', async () => {
    const wrapper = mount(GeofenceWarning, {
      props: { permit: permitLocation, radiusMeters: 5000 },
    })

    await flushPromises()
    expect(watchCallback).toBeDefined()

    // Same as permit location (inside any radius)
    watchCallback({
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
    })

    await flushPromises()
    expect(wrapper.find('.geofence-warning').exists()).toBe(false)
  })
})
