import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import GeofenceWarning from './GeofenceWarning.vue'

const mockDismiss = vi.fn()
const mockStart = vi.fn()
const mockStop = vi.fn()

vi.mock('@/composables/useGeofence', () => ({
  useGeofence: () => ({
    distanceMeters: { value: 250 },
    isOutsideRadius: { value: true },
    isDismissed: { value: false },
    dismiss: mockDismiss,
    start: mockStart,
    stop: mockStop,
    isWatching: { value: true },
    geoError: { value: null },
  }),
  DEFAULT_GEOFENCE_RADIUS_METERS: 100,
}))

describe('GeofenceWarning', () => {
  const permit = { latitude: 51.0447, longitude: -114.0719 }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('shows warning when outside radius and not dismissed', () => {
      const wrapper = mount(GeofenceWarning, {
        props: { permit },
      })

      expect(wrapper.text()).toContain('Outside Inspection Area')
      expect(wrapper.find('[data-testid="geofence-inspection-area-rule"]').text()).toContain(
        'Inspection area: within 100 m of the permit location.',
      )
      expect(wrapper.find('[data-testid="geofence-distance-message"]').text()).toContain('250 m')
      expect(wrapper.find('[data-testid="geofence-distance-message"]').text()).toContain(
        'from the permit location',
      )
    })

    it('does not render when permit is null', () => {
      const wrapper = mount(GeofenceWarning, {
        props: { permit: null },
      })

      expect(wrapper.find('.geofence-warning').exists()).toBe(false)
    })

    it('calls start on mount when permit is provided', () => {
      mount(GeofenceWarning, { props: { permit } })
      expect(mockStart).toHaveBeenCalled()
    })
  })

  describe('actions', () => {
    it('calls dismiss when Dismiss button is clicked', async () => {
      const wrapper = mount(GeofenceWarning, { props: { permit } })
      await wrapper.find('[data-testid="geofence-dismiss"]').trigger('click')
      expect(mockDismiss).toHaveBeenCalled()
    })

    it('Get Directions link has correct destination', () => {
      const wrapper = mount(GeofenceWarning, { props: { permit } })
      const link = wrapper.find('[data-testid="geofence-get-directions"]')
      expect(link.exists()).toBe(true)
      expect(link.attributes('href')).toContain('51.0447')
      expect(link.attributes('href')).toContain('-114.0719')
      expect(link.attributes('target')).toBe('_blank')
    })
  })

  it('formats distance in meters when under 1km', () => {
    const wrapper = mount(GeofenceWarning, { props: { permit } })
    expect(wrapper.text()).toMatch(/\d+\s*m/)
  })
})
