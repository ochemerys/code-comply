import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { db } from '@/lib/db'
import type { PermitListDTO } from '@codecomply/validators'
import type { LocalPermit } from '@/lib/db/types'
import { cachePermitsForSearch } from '@/lib/db/permit-cache'

export { cachePermitsForSearch }

/** Default config from M4-S9 technical_details */
const DEFAULT_DEBOUNCE_MS = 300
const DEFAULT_MIN_CHARS = 2
const DEFAULT_MAX_RESULTS = 20

export interface UsePermitSearchOptions {
  debounceMs?: number
  minChars?: number
  maxResults?: number
}

export interface UsePermitSearchReturn {
  /** Current search query (v-model) */
  searchQuery: Ref<string>
  /** Search results (PermitListDTO shape for UI) */
  results: Ref<PermitListDTO[]>
  /** True while searching IndexedDB */
  isSearching: Ref<boolean>
  /** Whether the search query meets min length to run */
  canSearch: ComputedRef<boolean>
  /** Clear search query and results */
  clearSearch: () => void
}

/**
 * Local permit search composable (M4-S9).
 * Searches cached permits in IndexedDB by permit number and address (partial match).
 * Works offline. Debounced; results update as user types.
 */
export function usePermitSearch(options: UsePermitSearchOptions = {}): UsePermitSearchReturn {
  const {
    debounceMs = DEFAULT_DEBOUNCE_MS,
    minChars = DEFAULT_MIN_CHARS,
    maxResults = DEFAULT_MAX_RESULTS,
  } = options

  const searchQuery = ref('')
  const results = ref<PermitListDTO[]>([])
  const isSearching = ref(false)

  const canSearch = computed(() => searchQuery.value.trim().length >= minChars)

  function localPermitToDto(p: LocalPermit): PermitListDTO {
    const dto: PermitListDTO = {
      id: p.id,
      permitNumber: p.permitNumber,
      address: p.address,
      status: p.status,
      nextInspectionDate: p.nextInspectionDate,
      distance: p.distance,
    }
    if (p.isOrphan === true) dto.isOrphan = true
    return dto
  }

  async function runSearch(): Promise<void> {
    const q = searchQuery.value.trim()
    if (q.length < minChars) {
      results.value = []
      return
    }

    isSearching.value = true
    try {
      const all = await db.permits.toArray()
      const lower = q.toLowerCase()
      const filtered = all.filter(
        (p) =>
          p.permitNumber.toLowerCase().includes(lower) || p.address.toLowerCase().includes(lower),
      )
      const limited = filtered.slice(0, maxResults)
      results.value = limited.map(localPermitToDto)
    } finally {
      isSearching.value = false
    }
  }

  const debouncedSearch = useDebounceFn(runSearch, debounceMs, { maxWait: debounceMs * 2 })

  watch(searchQuery, (newValue) => {
    const trimmed = newValue.trim()

    // Clear results and skip search if below minimum length
    if (trimmed.length < minChars) {
      results.value = []
      // Don't trigger search at all
      return
    }

    // Only trigger debounced search if we have enough characters
    debouncedSearch()
  })

  function clearSearch(): void {
    searchQuery.value = ''
    results.value = []
  }

  return {
    searchQuery,
    results,
    isSearching,
    canSearch,
    clearSearch,
  }
}
