import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { buildCertificationSnapshot, useFinalization } from './useFinalization'
import { db } from '@/lib/db/dexie'
import type { LocalInspection } from '@/lib/db/types'

const mockGetPosition = vi.fn()

vi.mock('./useGeolocation', () => ({
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

function baseInspection(overrides?: Partial<LocalInspection>): LocalInspection {
  const now = new Date().toISOString()
  return {
    id: 'insp-f1',
    clientId: 'c-f1',
    permitId: 'p-1',
    status: 'IN_PROGRESS',
    scheduledDate: now,
    assignedToId: 'u-1',
    createdAt: now,
    updatedAt: now,
    isDirty: false,
    ...overrides,
  }
}

describe('useFinalization', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    await db.syncQueue.clear()
    await db.inspections.clear()
    mockGetPosition.mockResolvedValue({
      coords: { latitude: 51.0, longitude: -114.0, accuracy: 8 },
    } as GeolocationPosition)
  })

  it('buildCertificationSnapshot includes certifications and timestamp', () => {
    const snap = buildCertificationSnapshot('2026-01-01T00:00:00.000Z', {
      certifications: [
        {
          id: 'cert-1',
          discipline: 'ELECTRICAL',
          authority: 'AB',
          issuedDate: '2020-01-01T00:00:00.000Z',
          status: 'ACTIVE' as const,
        },
      ],
    })
    const parsed = JSON.parse(snap) as { finalizedAt: string; certifications: unknown[] }
    expect(parsed.finalizedAt).toBe('2026-01-01T00:00:00.000Z')
    expect(parsed.certifications).toHaveLength(1)
  })

  it('finalizeInspection stores GPS, accuracy, outcome, signature, certification snapshot, and queues finalize', async () => {
    const { finalizeInspection } = useFinalization()
    const before = baseInspection()
    await db.inspections.put(before)

    const result = await finalizeInspection({
      inspection: before,
      outcome: 'ACCEPTABLE',
      signatureDataUrl: 'data:image/png;base64,QUFB',
      certificationSource: { certifications: [] },
    })

    expect(result.finalizedGps).toEqual({ latitude: 51, longitude: -114, accuracy: 8 })
    const row = await db.inspections.get('insp-f1')
    expect(row?.outcome).toBe('ACCEPTABLE')
    expect(row?.status).toBe('PASSED')
    expect(row?.signatureDataUrl).toContain('data:image/png')
    expect(row?.finalizeLatitude).toBe(51)
    expect(row?.finalizeLongitude).toBe(-114)
    expect(row?.finalizeAccuracy).toBe(8)
    expect(row?.certificationSnapshot).toBeTruthy()
    const snap = JSON.parse(row?.certificationSnapshot ?? '{}') as { certifications: unknown[] }
    expect(snap.certifications).toEqual([])

    const queued = await db.syncQueue.where('operation').equals('inspection.finalize').toArray()
    expect(queued).toHaveLength(1)
    const p = queued[0]!.payload as Record<string, unknown>
    expect(p.finalizedAt).toBeTruthy()
    expect(p.finalizedGps).toEqual({ latitude: 51, longitude: -114, accuracy: 8 })
    expect(p.certificationSnapshot).toBe(row?.certificationSnapshot)
  })

  it('sets status FAILED when outcome is REFUSED', async () => {
    const { finalizeInspection } = useFinalization()
    const before = baseInspection({ id: 'insp-f2', clientId: 'c-f2' })
    await db.inspections.put(before)

    await finalizeInspection({
      inspection: before,
      outcome: 'REFUSED',
      signatureDataUrl: 'data:image/png;base64,X',
    })

    const row = await db.inspections.get('insp-f2')
    expect(row?.status).toBe('FAILED')
  })

  it('continues when GPS is unavailable', async () => {
    mockGetPosition.mockRejectedValue(new Error('denied'))
    const { finalizeInspection } = useFinalization()
    const before = baseInspection({ id: 'insp-f3', clientId: 'c-f3' })
    await db.inspections.put(before)

    const result = await finalizeInspection({
      inspection: before,
      outcome: 'ACCEPTABLE',
      signatureDataUrl: 'data:image/png;base64,Y',
    })

    expect(result.finalizedGps).toBeNull()
    const row = await db.inspections.get('insp-f3')
    expect(row?.finalizeLatitude).toBeUndefined()
    const queued = await db.syncQueue.where('operation').equals('inspection.finalize').toArray()
    expect(queued).toHaveLength(1)
  })
})
