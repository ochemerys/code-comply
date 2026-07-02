import { ref, computed, onUnmounted, type Ref, type ComputedRef } from 'vue'

/**
 * Geolocation Error Types
 */
export type GeolocationErrorType =
  | 'PERMISSION_DENIED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'NOT_SUPPORTED'
  | 'UNKNOWN'

/**
 * Custom Geolocation Error
 */
export interface GeolocationError {
  code: GeolocationErrorType
  message: string
  originalError?: GeolocationPositionError
}

/**
 * Geolocation Options
 */
export interface GeolocationOptions {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
}

/**
 * Geolocation Composable Return Type
 */
export interface UseGeolocationReturn {
  position: Ref<GeolocationPosition | null>
  error: Ref<GeolocationError | null>
  isLoading: Ref<boolean>
  isSupported: ComputedRef<boolean>
  getCurrentPosition: () => Promise<GeolocationPosition>
  watchPosition: () => void
  stopWatching: () => void
}

/**
 * Default geolocation options optimized for outdoor field use
 */
const DEFAULT_OPTIONS: GeolocationOptions = {
  enableHighAccuracy: true,
  timeout: 10000, // 10 seconds
  maximumAge: 60000, // 1 minute
}

/**
 * Web Geolocation API Wrapper Composable
 *
 * Provides a reactive interface to the browser's Geolocation API with:
 * - Error handling and permission management
 * - Support for both single position requests and continuous tracking
 * - iOS Safari compatibility
 * - Proper cleanup on component unmount
 *
 * @param options - Geolocation options (optional)
 * @returns Reactive geolocation state and methods
 *
 * @example
 * ```typescript
 * const { position, error, isLoading, getCurrentPosition, watchPosition, stopWatching } = useGeolocation()
 *
 * // Get current position once
 * try {
 *   const pos = await getCurrentPosition()
 *   console.log('Latitude:', pos.coords.latitude)
 * } catch (err) {
 *   console.error('Failed to get position:', err)
 * }
 *
 * // Watch position changes
 * watchPosition()
 * // Later...
 * stopWatching()
 * ```
 */
export function useGeolocation(options: GeolocationOptions = {}): UseGeolocationReturn {
  // Merge provided options with defaults
  const geoOptions: PositionOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  }

  // Reactive state
  const position = ref<GeolocationPosition | null>(null)
  const error = ref<GeolocationError | null>(null)
  const isLoading = ref(false)

  // Watch ID for continuous tracking
  let watchId: number | null = null

  /**
   * Check if Geolocation API is supported
   */
  const isSupported = computed(() => {
    return (
      'geolocation' in navigator &&
      navigator.geolocation !== undefined &&
      'getCurrentPosition' in navigator.geolocation
    )
  })

  /**
   * Convert GeolocationPositionError to custom error format
   */
  const createError = (positionError: GeolocationPositionError): GeolocationError => {
    let code: GeolocationErrorType
    let message: string

    switch (positionError.code) {
      case positionError.PERMISSION_DENIED:
        code = 'PERMISSION_DENIED'
        message =
          'Location permission denied. Please enable location access in your device settings.'
        break
      case positionError.POSITION_UNAVAILABLE:
        code = 'POSITION_UNAVAILABLE'
        message = 'Location information is unavailable. Please check your device settings.'
        break
      case positionError.TIMEOUT:
        code = 'TIMEOUT'
        message = 'Location request timed out. Please try again.'
        break
      default:
        code = 'UNKNOWN'
        message = 'An unknown error occurred while getting location.'
    }

    return {
      code,
      message,
      originalError: positionError,
    }
  }

  /**
   * Success callback for geolocation requests
   */
  const onSuccess = (pos: GeolocationPosition) => {
    position.value = pos
    error.value = null
    isLoading.value = false
  }

  /**
   * Error callback for geolocation requests
   */
  const onError = (positionError: GeolocationPositionError) => {
    error.value = createError(positionError)
    isLoading.value = false
  }

  /**
   * Get current position (single request)
   *
   * @returns Promise that resolves with GeolocationPosition
   * @throws GeolocationError if request fails
   */
  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      // Check if geolocation is supported
      if (!isSupported.value) {
        const notSupportedError: GeolocationError = {
          code: 'NOT_SUPPORTED',
          message: 'Geolocation is not supported by this browser.',
        }
        error.value = notSupportedError
        reject(notSupportedError)
        return
      }

      // Set loading state
      isLoading.value = true
      error.value = null

      // Request current position
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          onSuccess(pos)
          resolve(pos)
        },
        (positionError) => {
          const geoError = createError(positionError)
          error.value = geoError
          isLoading.value = false
          reject(geoError)
        },
        geoOptions,
      )
    })
  }

  /**
   * Start watching position changes (continuous tracking)
   *
   * Updates the `position` ref whenever the device location changes.
   * Call `stopWatching()` to stop tracking.
   */
  const watchPosition = () => {
    // Check if geolocation is supported
    if (!isSupported.value) {
      error.value = {
        code: 'NOT_SUPPORTED',
        message: 'Geolocation is not supported by this browser.',
      }
      return
    }

    // Stop any existing watch
    if (watchId !== null) {
      stopWatching()
    }

    // Set loading state
    isLoading.value = true
    error.value = null

    // Start watching position
    watchId = navigator.geolocation.watchPosition(onSuccess, onError, geoOptions)
  }

  /**
   * Stop watching position changes
   *
   * Clears the active watch and resets loading state.
   */
  const stopWatching = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId)
      watchId = null
      isLoading.value = false
    }
  }

  /**
   * Cleanup on component unmount
   */
  onUnmounted(() => {
    stopWatching()
  })

  return {
    position,
    error,
    isLoading,
    isSupported,
    getCurrentPosition,
    watchPosition,
    stopWatching,
  }
}
