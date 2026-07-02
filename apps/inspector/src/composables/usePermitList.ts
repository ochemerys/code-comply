import { ref, computed, onMounted, type Ref, type ComputedRef } from 'vue'
import { db } from '@/lib/db'
import type { PermitListDTO } from '@codecomply/validators'
import type { LocalPermit } from '@/lib/db/types'

/** Permit status filter (M4-S10) */
export type PermitStatusFilter = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'

/** Sort option (M4-S10 technical_details) */
export type PermitSortOption = 'date' | 'distance' | 'permitNumber'

export interface UsePermitListOptions {
  /** Initial status filter */
  statusFilter?: PermitStatusFilter
  /** Initial "has scheduled inspection" filter */
  hasScheduledInspectionOnly?: boolean
  /** Initial sort option */
  sortBy?: PermitSortOption
  /** Optional search query ref – when set (≥2 chars), list is filtered by permit number / address */
  searchQuery?: Ref<string>
}

export interface UsePermitListReturn {
  /** All permits from cache (before filter/sort) */
  allPermits: Ref<PermitListDTO[]>
  /** Filtered and sorted permits for display */
  permits: ComputedRef<PermitListDTO[]>
  /** Loading state */
  isLoading: Ref<boolean>
  /** Status filter (v-model) */
  statusFilter: Ref<PermitStatusFilter>
  /** Only show permits with nextInspectionDate set */
  hasScheduledInspectionOnly: Ref<boolean>
  /** Sort option (v-model) */
  sortBy: Ref<PermitSortOption>
  /** Refresh list from IndexedDB */
  refresh: () => Promise<void>
}

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

/**
 * Permit list composable (M4-S10).
 * Loads permits from IndexedDB cache, applies status and hasScheduledInspection filters,
 * and supports sorting by date, distance, or permit number.
 */
const SEARCH_MIN_CHARS = 2

export function usePermitList(options: UsePermitListOptions = {}): UsePermitListReturn {
  const {
    statusFilter: initialStatus = 'ALL',
    hasScheduledInspectionOnly: initialHasScheduled = false,
    sortBy: initialSort = 'permitNumber',
    searchQuery: searchQueryRef,
  } = options

  const allPermits = ref<PermitListDTO[]>([])
  const isLoading = ref(true)
  const statusFilter = ref<PermitStatusFilter>(initialStatus)
  const hasScheduledInspectionOnly = ref(initialHasScheduled)
  const sortBy = ref<PermitSortOption>(initialSort)

  async function loadPermits(): Promise<void> {
    isLoading.value = true
    try {
      const rows = await db.permits.toArray()
      allPermits.value = rows.map(localPermitToDto)
    } finally {
      isLoading.value = false
    }
  }

  const permits = computed(() => {
    let list = [...allPermits.value]

    // Filter by search query (permit number or address, case-insensitive)
    const q = searchQueryRef?.value?.trim()
    if (q && q.length >= SEARCH_MIN_CHARS) {
      const lower = q.toLowerCase()
      list = list.filter(
        (p) =>
          p.permitNumber.toLowerCase().includes(lower) || p.address.toLowerCase().includes(lower),
      )
    }

    // Filter by status
    if (statusFilter.value !== 'ALL') {
      list = list.filter((p) => p.status === statusFilter.value)
    }

    // Filter by has scheduled inspection (nextInspectionDate present)
    if (hasScheduledInspectionOnly.value) {
      list = list.filter((p) => p.nextInspectionDate != null && p.nextInspectionDate !== '')
    }

    // Sort
    const order = sortBy.value
    if (order === 'permitNumber') {
      list.sort((a, b) =>
        a.permitNumber.localeCompare(b.permitNumber, undefined, { numeric: true }),
      )
    } else if (order === 'distance') {
      list.sort((a, b) => {
        const da = a.distance ?? Infinity
        const dbVal = b.distance ?? Infinity
        return da - dbVal
      })
    } else {
      // date = nextInspectionDate descending (soonest first), then by permit number
      list.sort((a, b) => {
        const ad = a.nextInspectionDate ?? ''
        const bd = b.nextInspectionDate ?? ''
        if (ad !== bd) return ad.localeCompare(bd)
        return a.permitNumber.localeCompare(b.permitNumber, undefined, { numeric: true })
      })
    }

    return list
  })

  onMounted(() => {
    loadPermits()
  })

  return {
    allPermits,
    permits,
    isLoading,
    statusFilter,
    hasScheduledInspectionOnly,
    sortBy,
    refresh: loadPermits,
  }
}
