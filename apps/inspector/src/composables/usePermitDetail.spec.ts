/**
 * Unit tests for usePermitDetail composable (M4-S11)
 * Fetches permit from API when online; falls back to cache when offline.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { usePermitDetail } from './usePermitDetail'

const mockPermitDTO = {
  id: 'permit-1',
  permitNumber: 'BP-2024-001',
  address: '123 Main St',
  legalLandDesc: 'SW-1-2-3 W4',
  scope: 'Building',
  status: 'ACTIVE',
  latitude: 51.04,
  longitude: -114.06,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-15T00:00:00.000Z',
  inspections: [
    {
      id: 'insp-1',
      status: 'SCHEDULED',
      scheduledDate: '2024-06-01T10:00:00.000Z',
      assignedInspectorName: 'Jane Doe',
    },
  ],
}

const { mockFetch, mockPermitsGet, mockToArray, mockInspectionsWhere } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockPermitsGet: vi.fn(),
  mockToArray: vi.fn(),
  mockInspectionsWhere: { equals: vi.fn() },
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    accessToken: 'mock-token',
  }),
}))

vi.mock('@/utils/api-error-handler', () => ({
  handleApiError: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    permits: { get: (...args: unknown[]) => mockPermitsGet(...args) },
    inspections: { where: () => mockInspectionsWhere },
  },
}))

describe('usePermitDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = mockFetch
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
  })

  it('fetches permit from API when online and returns data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPermitDTO),
    })
    const permitId = ref('permit-1')
    const { permit, isLoading, error } = usePermitDetail(permitId)
    await flushPromises()
    expect(isLoading.value).toBe(false)
    expect(error.value).toBeNull()
    expect(permit.value).toEqual(mockPermitDTO)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/permits/permit-1'),
      expect.any(Object),
    )
  })

  it('returns null permit when API returns 404 (not found) and no cache', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
    mockPermitsGet.mockResolvedValueOnce(null)
    const permitId = ref('permit-missing')
    const { permit, isLoading, error } = usePermitDetail(permitId)
    await flushPromises()
    expect(isLoading.value).toBe(false)
    expect(permit.value).toBeNull()
    expect(error.value).toBeNull()
  })

  it('falls back to cache when API returns 404 but permit is cached', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
    const localPermit = {
      id: 'permit-1',
      permitNumber: 'BP-2024-001',
      address: '123 Main St',
      status: 'ACTIVE',
      updatedAt: '2024-01-15T00:00:00.000Z',
    }
    mockPermitsGet.mockResolvedValueOnce(localPermit)
    mockToArray.mockResolvedValue([])
    mockInspectionsWhere.equals.mockReturnValue({ toArray: mockToArray })
    const permitId = ref('permit-1')
    const { permit, isLoading, isOffline, error } = usePermitDetail(permitId)
    await flushPromises()
    expect(isLoading.value).toBe(false)
    expect(isOffline.value).toBe(true)
    expect(error.value).toBeNull()
    expect(permit.value).not.toBeNull()
    expect(permit.value?.permitNumber).toBe('BP-2024-001')
  })

  it('sets error when API returns 500', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })
    const permitId = ref('permit-1')
    const { permit, isLoading, error } = usePermitDetail(permitId)
    await flushPromises()
    expect(isLoading.value).toBe(false)
    expect(permit.value).toBeNull()
    expect(error.value).toBeInstanceOf(Error)
  })

  it('falls back to cache when API fails and permit is cached', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    const localPermit = {
      id: 'permit-1',
      permitNumber: 'BP-2024-001',
      address: '123 Main St',
      status: 'ACTIVE',
      updatedAt: '2024-01-15T00:00:00.000Z',
    }
    mockPermitsGet.mockResolvedValueOnce(localPermit)
    mockToArray.mockResolvedValue([])
    mockInspectionsWhere.equals.mockReturnValue({ toArray: mockToArray })
    const permitId = ref('permit-1')
    const { permit, isLoading, isOffline } = usePermitDetail(permitId)
    await flushPromises()
    expect(isLoading.value).toBe(false)
    expect(isOffline.value).toBe(true)
    expect(permit.value).not.toBeNull()
    expect(permit.value?.permitNumber).toBe('BP-2024-001')
  })

  it('returns null permit when permitId is undefined', async () => {
    const permitId = ref<string | undefined>(undefined)
    const { permit, isLoading } = usePermitDetail(permitId)
    await flushPromises()
    expect(isLoading.value).toBe(false)
    expect(permit.value).toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
