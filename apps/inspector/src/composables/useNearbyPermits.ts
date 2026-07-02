import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useGeolocation } from './useGeolocation'
import { useAuthStore } from '../stores/auth'
import { handleApiError } from '../utils/api-error-handler'
import { cachePermitsForSearch } from './usePermitSearch'
import { getApiBaseUrl } from '@/lib/api-base'
import type { PermitListDTO } from '@codecomply/validators'

/**
 * Nearby Permits Options
 */
export interface NearbyPermitsOptions {
  /** Radius in meters (default: 5000 = 5km) */
  radius?: number
  /** Filter by permit status */
  status?: 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED'
  /** Maximum number of results */
  limit?: number
  /** Enable automatic fetching when position is available */
  autoFetch?: boolean
  /** Called after GPS fix, before the nearby API request starts */
  onSearchPhaseStart?: () => void
}

/**
 * Nearby Permits Composable Return Type
 */
export interface UseNearbyPermitsReturn {
  /** Nearby permits sorted by distance */
  permits: ComputedRef<PermitListDTO[]>
  /** Loading state for permits fetch */
  isLoading: Ref<boolean>
  /** Error from permits fetch */
  error: Ref<Error | null>
  /** Current GPS position */
  position: Ref<GeolocationPosition | null>
  /** GPS error */
  gpsError: Ref<any>
  /** GPS loading state */
  isGettingLocation: Ref<boolean>
  /** Whether GPS is supported */
  isGpsSupported: ComputedRef<boolean>
  /** Current search radius in meters */
  radius: Ref<number>
  /** Fetch nearby permits using current location */
  fetchNearbyPermits: () => Promise<void>
  /** Refetch permits with current parameters */
  refetch: () => Promise<void>
  /** When last response was empty: number of permits in DB that have GPS coordinates (for empty-state messaging) */
  totalWithCoordinates: Ref<number | undefined>
  /** Number of permits newly added to cache on last fetch (0 if all were already in list) */
  lastNewlyCachedCount: Ref<number>
}

/**
 * Default options
 */
const DEFAULT_OPTIONS: Required<Omit<NearbyPermitsOptions, 'onSearchPhaseStart'>> & {
  onSearchPhaseStart?: () => void
} = {
  radius: 5000, // 5km
  status: undefined as any,
  limit: 20,
  autoFetch: false,
}

/**
 * Nearby Permits Composable
 *
 * Provides GPS-based permit discovery with configurable radius.
 * Integrates with the Geolocation API and backend permit search.
 *
 * Features:
 * - GPS location request with error handling
 * - Configurable search radius
 * - Status filtering
 * - Results sorted by distance
 * - Loading and error states
 * - Manual and automatic fetching
 *
 * @param options - Configuration options
 * @returns Reactive nearby permits state and methods
 *
 * @example
 * ```typescript
 * const {
 *   permits,
 *   isLoading,
 *   error,
 *   radius,
 *   fetchNearbyPermits
 * } = useNearbyPermits({ radius: 5000 })
 *
 * // Trigger search
 * await fetchNearbyPermits()
 *
 * // Change radius and refetch
 * radius.value = 10000
 * await refetch()
 * ```
 */
