import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createInspectorSyncMutationProcessor } from '../inspector-sync-mutation-processor'
import { db } from '../dexie'

vi.mock('@/utils/api-fetch', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('@/lib/api-base', () => ({
  getApiBaseUrl: vi.fn(() => 'http://localhost:4000'),
}))

describe('createInspectorSyncMutationProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('M8-S10-B1: inspection.finalize calls POST /api/inspections/:id/finalize and marks inspection as synced', async () => {
    const { apiFetch } = await import('@/utils/api-fetch')
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )

    await db.inspections.clear()
    await db.inspections.put({
      id: 'insp-1',
      clientId: 'c-1',
      permitId: 'perm-1',
      status: 'PASSED',
      scheduledDate: '2026-04-01T00:00:00.000Z',
      assignedToId: 'u-1',
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
      isDirty: true,
      outcome: 'ACCEPTABLE',
      signatureDataUrl: 'data:image/png;base64,AAA',
      finalizeLatitude: 51,
      finalizeLongitude: -114,
      finalizeAccuracy: 12,
      completedDate: '2026-04-01T12:00:00.000Z',
    })

    const processor = createInspectorSyncMutationProcessor()
    await expect(
      processor('inspection.finalize', {
        inspectionId: 'insp-1',
        outcome: 'ACCEPTABLE',
        signatureDataUrl: 'data:image/png;base64,AAA',
        finalizeLatitude: 51,
        finalizeLongitude: -114,
        finalizeAccuracy: 12,
        finalizedAt: '2026-04-01T12:00:00.000Z',
      }),
    ).resolves.toMatchObject({ ok: true })

    expect(apiFetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/inspections/insp-1/finalize',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const updated = await db.inspections.get('insp-1')
    expect(updated?.isDirty).toBe(false)
    expect(updated?.syncedAt).toBeTruthy()
  })

  it('M7-S19: photo.delete calls DELETE /api/photos', async () => {
    const { apiFetch } = await import('@/utils/api-fetch')
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 204 }))

    const processor = createInspectorSyncMutationProcessor()
    await expect(
      processor('photo.delete', { photoId: 'ph-1', clientId: 'c-1' }),
    ).resolves.toMatchObject({ ok: true })

    expect(apiFetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/photos/ph-1?clientId=c-1',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('rejects invalid deficiency.create payloads before sending to the server', async () => {
    const { apiFetch } = await import('@/utils/api-fetch')
    const processor = createInspectorSyncMutationProcessor()

    await expect(
      processor('deficiency.create', {
        clientId: 'client-invalid',
        inspectionId: 'insp-invalid',
        description: 'short',
        severity: 'MAJOR',
      }),
    ).rejects.toThrow()

    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('rejects invalid deficiency.voc.submit payloads before sending to the server', async () => {
    const { apiFetch } = await import('@/utils/api-fetch')
    const processor = createInspectorSyncMutationProcessor()

    await expect(
      processor('deficiency.voc.submit', {
        deficiencyId: 'def-1',
        payload: {
          verificationDate: '2026-04-01T12:00:00.000Z',
          sectionTitle: '',
          title: 'Correction verified',
          name: 'Inspector One',
          method: 'SITE_VISIT',
        },
      }),
    ).rejects.toThrow()

    expect(apiFetch).not.toHaveBeenCalled()
  })
})
