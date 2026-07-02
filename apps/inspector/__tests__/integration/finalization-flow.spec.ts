import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFinalization } from '@/composables/useFinalization'
import { db } from '@/lib/db/dexie'
import type { LocalInspection } from '@/lib/db/types'

const mockGetPosition = vi.fn()

vi.mock('@/composables/useGeolocation', () => ({
  useGeolocation: () => ({
    getCurrentPosition: () => mockGetPosition(),
    position: { value: null },
    error: { value: null },
    isLoading: { value: false },
    isSupported: { value: true },
    watchPosition: vi.fn(),
    stopWatching: vi.fn(),
  }),
}))

function inspectionRow(overrides?: Partial<LocalInspection>): LocalInspection {
  const now = new Date().toISOString()
  return {
    id: 'insp-int-1',
    clientId: 'c-int',
    permitId: 'perm-int',
    permitNumber: 'BP-INT-1',
    status: 'IN_PROGRESS',
    scheduledDate: now,
    assignedToId: 'u-1',
    createdAt: now,
    updatedAt: now,
    isDirty: false,
    ...overrides,
  }
}

describe('Finalization flow (integration)', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    await db.syncQueue.clear()
    await db.inspections.clear()
    mockGetPosition.mockResolvedValue({
      coords: { latitude: 52.0, longitude: -112.0, accuracy: 5 },
    } as GeolocationPosition)
  })

  it('persists finalization data and enqueues a single inspection.finalize operation', async () => {
    const row = inspectionRow()
    await db.inspections.put(row)

    const { finalizeInspection } = useFinalization()
    await finalizeInspection({
      inspection: row,
      outcome: 'ACCEPTABLE_WITH_CONDITIONS',
      signatureDataUrl: 'data:image/png;base64,ZZZ',
      certificationSource: { certifications: [] },
    })

    const updated = await db.inspections.get('insp-int-1')
    expect(updated?.outcome).toBe('ACCEPTABLE_WITH_CONDITIONS')
    expect(updated?.completedDate).toBeDefined()
    expect(updated?.isDirty).toBe(true)

    const q = await db.syncQueue.toArray()
    const fin = q.filter((i) => i.operation === 'inspection.finalize')
    expect(fin).toHaveLength(1)
  })
})