export function useNearbyPermits(options: NearbyPermitsOptions = {}): UseNearbyPermitsReturn {
  // Merge options with defaults
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Auth store for JWT token
  const authStore = useAuthStore()

  // Geolocation composable
  const {
    position,
    error: gpsError,
    isLoading: isGettingLocation,
    isSupported: isGpsSupported,
    getCurrentPosition,
  } = useGeolocation({
    enableHighAccuracy: true,
    timeout: 20000, // 20s – GPS can be slow indoors or on first fix
    maximumAge: 120000, // 2 min – use cached position when valid
  })

  // Search parameters
  const radius = ref(opts.radius)
  const status = ref(opts.status)
  const limit = ref(opts.limit)

  // Flag to enable/disable query
  const shouldFetch = ref(false)

  // Computed coordinates
  const latitude = computed(() => position.value?.coords.latitude)
  const longitude = computed(() => position.value?.coords.longitude)

  /**
   * TanStack Query for fetching nearby permits
   */
  const {
    data: permitsData,
    error: fetchError,
    isLoading: isFetching,
    refetch: refetchQuery,
  } = useQuery({
    queryKey: ['permits', 'nearby', latitude, longitude, radius, status, limit],
    queryFn: async () => {
      if (!latitude.value || !longitude.value) {
        throw new Error('GPS coordinates not available')
      }

      // Build query parameters
      const params = new URLSearchParams({
        latitude: latitude.value.toString(),
        longitude: longitude.value.toString(),
        radius: radius.value.toString(),
        limit: limit.value.toString(),
      })

      if (status.value) {
        params.append('status', status.value)
      }

      // Get API URL from environment
      const base = getApiBaseUrl()
      const prefix = base ? `${base}/api` : '/api'

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      if (authStore.accessToken) {
        headers['Authorization'] = `Bearer ${authStore.accessToken}`
      }

      // Fetch nearby permits
      let res: Response
      try {
        res = await fetch(`${prefix}/permits/nearby?${params.toString()}`, {
          method: 'GET',
          headers,
        })
      } catch (fetchErr) {
        if (!navigator.onLine) {
          throw new Error('Network connection unavailable. Check your connection and try again.')
        }
        throw fetchErr
      }

      // Handle 401 errors (will redirect to login)
      if (res.status === 401) {
        await handleApiError(res)
        throw new Error('Unauthorized - please log in')
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch nearby permits: ${res.status}`)
      }

      const list = await res.json()
      const totalHeader = res.headers.get('X-Permits-With-Coordinates')
      const totalWithCoordinates = totalHeader !== null ? parseInt(totalHeader, 10) : undefined
      return { list, totalWithCoordinates }
    },
    enabled: shouldFetch,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  })

  // Computed permits list (API returns { list, totalWithCoordinates } when we send the header)
  const permits = computed(() => {
    const d = permitsData.value
    if (!d) return []
    return Array.isArray(d) ? d : ((d as { list: PermitListDTO[] }).list ?? [])
  })

  /** When last response was empty, backend sends how many permits have coords (for empty-state messaging) */
  const totalWithCoordinates = computed(() => {
    const d = permitsData.value
    if (!d || Array.isArray(d)) return undefined
    return (d as { totalWithCoordinates?: number }).totalWithCoordinates
  })

  /** Number of permits that were newly added to cache on last fetch (0 = all already in list) */
  const lastNewlyCachedCount = ref(0)

  // Combined loading state
  const isLoading = computed(() => isGettingLocation.value || isFetching.value)

  // Combined error
  const error = computed(() => {
    if (gpsError.value) {
      return new Error(gpsError.value.message)
    }
    if (fetchError.value) {
      return fetchError.value as Error
    }
    return null
  })

  /**
   * Fetch nearby permits using current location
   *
   * 1. Checks authentication
   * 2. Gets current GPS position
   * 3. Enables query to fetch permits
   * 4. Returns when permits are loaded
   */
  const fetchNearbyPermits = async (): Promise<void> => {
    try {
      // Check if user is authenticated
      if (!authStore.isAuthenticated || !authStore.accessToken) {
        throw new Error('User is not authenticated. Please log in.')
      }

      if (!navigator.onLine) {
        throw new Error('Network connection unavailable. Check your connection and try again.')
      }

      // Get current position
      await getCurrentPosition()

      opts.onSearchPhaseStart?.()

      // Enable query
      shouldFetch.value = true

      // Trigger refetch
      await refetchQuery()

      // Cache to IndexedDB and record how many were newly added
      const d = permitsData.value
      const list = d && Array.isArray(d) ? d : ((d as { list?: PermitListDTO[] })?.list ?? [])
      lastNewlyCachedCount.value = await cachePermitsForSearch(list)
    } catch (err: any) {
      const msg = err?.message ?? String(err)
      console.error('[useNearbyPermits] Error fetching nearby permits:', msg)
      throw err
    }
  }

  /**
   * Refetch permits with current parameters
   */
  const refetch = async (): Promise<void> => {
    if (!position.value) {
      throw new Error('No GPS position available. Call fetchNearbyPermits() first.')
    }

    await refetchQuery()
  }

  // Auto-fetch on mount if enabled
  if (opts.autoFetch) {
    fetchNearbyPermits().catch((err) => {
      console.error('[useNearbyPermits] Auto-fetch failed:', err)
    })
  }

  return {
    permits,
    isLoading,
    error,
    position,
    gpsError,
    isGettingLocation,
    isGpsSupported,
    radius,
    fetchNearbyPermits,
    refetch,
    totalWithCoordinates,
    lastNewlyCachedCount,
  }
}
