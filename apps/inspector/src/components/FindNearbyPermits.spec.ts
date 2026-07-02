import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FindNearbyPermits from './FindNearbyPermits.vue'
import { useNearbyPermits } from '../composables/useNearbyPermits'
import type { PermitListDTO } from '@codecomply/validators'

// Mock composable
vi.mock('../composables/useNearbyPermits')

describe('FindNearbyPermits', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  const createMockComposable = (overrides: Record<string, unknown> = {}) => ({
    permits: ref<PermitListDTO[]>([]),
    isLoading: ref(false),
    error: ref<Error | null>(null),
    position: ref<GeolocationPosition | null>(null),
    gpsError: ref<unknown>(null),
    isGettingLocation: ref(false),
    isGpsSupported: ref(true),
    radius: ref(5000),
    fetchNearbyPermits: vi.fn(),
    refetch: vi.fn(),
    totalWithCoordinates: ref<number | undefined>(undefined),
    lastNewlyCachedCount: ref(0),
    ...overrides,
  })

  describe('rendering', () => {
    it('should render component with radius selector and Find Near Me button', () => {
      vi.mocked(useNearbyPermits).mockReturnValue(createMockComposable() as any)

      const wrapper = mount(FindNearbyPermits)

      expect(wrapper.find('#radius-select').exists()).toBe(true)
      expect(wrapper.find('button').text()).toContain('Find Near Me')
    })

    it('should render radius selector with default value', () => {
      vi.mocked(useNearbyPermits).mockReturnValue(createMockComposable() as any)

      const wrapper = mount(FindNearbyPermits)

      const select = wrapper.find('#radius-select')
      expect(select.exists()).toBe(true)
      expect((select.element as HTMLSelectElement).value).toBe('5000')
    })

    it('should render Find Near Me button', () => {
      vi.mocked(useNearbyPermits).mockReturnValue(createMockComposable() as any)

      const wrapper = mount(FindNearbyPermits)

      const button = wrapper.find('button')
      expect(button.text()).toContain('Find Near Me')
      expect(button.attributes('disabled')).toBeUndefined()
    })
  })

  describe('GPS not supported', () => {
    it('should show warning when GPS is not supported', () => {
      vi.mocked(useNearbyPermits).mockReturnValue(
        createMockComposable({
          isGpsSupported: ref(false),
        }) as any,
      )

      const wrapper = mount(FindNearbyPermits)

      expect(wrapper.text()).toContain('GPS is not supported')
      expect(wrapper.text()).toContain('Use search or permit list instead')
    })

    it('should show disabled Find Near Me button when GPS not supported', () => {
      vi.mocked(useNearbyPermits).mockReturnValue(
        createMockComposable({
          isGpsSupported: ref(false),
        }) as any,
      )

      const wrapper = mount(FindNearbyPermits)

      const button = wrapper.find('button')
      expect(button.exists()).toBe(true)
      expect(button.text()).toContain('Find Near Me')
      expect(button.attributes('disabled')).toBeDefined()
      expect(button.attributes('aria-disabled')).toBe('true')
    })
  })

  describe('button interactions', () => {
    it('should trigger GPS request when Find Near Me is clicked', async () => {
      const fetchNearbyPermits = vi.fn()
      vi.mocked(useNearbyPermits).mockReturnValue(
        createMockComposable({
          fetchNearbyPermits,
        }) as any,
      )

      const wrapper = mount(FindNearbyPermits)

      await wrapper.find('button').trigger('click')

      expect(fetchNearbyPermits).toHaveBeenCalled()
    })

    it('should disable button during loading', () => {
      vi.mocked(useNearbyPermits).mockReturnValue(
        createMockComposable({
          isLoading: ref(true),
        }) as any,
      )

      const wrapper = mount(FindNearbyPermits)

      const button = wrapper.find('button')
      expect(button.attributes('disabled')).toBeDefined()
    })

    it('should show loading spinner during GPS request', () => {
      vi.mocked(useNearbyPermits).mockReturnValue(
        createMockComposable({
          isGettingLocation: ref(true),
        }) as any,
      )

      const wrapper = mount(FindNearbyPermits)

      expect(wrapper.find('.animate-spin').exists()).toBe(true)
      expect(wrapper.find('button').text()).toContain('Getting Location...')
    })
  })

  describe('radius selection', () => {
    it('should update radius when selection changes', async () => {
      const refetch = vi.fn()
      const radius = { value: 5000 }
      const position = { value: { coords: { latitude: 51.0447, longitude: -114.0719 } } }

      vi.mocked(useNearbyPermits).mockReturnValue(
        createMockComposable({
          radius,
          position,
          refetch,
        }) as any,
      )

      const wrapper = mount(FindNearbyPermits)

      const select = wrapper.find('#radius-select')
      await select.setValue('10000')

      expect(radius.value).toBe(10000)
      await flushPromises()
      expect(refetch).toHaveBeenCalled()
    })

    it('should disable radius selector during loading', () => {
      vi.mocked(useNearbyPermits).mockReturnValue(
        createMockComposable({
          isLoading: ref(true),
        }) as any,
      )

      const wrapper = mount(FindNearbyPermits)

      const select = wrapper.find('#radius-select')
      expect(select.attributes('disabled')).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('should display GPS error message', () => {
      vi.mocked(useNearbyPermits).mockReturnValue(
        createMockComposable({
          gpsError: ref({
            code: 'PERMISSION_DENIED',
            message: 'Location permission denied',
          }),
        }) as any,
      )

      const wrapper = mount(FindNearbyPermits)

      expect(wrapper.text()).toContain('Location permission denied')
    })

    it('should display API error message', () => {
      vi.mocked(useNearbyPermits).mockReturnValue(
        createMockComposable({
          error: ref(new Error('Failed to fetch permits')),
        }) as any,
      )

      const wrapper = mount(FindNearbyPermits)

      expect(wrapper.text()).toContain('Failed to fetch permits')
    })

    it('should not show error during loading', () => {
      vi.mocked(useNearbyPermits).mockReturnValue(
        createMockComposable({
          error: ref(new Error('Failed to fetch permits')),
          isLoading: ref(true),
        }) as any,
      )

      const wrapper = mount(FindNearbyPermits)

      expect(wrapper.text()).not.toContain('Failed to fetch permits')
    })
  })

  describe('loading state', () => {
    it('should show loading spinner when fetching permits', () => {
      vi.mocked(useNearbyPermits).mockReturnValue(
        createMockComposable({
          isLoading: ref(true),
          isGettingLocation: ref(false),
        }) as any,
      )

      const wrapper = mount(FindNearbyPermits)

      expect(wrapper.find('[data-testid="loading-spinner"] .animate-spin').exists()).toBe(true)
      expect(wrapper.text()).toContain('Searching for nearby permits...')
    })
  })

  describe('permits-added and success message', () => {
    const mockPermits: PermitListDTO[] = [
      {
        id: 'permit-1',
        permitNumber: 'P-2024-001',
        address: '123 Main St',
        status: 'ACTIVE',
        distance: 500,
      },
      {
        id: 'permit-2',
        permitNumber: 'P-2024-002',
        address: '456 Oak Ave',
        status: 'EXPIRED',
        distance: 1200,
      },
    ]

    it('shows smart message: total found and how many newly added to list', async () => {
      const permitsRef = ref<PermitListDTO[]>([])
      const lastNewlyCachedCountRef = ref(0)
      const fetchNearbyPermits = vi.fn().mockImplementation(async () => {
        permitsRef.value = [...mockPermits]
        lastNewlyCachedCountRef.value = 2 // 2 newly added to cache
      })
      vi.mocked(useNearbyPermits).mockReturnValue(
        createMockComposable({
          permits: permitsRef,
          fetchNearbyPermits,
          lastNewlyCachedCount: lastNewlyCachedCountRef,
        }) as any,
      )

      const wrapper = mount(FindNearbyPermits)
      await wrapper.find('button').trigger('click')
      await flushPromises()

      expect(fetchNearbyPermits).toHaveBeenCalled()
      expect(wrapper.emitted('permits-added')).toEqual([[2]])
      expect(wrapper.text()).toContain('2 permits found')
      expect(wrapper.text()).toContain('2 new to your list below')
    })

    it('shows "All already in your list" when none were new to cache', async () => {
      const permitsRef = ref<PermitListDTO[]>([])
      const lastNewlyCachedCountRef = ref(0)
      const fetchNearbyPermits = vi.fn().mockImplementation(async () => {
        permitsRef.value = [...mockPermits]
        lastNewlyCachedCountRef.value = 0 // none new
      })
      vi.mocked(useNearbyPermits).mockReturnValue(
        createMockComposable({
          permits: permitsRef,
          fetchNearbyPermits,
          lastNewlyCachedCount: lastNewlyCachedCountRef,
        }) as any,
      )

      const wrapper = mount(FindNearbyPermits)
      await wrapper.find('button').trigger('click')
      await flushPromises()

      expect(wrapper.emitted('permits-added')).toEqual([[2]])
      expect(wrapper.text()).toContain('2 permits found')
      expect(wrapper.text()).toContain('All already in your list')
      expect(wrapper.text()).not.toContain('new to your list')
    })
  })

  describe('empty state', () => {
    it('should show brief empty message when search ran but no permits in radius', () => {
      vi.mocked(useNearbyPermits).mockReturnValue(
        createMockComposable({
          permits: ref([]),
          position: ref({
            coords: { latitude: 51.0447, longitude: -114.0719 },
          } as GeolocationPosition),
        }) as any,
      )

      const wrapper = mount(FindNearbyPermits)
      expect(wrapper.text()).toMatch(/No permits|radius|Try increasing/)
    })

    it('should not show empty message before position is available', () => {
      vi.mocked(useNearbyPermits).mockReturnValue(
        createMockComposable({
          permits: ref([]),
          position: ref(null),
        }) as any,
      )

      const wrapper = mount(FindNearbyPermits)
      expect(wrapper.text()).not.toContain('permits found')
    })
  })

  describe('accessibility', () => {
    it('should have proper labels for form elements', () => {
      vi.mocked(useNearbyPermits).mockReturnValue(createMockComposable() as any)

      const wrapper = mount(FindNearbyPermits)

      const label = wrapper.find('label[for="radius-select"]')
      expect(label.exists()).toBe(true)
      expect(label.classes()).toContain('sr-only')
      expect(label.text()).toBe('Search radius')
    })

    it('should have proper button type', () => {
      vi.mocked(useNearbyPermits).mockReturnValue(createMockComposable() as any)

      const wrapper = mount(FindNearbyPermits)

      const button = wrapper.find('button')
      expect(button.attributes('type')).toBe('button')
    })
  })
})
