/**
 * Integration tests for local permit search (M4-S9).
 * Uses real usePermitSearch + cachePermitsForSearch with fake IndexedDB.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { usePermitSearch, cachePermitsForSearch } from '@/composables/usePermitSearch'
import { db } from '@/lib/db'
import type { PermitListDTO } from '@codecomply/validators'

describe('Permit Search Integration', () => {
  beforeEach(async () => {
    await db.permits.clear()
  })

  it('caches permits and finds them by permit number', async () => {
    const permits: PermitListDTO[] = [
      { id: 'p1', permitNumber: 'BP-2024-001', address: '123 Main St', status: 'ACTIVE' },
      { id: 'p2', permitNumber: 'BP-2024-002', address: '456 Oak Ave', status: 'COMPLETED' },
    ]
    await cachePermitsForSearch(permits)

    const { searchQuery, results } = usePermitSearch({ minChars: 2, debounceMs: 0 })
    searchQuery.value = '2024-001'
    await nextTick()
    await vi.waitUntil(() => results.value.length === 1, { timeout: 3000 })

    expect(results.value).toHaveLength(1)
    expect(results.value[0].permitNumber).toBe('BP-2024-001')
    expect(results.value[0].address).toBe('123 Main St')
  })

  it('finds permits by address (partial match)', async () => {
    const permits: PermitListDTO[] = [
      { id: 'p1', permitNumber: 'BP-2024-001', address: '123 Main St, Calgary', status: 'ACTIVE' },
      { id: 'p2', permitNumber: 'BP-2024-002', address: '456 Oak Ave', status: 'COMPLETED' },
    ]
    await cachePermitsForSearch(permits)

    const { searchQuery, results } = usePermitSearch({ minChars: 2, debounceMs: 0 })
    searchQuery.value = 'main st'
    await nextTick()
    await vi.waitUntil(() => results.value.length === 1, { timeout: 3000 })

    expect(results.value).toHaveLength(1)
    expect(results.value[0].address).toContain('Main St')
  })

  it('limits results to maxResults', async () => {
    const permits: PermitListDTO[] = Array.from({ length: 25 }, (_, i) => ({
      id: `p${i}`,
      permitNumber: `BP-2024-${String(i + 1).padStart(3, '0')}`,
      address: `${i} Main St`,
      status: 'ACTIVE' as const,
    }))
    await cachePermitsForSearch(permits)

    const { searchQuery, results } = usePermitSearch({
      minChars: 1,
      maxResults: 20,
      debounceMs: 0,
    })
    searchQuery.value = 'main'
    await nextTick()
    await vi.waitUntil(() => results.value.length === 20, { timeout: 3000 })

    expect(results.value).toHaveLength(20)
  })
})
