import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useNearbyPermits } from './useNearbyPermits'
import { useGeolocation } from './useGeolocation'
import { flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../stores/auth'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { createApp } from 'vue'

// Mock dependencies
vi.mock('./useGeolocation')
vi.mock('./usePermitSearch', () => ({
  cachePermitsForSearch: vi.fn().mockResolvedValue(0),
}))
vi.mock('../stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    accessToken: 'test-access-token',
    user: { id: 'u1', email: 'test@example.com', name: 'Test User', role: 'SCO' },
    get isAuthenticated() {
      return !!(this as any).user && !!(this as any).accessToken
    },
  })),
}))

// Helper to run composable in proper Vue context (auth store is mocked as authenticated)
function withSetup<T>(composable: () => T): T {
  let result: T
  const app = createApp({
    setup() {
      result = composable()
      return () => {}
    },
  })
  app.use(createPinia())
  app.use(VueQueryPlugin)
  app.mount(document.createElement('div'))
  return result!
}

describe('useNearbyPermits', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())

    // Default mock for useGeolocation
    vi.mocked(useGeolocation).mockReturnValue({
      position: { value: null } as any,
      error: { value: null } as any,
      isLoading: { value: false } as any,
      isSupported: { value: true } as any,
      getCurrentPosition: vi.fn(),
      watchPosition: vi.fn(),
      stopWatching: vi.fn(),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with default options', () => {
      const { radius, permits, isLoading, error } = withSetup(() => useNearbyPermits())

      expect(radius.value).toBe(5000) // Default 5km
      expect(permits.value).toEqual([])
      expect(isLoading.value).toBe(false)
      expect(error.value).toBeNull()
    })

    it('should initialize with custom radius', () => {
      const { radius } = withSetup(() => useNearbyPermits({ radius: 10000 }))

      expect(radius.value).toBe(10000)
    })

    it('should not auto-fetch by default', () => {
      const getCurrentPosition = vi.fn()
      vi.mocked(useGeolocation).mockReturnValue({
        position: { value: null } as any,
        error: { value: null } as any,
        isLoading: { value: false } as any,
        isSupported: { value: true } as any,
        getCurrentPosition,
        watchPosition: vi.fn(),
        stopWatching: vi.fn(),
      })

      withSetup(() => useNearbyPermits())

      expect(getCurrentPosition).not.toHaveBeenCalled()
    })
  })

  describe('GPS support', () => {
    it('should reflect GPS support status', () => {
      vi.mocked(useGeolocation).mockReturnValue({
        position: { value: null } as any,
        error: { value: null } as any,
        isLoading: { value: false } as any,
        isSupported: { value: false } as any,
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn(),
        stopWatching: vi.fn(),
      })

      const { isGpsSupported } = withSetup(() => useNearbyPermits())

      expect(isGpsSupported.value).toBe(false)
    })
  })

  describe('fetchNearbyPermits', () => {
    it('should get GPS position and fetch permits', async () => {
      const mockPosition = {
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

      const mockPermits = [
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
          status: 'ACTIVE',
          distance: 1200,
        },
      ]

      const positionRef = ref<GeolocationPosition | null>(null)
      const getCurrentPosition = vi.fn().mockImplementation(async () => {
        positionRef.value = mockPosition as GeolocationPosition
        return mockPosition as GeolocationPosition
      })

      vi.mocked(useGeolocation).mockReturnValue({
        position: positionRef,
        error: { value: null } as any,
        isLoading: { value: false } as any,
        isSupported: { value: true } as any,
        getCurrentPosition,
        watchPosition: vi.fn(),
        stopWatching: vi.fn(),
      })

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockPermits),
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
      } as any)

      const { fetchNearbyPermits, permits, position } = withSetup(() => useNearbyPermits())

      await fetchNearbyPermits()
      await nextTick()
      await flushPromises()
      await flushPromises()
      await nextTick()

      expect(getCurrentPosition).toHaveBeenCalled()
      expect(position.value).toEqual(mockPosition)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/permits/nearby'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-access-token',
          }),
        }),
      )

      // Wait for TanStack Query to update
      await new Promise((resolve) => setTimeout(resolve, 200))
      await nextTick()

      expect(permits.value).toEqual(mockPermits)
    })

    it('should include Authorization header with JWT token', async () => {
      const mockPosition = {
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

      const positionRef = ref<GeolocationPosition | null>(null)
      const getCurrentPosition = vi.fn().mockImplementation(async () => {
        positionRef.value = mockPosition as GeolocationPosition
        return mockPosition as GeolocationPosition
      })

      vi.mocked(useGeolocation).mockReturnValue({
        position: positionRef,
        error: { value: null } as any,
        isLoading: { value: false } as any,
        isSupported: { value: true } as any,
        getCurrentPosition,
        watchPosition: vi.fn(),
        stopWatching: vi.fn(),
      })

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      } as any)

      vi.mocked(useAuthStore).mockReturnValue({
        accessToken: 'my-jwt-token',
        user: { id: 'u1', email: 'u@e.com', name: 'User', role: 'SCO' },
        get isAuthenticated() {
          return true
        },
      } as any)

      const { fetchNearbyPermits } = withSetup(() => useNearbyPermits())

      await fetchNearbyPermits()
      await nextTick()
      await flushPromises()
      await flushPromises()

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/permits/nearby'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer my-jwt-token',
            'Content-Type': 'application/json',
          }),
        }),
      )
    })

    it('should handle GPS errors', async () => {
      const gpsError = {
        code: 'PERMISSION_DENIED',
        message: 'Location permission denied',
      }

      const getCurrentPosition = vi.fn().mockRejectedValue(gpsError)

      vi.mocked(useGeolocation).mockReturnValue({
        position: { value: null } as any,
        error: { value: gpsError } as any,
        isLoading: { value: false } as any,
        isSupported: { value: true } as any,
        getCurrentPosition,
        watchPosition: vi.fn(),
        stopWatching: vi.fn(),
      })

      const { fetchNearbyPermits, error } = withSetup(() => useNearbyPermits())

      await expect(fetchNearbyPermits()).rejects.toThrow()
      expect(error.value?.message).toBe('Location permission denied')
    })

    it('should handle API errors', async () => {
      const mockPosition = {
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

      const positionRef = ref<GeolocationPosition | null>(null)
      const getCurrentPosition = vi.fn().mockImplementation(async () => {
        positionRef.value = mockPosition as GeolocationPosition
        return mockPosition as GeolocationPosition
      })

      vi.mocked(useGeolocation).mockReturnValue({
        position: positionRef,
        error: { value: null } as any,
        isLoading: { value: false } as any,
        isSupported: { value: true } as any,
        getCurrentPosition,
        watchPosition: vi.fn(),
        stopWatching: vi.fn(),
      })

      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
      } as any)

      const { fetchNearbyPermits, error } = withSetup(() => useNearbyPermits())

      await fetchNearbyPermits()
      await nextTick()
      await flushPromises()

      expect(fetch).toHaveBeenCalled()
      expect(error.value?.message).toContain('500')
    })
  })

  describe('radius changes', () => {
    it('should refetch when radius changes', async () => {
      const mockPosition = {
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

      const positionRef = ref<GeolocationPosition | null>(null)
      const getCurrentPosition = vi.fn().mockImplementation(async () => {
        positionRef.value = mockPosition as GeolocationPosition
        return mockPosition as GeolocationPosition
      })

      vi.mocked(useGeolocation).mockReturnValue({
        position: positionRef,
        error: { value: null } as any,
        isLoading: { value: false } as any,
        isSupported: { value: true } as any,
        getCurrentPosition,
        watchPosition: vi.fn(),
        stopWatching: vi.fn(),
      })

      const mockPermits = [
        {
          id: 'permit-1',
          permitNumber: 'P-2024-001',
          address: '123 Main St',
          status: 'ACTIVE',
          distance: 500,
        },
      ]

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockPermits),
      } as any)

      const { radius, refetch, fetchNearbyPermits } = withSetup(() => useNearbyPermits())

      await fetchNearbyPermits()
      await nextTick()
      await flushPromises()
      await new Promise((resolve) => setTimeout(resolve, 100))

      vi.clearAllMocks()
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockPermits),
      } as any)

      radius.value = 10000
      await refetch()
      await nextTick()
      await flushPromises()
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('radius=10000'),
        expect.objectContaining({
          method: 'GET',
        }),
      )
    }, 10000)

    it('should throw error when refetching without position', async () => {
      vi.mocked(useGeolocation).mockReturnValue({
        position: { value: null } as any,
        error: { value: null } as any,
        isLoading: { value: false } as any,
        isSupported: { value: true } as any,
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn(),
        stopWatching: vi.fn(),
      })

      const { refetch } = withSetup(() => useNearbyPermits())

      await expect(refetch()).rejects.toThrow(
        'No GPS position available. Call fetchNearbyPermits() first.',
      )
    })
  })

  describe('loading states', () => {
    it('should show loading during GPS request', () => {
      vi.mocked(useGeolocation).mockReturnValue({
        position: { value: null } as any,
        error: { value: null } as any,
        isLoading: { value: true } as any,
        isSupported: { value: true } as any,
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn(),
        stopWatching: vi.fn(),
      })

      const { isLoading, isGettingLocation } = withSetup(() => useNearbyPermits())

      expect(isGettingLocation.value).toBe(true)
      expect(isLoading.value).toBe(true)
    })
  })

  describe('status filtering', () => {
    it('should include status filter in API request', async () => {
      const mockPosition = {
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

      const positionRef = ref<GeolocationPosition | null>(null)
      const getCurrentPosition = vi.fn().mockImplementation(async () => {
        positionRef.value = mockPosition as GeolocationPosition
        return mockPosition as GeolocationPosition
      })

      vi.mocked(useGeolocation).mockReturnValue({
        position: positionRef,
        error: { value: null } as any,
        isLoading: { value: false } as any,
        isSupported: { value: true } as any,
        getCurrentPosition,
        watchPosition: vi.fn(),
        stopWatching: vi.fn(),
      })

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      } as any)

      const { fetchNearbyPermits } = withSetup(() => useNearbyPermits({ status: 'ACTIVE' }))

      await fetchNearbyPermits()
      await nextTick()
      await flushPromises()
      await flushPromises()

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('status=ACTIVE'),
        expect.objectContaining({
          method: 'GET',
        }),
      )
    })
  })

  describe('limit parameter', () => {
    it('should respect custom limit', async () => {
      const mockPosition = {
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

      const positionRef = ref<GeolocationPosition | null>(null)
      const getCurrentPosition = vi.fn().mockImplementation(async () => {
        positionRef.value = mockPosition as GeolocationPosition
        return mockPosition as GeolocationPosition
      })

      vi.mocked(useGeolocation).mockReturnValue({
        position: positionRef,
        error: { value: null } as any,
        isLoading: { value: false } as any,
        isSupported: { value: true } as any,
        getCurrentPosition,
        watchPosition: vi.fn(),
        stopWatching: vi.fn(),
      })

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      } as any)

      const { fetchNearbyPermits } = withSetup(() => useNearbyPermits({ limit: 10 }))

      await fetchNearbyPermits()
      await nextTick()
      await flushPromises()
      await flushPromises()

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.objectContaining({
          method: 'GET',
        }),
      )
    })
  })
})
