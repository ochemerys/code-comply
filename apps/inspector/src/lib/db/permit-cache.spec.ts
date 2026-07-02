import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { LocalPermit } from './types'
import type { PermitListDTO } from '@codecomply/validators'
import { cachePermitsForSearch } from './permit-cache'

const { mockBulkPut, mockPrimaryKeys } = vi.hoisted(() => ({
  mockBulkPut: vi.fn(),
  mockPrimaryKeys: vi.fn().mockResolvedValue([]),
}))

vi.mock('./dexie', () => ({
  db: {
    permits: {
      bulkPut: mockBulkPut,
      toCollection: () => ({ primaryKeys: mockPrimaryKeys }),
    },
  },
}))

describe('cachePermitsForSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBulkPut.mockResolvedValue(undefined)
    mockPrimaryKeys.mockResolvedValue([])
  })

  it('calls db.permits.bulkPut with LocalPermit records', async () => {
    const permits: PermitListDTO[] = [
      {
        id: 'p1',
        permitNumber: 'BP-2024-001',
        address: '123 Main St',
        status: 'ACTIVE',
        nextInspectionDate: '2024-06-01T00:00:00.000Z',
        distance: 100,
      },
    ]
    await cachePermitsForSearch(permits)
    expect(mockBulkPut).toHaveBeenCalledTimes(1)
    const arg = mockBulkPut.mock.calls[0][0] as LocalPermit[]
    expect(arg).toHaveLength(1)
    expect(arg[0].id).toBe('p1')
    expect(arg[0].permitNumber).toBe('BP-2024-001')
    expect(arg[0].address).toBe('123 Main St')
    expect(arg[0].status).toBe('ACTIVE')
    expect(arg[0].updatedAt).toBeDefined()
  })

  it('does not call bulkPut when permits array is empty', async () => {
    const count = await cachePermitsForSearch([])
    expect(count).toBe(0)
    expect(mockBulkPut).not.toHaveBeenCalled()
  })

  it('returns number of permits not already in cache (newly added)', async () => {
    mockPrimaryKeys.mockResolvedValue(['p1'])
    const permits: PermitListDTO[] = [
      { id: 'p1', permitNumber: 'BP-2024-001', address: '123 Main St', status: 'ACTIVE' },
      { id: 'p2', permitNumber: 'BP-2024-002', address: '456 Oak Ave', status: 'ACTIVE' },
    ]
    const count = await cachePermitsForSearch(permits)
    expect(count).toBe(1)
    expect(mockBulkPut).toHaveBeenCalled()
  })
})
