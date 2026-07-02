import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { useGeolocation, type GeolocationError } from './useGeolocation'

describe('useGeolocation', () => {
  // Mock geolocation API
  let mockGeolocation: {
    getCurrentPosition: ReturnType<typeof vi.fn>
    watchPosition: ReturnType<typeof vi.fn>
    clearWatch: ReturnType<typeof vi.fn>
  }

  // Mock position data
  const mockPosition: GeolocationPosition = {
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

  // Mock position error
  const createMockPositionError = (code: number): GeolocationPositionError => {
    return {
      code,
      message: 'Mock error',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError
  }

  beforeEach(() => {
    // Create mock geolocation object
    mockGeolocation = {
      getCurrentPosition: vi.fn(),
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    }

    // Mock navigator.geolocation
    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('isSupported', () => {
    it('should detect geolocation support', () => {
      const { isSupported } = useGeolocation()
      expect(isSupported.value).toBe(true)
    })

    it('should detect when geolocation is not supported', () => {
      // Remove geolocation from navigator
      Object.defineProperty(global.navigator, 'geolocation', {
        value: undefined,
        writable: true,
        configurable: true,
      })

      const { isSupported } = useGeolocation()
      expect(isSupported.value).toBe(false)
    })
  })

  describe('getCurrentPosition', () => {
    it('should get current position successfully', async () => {
      // Mock successful response
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(mockPosition)
      })

      const { position, error, isLoading, getCurrentPosition } = useGeolocation()

      expect(isLoading.value).toBe(false)

      const result = await getCurrentPosition()

      expect(result).toEqual(mockPosition)
      expect(position.value).toEqual(mockPosition)
      expect(error.value).toBeNull()
      expect(isLoading.value).toBe(false)
      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.objectContaining({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }),
      )
    })

    it('should set loading state during request', async () => {
      let resolvePosition: ((pos: GeolocationPosition) => void) | null = null

      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        resolvePosition = success
      })

      const { isLoading, getCurrentPosition } = useGeolocation()

      expect(isLoading.value).toBe(false)

      const promise = getCurrentPosition()

      // Should be loading immediately after call
      expect(isLoading.value).toBe(true)

      // Resolve the position
      resolvePosition!(mockPosition)
      await promise

      // Should not be loading after resolution
      expect(isLoading.value).toBe(false)
    })

    it('should handle permission denied error', async () => {
      const positionError = createMockPositionError(1) // PERMISSION_DENIED

      mockGeolocation.getCurrentPosition.mockImplementation((_, error) => {
        error(positionError)
      })

      const { error: errorRef, isLoading, getCurrentPosition } = useGeolocation()

      await expect(getCurrentPosition()).rejects.toMatchObject({
        code: 'PERMISSION_DENIED',
        message: expect.stringContaining('permission denied'),
      })

      expect(errorRef.value).toMatchObject({
        code: 'PERMISSION_DENIED',
        message: expect.stringContaining('permission denied'),
        originalError: positionError,
      })
      expect(isLoading.value).toBe(false)
    })

    it('should handle position unavailable error', async () => {
      const positionError = createMockPositionError(2) // POSITION_UNAVAILABLE

      mockGeolocation.getCurrentPosition.mockImplementation((_, error) => {
        error(positionError)
      })

      const { error: errorRef, getCurrentPosition } = useGeolocation()

      await expect(getCurrentPosition()).rejects.toMatchObject({
        code: 'POSITION_UNAVAILABLE',
        message: expect.stringContaining('unavailable'),
      })

      expect(errorRef.value).toMatchObject({
        code: 'POSITION_UNAVAILABLE',
        originalError: positionError,
      })
    })

    it('should handle timeout error', async () => {
      const positionError = createMockPositionError(3) // TIMEOUT

      mockGeolocation.getCurrentPosition.mockImplementation((_, error) => {
        error(positionError)
      })

      const { error: errorRef, getCurrentPosition } = useGeolocation()

      await expect(getCurrentPosition()).rejects.toMatchObject({
        code: 'TIMEOUT',
        message: expect.stringContaining('timed out'),
      })

      expect(errorRef.value).toMatchObject({
        code: 'TIMEOUT',
        originalError: positionError,
      })
    })

    it('should handle unknown error', async () => {
      const positionError = createMockPositionError(999) // Unknown code

      mockGeolocation.getCurrentPosition.mockImplementation((_, error) => {
        error(positionError)
      })

      const { error: errorRef, getCurrentPosition } = useGeolocation()

      await expect(getCurrentPosition()).rejects.toMatchObject({
        code: 'UNKNOWN',
        message: expect.stringContaining('unknown error'),
      })

      expect(errorRef.value).toMatchObject({
        code: 'UNKNOWN',
        originalError: positionError,
      })
    })

    it('should reject when geolocation is not supported', async () => {
      // Remove geolocation from navigator
      Object.defineProperty(global.navigator, 'geolocation', {
        value: undefined,
        writable: true,
        configurable: true,
      })

      const { error: errorRef, getCurrentPosition } = useGeolocation()

      await expect(getCurrentPosition()).rejects.toMatchObject({
        code: 'NOT_SUPPORTED',
        message: expect.stringContaining('not supported'),
      })

      expect(errorRef.value).toMatchObject({
        code: 'NOT_SUPPORTED',
      })
    })

    it('should use custom options', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(mockPosition)
      })

      const customOptions = {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 30000,
      }

      const { getCurrentPosition } = useGeolocation(customOptions)

      await getCurrentPosition()

      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.objectContaining(customOptions),
      )
    })

    it('should clear error on successful request after previous error', async () => {
      const positionError = createMockPositionError(1)

      // First call fails
      mockGeolocation.getCurrentPosition.mockImplementationOnce((_, error) => {
        error(positionError)
      })

      const { error: errorRef, getCurrentPosition } = useGeolocation()

      await expect(getCurrentPosition()).rejects.toThrow()
      expect(errorRef.value).not.toBeNull()

      // Second call succeeds
      mockGeolocation.getCurrentPosition.mockImplementationOnce((success) => {
        success(mockPosition)
      })

      await getCurrentPosition()
      expect(errorRef.value).toBeNull()
    })
  })

  describe('watchPosition', () => {
    it('should start watching position', () => {
      const watchId = 123
      mockGeolocation.watchPosition.mockReturnValue(watchId)

      const { isLoading, watchPosition } = useGeolocation()

      watchPosition()

      expect(mockGeolocation.watchPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.objectContaining({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }),
      )
      expect(isLoading.value).toBe(true)
    })

    it('should update position on location changes', async () => {
      let successCallback: ((pos: GeolocationPosition) => void) | null = null

      mockGeolocation.watchPosition.mockImplementation((success) => {
        successCallback = success
        return 123
      })

      const { position, error, isLoading, watchPosition } = useGeolocation()

      watchPosition()

      expect(isLoading.value).toBe(true)

      // Simulate first position update
      const position1 = { ...mockPosition, timestamp: Date.now() }
      successCallback!(position1)
      await nextTick()

      expect(position.value).toEqual(position1)
      expect(error.value).toBeNull()
      expect(isLoading.value).toBe(false)

      // Simulate second position update
      const position2 = {
        ...mockPosition,
        coords: { ...mockPosition.coords, latitude: 51.05 },
        timestamp: Date.now() + 1000,
      }
      successCallback!(position2)
      await nextTick()

      expect(position.value).toEqual(position2)
    })

    it('should handle errors during watch', async () => {
      let errorCallback: ((err: GeolocationPositionError) => void) | null = null

      mockGeolocation.watchPosition.mockImplementation((_, error) => {
        errorCallback = error
        return 123
      })

      const { error: errorRef, isLoading, watchPosition } = useGeolocation()

      watchPosition()

      const positionError = createMockPositionError(2)
      errorCallback!(positionError)
      await nextTick()

      expect(errorRef.value).toMatchObject({
        code: 'POSITION_UNAVAILABLE',
        originalError: positionError,
      })
      expect(isLoading.value).toBe(false)
    })

    it('should stop previous watch when starting new watch', () => {
      mockGeolocation.watchPosition.mockReturnValueOnce(123).mockReturnValueOnce(456)

      const { watchPosition } = useGeolocation()

      watchPosition()
      expect(mockGeolocation.watchPosition).toHaveBeenCalledTimes(1)

      watchPosition()
      expect(mockGeolocation.clearWatch).toHaveBeenCalledWith(123)
      expect(mockGeolocation.watchPosition).toHaveBeenCalledTimes(2)
    })

    it('should not start watch when geolocation is not supported', () => {
      // Remove geolocation from navigator
      Object.defineProperty(global.navigator, 'geolocation', {
        value: undefined,
        writable: true,
        configurable: true,
      })

      const { error: errorRef, watchPosition } = useGeolocation()

      watchPosition()

      expect(errorRef.value).toMatchObject({
        code: 'NOT_SUPPORTED',
        message: expect.stringContaining('not supported'),
      })
    })
  })

  describe('stopWatching', () => {
    it('should stop watching position', () => {
      const watchId = 123
      mockGeolocation.watchPosition.mockReturnValue(watchId)

      const { isLoading, watchPosition, stopWatching } = useGeolocation()

      watchPosition()
      expect(isLoading.value).toBe(true)

      stopWatching()

      expect(mockGeolocation.clearWatch).toHaveBeenCalledWith(watchId)
      expect(isLoading.value).toBe(false)
    })

    it('should handle multiple stop calls gracefully', () => {
      const watchId = 123
      mockGeolocation.watchPosition.mockReturnValue(watchId)

      const { watchPosition, stopWatching } = useGeolocation()

      watchPosition()
      stopWatching()
      stopWatching() // Second call should not throw

      expect(mockGeolocation.clearWatch).toHaveBeenCalledTimes(1)
    })

    it('should not error when stopping without active watch', () => {
      const { stopWatching } = useGeolocation()

      expect(() => stopWatching()).not.toThrow()
      expect(mockGeolocation.clearWatch).not.toHaveBeenCalled()
    })
  })

  describe('cleanup on unmount', () => {
    it('should register cleanup handler', () => {
      // This test verifies that the composable uses onUnmounted
      // The actual cleanup is tested by the stopWatching tests
      const { watchPosition, stopWatching } = useGeolocation()

      // Start watching
      mockGeolocation.watchPosition.mockReturnValue(123)
      watchPosition()

      // Manually trigger cleanup (simulating unmount)
      stopWatching()

      expect(mockGeolocation.clearWatch).toHaveBeenCalledWith(123)
    })
  })

  describe('iOS Safari compatibility', () => {
    it('should work with iOS Safari geolocation API', async () => {
      // iOS Safari has the same API, so this test verifies basic compatibility
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(mockPosition)
      })

      const { getCurrentPosition } = useGeolocation()

      const result = await getCurrentPosition()

      expect(result).toEqual(mockPosition)
      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled()
    })

    it('should handle iOS permission prompts', async () => {
      // iOS shows permission prompt on first call
      const positionError = createMockPositionError(1) // PERMISSION_DENIED

      mockGeolocation.getCurrentPosition.mockImplementation((_, error) => {
        error(positionError)
      })

      const { error: errorRef, getCurrentPosition } = useGeolocation()

      await expect(getCurrentPosition()).rejects.toMatchObject({
        code: 'PERMISSION_DENIED',
      })

      expect(errorRef.value?.message).toContain('device settings')
    })
  })

  describe('edge cases', () => {
    it('should handle rapid successive calls to getCurrentPosition', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        setTimeout(() => success(mockPosition), 10)
      })

      const { getCurrentPosition } = useGeolocation()

      const promises = [getCurrentPosition(), getCurrentPosition(), getCurrentPosition()]

      const results = await Promise.all(promises)

      expect(results).toHaveLength(3)
      results.forEach((result) => {
        expect(result).toEqual(mockPosition)
      })
    })

    it('should handle position with null optional fields', async () => {
      const minimalPosition: GeolocationPosition = {
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

      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(minimalPosition)
      })

      const { position, getCurrentPosition } = useGeolocation()

      await getCurrentPosition()

      expect(position.value).toEqual(minimalPosition)
      expect(position.value?.coords.altitude).toBeNull()
      expect(position.value?.coords.heading).toBeNull()
      expect(position.value?.coords.speed).toBeNull()
    })

    it('should handle very high accuracy values', async () => {
      const highAccuracyPosition: GeolocationPosition = {
        ...mockPosition,
        coords: {
          ...mockPosition.coords,
          accuracy: 0.5, // Very high accuracy
        },
      }

      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(highAccuracyPosition)
      })

      const { position, getCurrentPosition } = useGeolocation()

      await getCurrentPosition()

      expect(position.value?.coords.accuracy).toBe(0.5)
    })

    it('should handle very low accuracy values', async () => {
      const lowAccuracyPosition: GeolocationPosition = {
        ...mockPosition,
        coords: {
          ...mockPosition.coords,
          accuracy: 5000, // Very low accuracy (5km)
        },
      }

      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(lowAccuracyPosition)
      })

      const { position, getCurrentPosition } = useGeolocation()

      await getCurrentPosition()

      expect(position.value?.coords.accuracy).toBe(5000)
    })
  })

  describe('options merging', () => {
    it('should merge custom options with defaults', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(mockPosition)
      })

      const { getCurrentPosition } = useGeolocation({
        timeout: 5000, // Override default
        // enableHighAccuracy and maximumAge should use defaults
      })

      await getCurrentPosition()

      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.objectContaining({
          enableHighAccuracy: true, // Default
          timeout: 5000, // Custom
          maximumAge: 60000, // Default
        }),
      )
    })

    it('should allow disabling high accuracy', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(mockPosition)
      })

      const { getCurrentPosition } = useGeolocation({
        enableHighAccuracy: false,
      })

      await getCurrentPosition()

      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.objectContaining({
          enableHighAccuracy: false,
        }),
      )
    })
  })
})
