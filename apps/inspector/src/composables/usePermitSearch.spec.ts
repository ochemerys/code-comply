/**
 * Unit tests for usePermitSearch composable (M4-S9)
 * Search by permit number, address, debounce, min chars, clear, offline.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { usePermitSearch } from './usePermitSearch'
import type { LocalPermit } from '@/lib/db/types'
const mockPermits: LocalPermit[] = [
  {
    id: 'p1',
    permitNumber: 'BP-2024-001',
    address: '123 Main St, Calgary',
    status: 'ACTIVE',
    updatedAt: '2024-01-01T00:00:00.000Z',
    distance: 500,
    nextInspectionDate: '2024-06-01',
  },
  {
    id: 'p2',
    permitNumber: 'BP-2024-002',
    address: '456 Oak Ave, Calgary',
    status: 'COMPLETED',
    updatedAt: '2024-01-02T00:00:00.000Z',
  },
  {
    id: 'p3',
    permitNumber: 'BP-2023-099',
    address: '789 Main St, Edmonton',
    status: 'ACTIVE',
    updatedAt: '2023-12-01T00:00:00.000Z',
  },
]

const { mockToArray, mockBulkPut, mockPrimaryKeys } = vi.hoisted(() => ({
  mockToArray: vi.fn(),
  mockBulkPut: vi.fn(),
  mockPrimaryKeys: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/db', () => ({
  db: {
    permits: {
      toArray: mockToArray,
      bulkPut: mockBulkPut,
      toCollection: () => ({ primaryKeys: mockPrimaryKeys }),
    },
  },
}))

async function flushDebouncedSearch(ms?: number) {
  await nextTick()
  if (ms != null) {
    await vi.advanceTimersByTimeAsync(ms)
  } else {
    await vi.runOnlyPendingTimersAsync()
  }
  // allow awaited db calls + state updates to settle
  await Promise.resolve()
  await nextTick()
}

describe('usePermitSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockToArray.mockResolvedValue([...mockPermits])
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('starts with empty query and results', () => {
      const { searchQuery, results, isSearching, canSearch } = usePermitSearch()
      expect(searchQuery.value).toBe('')
      expect(results.value).toEqual([])
      expect(isSearching.value).toBe(false)
      expect(canSearch.value).toBe(false)
    })

    it('canSearch is true when query has at least minChars', async () => {
      const { searchQuery, canSearch } = usePermitSearch({ minChars: 2 })
      searchQuery.value = 'ab'
      await nextTick()
      expect(canSearch.value).toBe(true)
    })

    it('canSearch is false when query has fewer than minChars', async () => {
      const { searchQuery, canSearch } = usePermitSearch({ minChars: 2 })
      searchQuery.value = 'a'
      await nextTick()
      expect(canSearch.value).toBe(false)
    })
  })

  describe('search by permit number', () => {
    it('returns permits matching permit number (partial, case-insensitive)', async () => {
      const { searchQuery, results } = usePermitSearch({ minChars: 2, debounceMs: 0 })
      searchQuery.value = '2024-001'
      await flushDebouncedSearch()
      expect(mockToArray).toHaveBeenCalled()
      expect(results.value).toHaveLength(1)
      expect(results.value[0].permitNumber).toBe('BP-2024-001')
      expect(results.value[0].address).toBe('123 Main St, Calgary')
    })

    it('returns permits when searching by full permit number', async () => {
      const { searchQuery, results } = usePermitSearch({ minChars: 2, debounceMs: 0 })
      searchQuery.value = 'BP-2024'
      await flushDebouncedSearch()
      expect(results.value.length).toBeGreaterThanOrEqual(1)
      expect(results.value.some((p) => p.permitNumber.includes('2024'))).toBe(true)
    })
  })

  describe('search by address', () => {
    it('returns permits matching address (partial, case-insensitive)', async () => {
      const { searchQuery, results } = usePermitSearch({ minChars: 2, debounceMs: 0 })
      searchQuery.value = 'main st'
      await flushDebouncedSearch()
      expect(mockToArray).toHaveBeenCalled()
      expect(results.value.length).toBe(2) // 123 Main St and 789 Main St
      expect(results.value.map((p) => p.address)).toEqual(
        expect.arrayContaining(['123 Main St, Calgary', '789 Main St, Edmonton']),
      )
    })

    it('returns no results when no address matches', async () => {
      mockToArray.mockResolvedValue([...mockPermits])
      const { searchQuery, results } = usePermitSearch({ minChars: 2, debounceMs: 0 })
      searchQuery.value = 'nowhere lane'
      await flushDebouncedSearch()
      expect(results.value).toHaveLength(0)
    })
  })

  describe('debounce', () => {
    it('uses debounce so rapid typing does not call toArray multiple times immediately', async () => {
      const { searchQuery } = usePermitSearch({ minChars: 2, debounceMs: 300 })
      searchQuery.value = 'a'
      await nextTick()
      searchQuery.value = 'ab'
      await nextTick()
      expect(mockToArray).not.toHaveBeenCalled()
      await flushDebouncedSearch(300)
      expect(mockToArray).toHaveBeenCalledTimes(1)
    })
  })

  describe('min chars', () => {
    it('does not search when query length is below minChars', async () => {
      vi.clearAllMocks()
      mockToArray.mockResolvedValue([...mockPermits])

      // Create a fresh instance
      const { searchQuery, results } = usePermitSearch({ minChars: 2, debounceMs: 0 })

      // Wait for initialization to complete
      await nextTick()

      // Clear mock after initialization
      mockToArray.mockClear()

      // Set query below minChars
      searchQuery.value = 'a'
      await flushDebouncedSearch()

      expect(mockToArray).not.toHaveBeenCalled()
      expect(results.value).toEqual([])
    })

    it('clears results when query drops below minChars', async () => {
      const { searchQuery, results } = usePermitSearch({ minChars: 2, debounceMs: 0 })
      searchQuery.value = 'main'
      await flushDebouncedSearch()
      expect(results.value.length).toBeGreaterThan(0)
      searchQuery.value = 'm'
      await nextTick()
      expect(results.value).toEqual([])
    })
  })

  describe('max results', () => {
    it('limits results to maxResults', async () => {
      const many = Array.from({ length: 30 }, (_, i) => ({
        ...mockPermits[0],
        id: `p${i}`,
        permitNumber: `BP-2024-${String(i + 1).padStart(3, '0')}`,
        address: `${i} Main St`,
      }))
      mockToArray.mockResolvedValue(many)
      const { searchQuery, results } = usePermitSearch({
        minChars: 1,
        maxResults: 20,
        debounceMs: 0,
      })
      searchQuery.value = 'main'
      await flushDebouncedSearch()
      expect(results.value).toHaveLength(20)
    })
  })

  describe('clearSearch', () => {
    it('clears query and results', async () => {
      const { searchQuery, results, clearSearch } = usePermitSearch({ minChars: 2, debounceMs: 0 })
      searchQuery.value = 'main'
      await flushDebouncedSearch()
      expect(results.value.length).toBeGreaterThan(0)
      clearSearch()
      expect(searchQuery.value).toBe('')
      expect(results.value).toEqual([])
    })
  })

  describe('offline / IndexedDB', () => {
    it('reads from db.permits.toArray (offline cache)', async () => {
      const { searchQuery } = usePermitSearch({ minChars: 2, debounceMs: 0 })
      searchQuery.value = 'bp'
      await flushDebouncedSearch()
      expect(mockToArray).toHaveBeenCalled()
    })
  })
})
