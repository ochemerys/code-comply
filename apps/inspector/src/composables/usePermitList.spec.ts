/**
 * Unit tests for usePermitList composable (M4-S10)
 * Load permits from IndexedDB, filter by status and hasScheduledInspection, sort.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { usePermitList } from './usePermitList'
import type { LocalPermit } from '../lib/db/types'

const mockPermits: LocalPermit[] = [
  {
    id: 'p1',
    permitNumber: 'BP-2024-002',
    address: '456 Oak Ave',
    status: 'ACTIVE',
    updatedAt: '2024-01-01T00:00:00.000Z',
    nextInspectionDate: '2024-06-15T00:00:00.000Z',
    distance: 1000,
  },
  {
    id: 'p2',
    permitNumber: 'BP-2024-001',
    address: '123 Main St',
    status: 'ACTIVE',
    updatedAt: '2024-01-01T00:00:00.000Z',
    nextInspectionDate: '2024-05-01T00:00:00.000Z',
    distance: 500,
  },
  {
    id: 'p3',
    permitNumber: 'BP-2023-099',
    address: '789 Pine Rd',
    status: 'COMPLETED',
    updatedAt: '2023-12-01T00:00:00.000Z',
    nextInspectionDate: undefined,
    distance: undefined,
  },
]

const { mockToArray } = vi.hoisted(() => ({
  mockToArray: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    permits: {
      toArray: mockToArray,
    },
  },
}))

describe('usePermitList', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockToArray.mockResolvedValue([...mockPermits])
  })

  it('loads permits from IndexedDB on mount', async () => {
    mount(
      {
        setup() {
          return usePermitList()
        },
        template: '<div />',
      },
      { global: { plugins: [createPinia()] } },
    )
    await new Promise((r) => setTimeout(r, 50))
    expect(mockToArray).toHaveBeenCalled()
  })

  it('returns filtered and sorted permits by permitNumber by default', async () => {
    const { permits, isLoading, refresh } = usePermitList()
    await refresh()
    expect(isLoading.value).toBe(false)
    expect(permits.value).toHaveLength(3)
    expect(permits.value[0].permitNumber).toBe('BP-2023-099')
    expect(permits.value[1].permitNumber).toBe('BP-2024-001')
    expect(permits.value[2].permitNumber).toBe('BP-2024-002')
  })

  it('filters by status when statusFilter is set', async () => {
    const { permits, statusFilter, refresh } = usePermitList()
    await refresh()
    statusFilter.value = 'ACTIVE'
    expect(permits.value).toHaveLength(2)
    expect(permits.value.every((p) => p.status === 'ACTIVE')).toBe(true)
  })

  it('filters by hasScheduledInspectionOnly when true', async () => {
    const { permits, hasScheduledInspectionOnly, refresh } = usePermitList()
    await refresh()
    hasScheduledInspectionOnly.value = true
    expect(permits.value).toHaveLength(2)
    expect(permits.value.every((p) => p.nextInspectionDate)).toBe(true)
  })

  it('sorts by distance when sortBy is distance', async () => {
    const { permits, sortBy, refresh } = usePermitList()
    await refresh()
    sortBy.value = 'distance'
    expect(permits.value[0].distance).toBe(500)
    expect(permits.value[1].distance).toBe(1000)
    expect(permits.value[2].distance).toBeUndefined()
  })

  it('sorts by date (nextInspectionDate) when sortBy is date', async () => {
    const { permits, sortBy, refresh } = usePermitList()
    await refresh()
    sortBy.value = 'date'
    const withDate = permits.value.filter((p) => p.nextInspectionDate)
    expect(withDate[0].nextInspectionDate).toBe('2024-05-01T00:00:00.000Z')
    expect(withDate[1].nextInspectionDate).toBe('2024-06-15T00:00:00.000Z')
  })

  it('refresh reloads from IndexedDB', async () => {
    const { permits, refresh } = usePermitList()
    await refresh()
    expect(permits.value).toHaveLength(3)
    mockToArray.mockResolvedValue([])
    await refresh()
    expect(permits.value).toHaveLength(0)
  })

  it('filters by searchQuery when length >= 2 (permit number or address)', async () => {
    const searchQuery = ref('')
    const { permits, refresh } = usePermitList({ searchQuery })
    await refresh()
    expect(permits.value).toHaveLength(3)
    searchQuery.value = 'Main'
    expect(permits.value).toHaveLength(1)
    expect(permits.value[0].address).toContain('Main')
    searchQuery.value = 'BP-2024'
    expect(permits.value).toHaveLength(2)
    searchQuery.value = 'xyz'
    expect(permits.value).toHaveLength(0)
    searchQuery.value = ''
    expect(permits.value).toHaveLength(3)
  })
})
