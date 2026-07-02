import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createInspectorSyncMutationProcessor } from './inspector-sync-mutation-processor'

vi.mock('@/utils/api-fetch', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('@/lib/api-base', () => ({
  getApiBaseUrl: vi.fn(() => 'http://localhost:4000'),
}))

vi.mock('./checklist-storage', () => ({
  markChecklistResponseSyncedAfterSuccessfulPush: vi.fn(),
  clearChecklistResponseSyncAfterExecutionMissingOnServer: vi.fn(),
}))

vi.mock('./photo-storage', async () => {
  const mod = await vi.importActual<typeof import('./photo-storage')>('./photo-storage')
  return {
    ...mod,
    getOfflinePhoto: vi.fn(),
    applyServerPhotoAfterUpload: vi.fn(),
  }
})

import { apiFetch } from '@/utils/api-fetch'
import {
  clearChecklistResponseSyncAfterExecutionMissingOnServer,
  markChecklistResponseSyncedAfterSuccessfulPush,
} from './checklist-storage'
import * as photoStorage from './photo-storage'
import { getOfflinePhoto, applyServerPhotoAfterUpload } from './photo-storage'

describe('createInspectorSyncMutationProcessor', () => {
  const processor = createInspectorSyncMutationProcessor()

  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    vi.mocked(markChecklistResponseSyncedAfterSuccessfulPush).mockReset()
    vi.mocked(clearChecklistResponseSyncAfterExecutionMissingOnServer).mockReset()
    vi.mocked(getOfflinePhoto).mockReset()
    vi.mocked(applyServerPhotoAfterUpload).mockReset()
  })

  it('PATCHes checklist execution response and marks local row synced', async () => {
    const openExecution = {
      id: 'exec-1',
      inspectionId: 'insp-1',
      templateId: 'tpl-1',
      versionHash: 'hash',
      responses: [] as unknown[],
      progress: 50,
    }
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(openExecution), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(openExecution), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

    await processor('checklistResponse.update', {
      clientId: 'checklistResponse:exec-1:item-1',
      executionId: 'exec-1',
      inspectionId: 'insp-1',
      checklistId: 'exec-1',
      templateId: 'tpl-1',
      versionHash: 'hash',
      itemId: 'item-1',
      result: 'FAIL',
      codeReference: { code: 'NBC', section: '9.9.9' },
      timestamp: '2025-01-01T12:00:00.000Z',
      updatedAt: '2025-01-01T12:00:00.000Z',
    })

    expect(vi.mocked(apiFetch).mock.calls[0]?.[0]).toBe(
      'http://localhost:4000/api/checklists/executions/exec-1',
    )
    const patchCall = vi.mocked(apiFetch).mock.calls[1]
    expect(patchCall?.[0]).toBe('http://localhost:4000/api/checklists/executions/exec-1/responses')
    expect(patchCall?.[1]).toEqual(
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    expect(JSON.parse(String((patchCall?.[1] as { body?: string }).body))).toEqual({
      itemId: 'item-1',
      result: 'FAIL',
      timestamp: '2025-01-01T12:00:00.000Z',
      codeReference: { code: 'NBC', section: '9.9.9' },
    })
    expect(markChecklistResponseSyncedAfterSuccessfulPush).toHaveBeenCalledWith('exec-1', 'item-1')
  })

  it('throws when PATCH returns non-OK after open execution GET', async () => {
    const openExecution = {
      id: 'exec-1',
      inspectionId: 'insp-1',
      templateId: 'tpl-1',
      versionHash: 'hash',
      responses: [] as unknown[],
      progress: 10,
    }
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(openExecution), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response('bad', { status: 400 }))

    await expect(
      processor('checklistResponse.update', {
        executionId: 'exec-1',
        itemId: 'item-1',
        result: 'PASS',
        timestamp: '2025-01-01T12:00:00.000Z',
      }),
    ).rejects.toThrow('bad')

    expect(markChecklistResponseSyncedAfterSuccessfulPush).not.toHaveBeenCalled()
    expect(clearChecklistResponseSyncAfterExecutionMissingOnServer).not.toHaveBeenCalled()
  })

  it('drops when GET shows completed execution (no PATCH)', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'done-exec',
          inspectionId: 'insp-1',
          templateId: 'tpl-1',
          versionHash: 'vh',
          responses: [],
          progress: 100,
          completedAt: '2025-01-01T12:00:00.000Z',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    const out = await processor('checklistResponse.update', {
      executionId: 'done-exec',
      itemId: 'item-1',
      result: 'PASS',
      timestamp: '2025-01-01T12:00:00.000Z',
    })

    expect(out).toEqual({ dropped: true })
    expect(apiFetch).toHaveBeenCalledTimes(1)
    expect(vi.mocked(apiFetch).mock.calls[0]?.[0]).toBe(
      'http://localhost:4000/api/checklists/executions/done-exec',
    )
    expect(clearChecklistResponseSyncAfterExecutionMissingOnServer).toHaveBeenCalledWith(
      'done-exec',
      'item-1',
    )
    expect(markChecklistResponseSyncedAfterSuccessfulPush).not.toHaveBeenCalled()
  })

  it('404 Checklist execution not found drops local sync state without throwing (M5-S5-B1)', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Checklist execution not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const out = await processor('checklistResponse.update', {
      executionId: 'stale-exec',
      itemId: 'item-1',
      result: 'PASS',
      timestamp: '2025-01-01T12:00:00.000Z',
    })

    expect(out).toEqual({ dropped: true })
    expect(clearChecklistResponseSyncAfterExecutionMissingOnServer).toHaveBeenCalledWith(
      'stale-exec',
      'item-1',
    )
    expect(markChecklistResponseSyncedAfterSuccessfulPush).not.toHaveBeenCalled()
  })

  it('404 on GET drops without PATCH (any error body)', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Something else' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const out = await processor('checklistResponse.update', {
      executionId: 'exec-1',
      itemId: 'item-1',
      result: 'PASS',
      timestamp: '2025-01-01T12:00:00.000Z',
    })

    expect(out).toEqual({ dropped: true })
    expect(apiFetch).toHaveBeenCalledTimes(1)
    expect(clearChecklistResponseSyncAfterExecutionMissingOnServer).toHaveBeenCalledWith(
      'exec-1',
      'item-1',
    )
  })

  it('PATCH completed execution still drops when GET was stale (race)', async () => {
    const openExecution = {
      id: 'exec-1',
      inspectionId: 'insp-1',
      templateId: 'tpl-1',
      versionHash: 'hash',
      responses: [] as unknown[],
      progress: 50,
    }
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(openExecution), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Cannot modify completed checklist execution' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

    const out = await processor('checklistResponse.update', {
      executionId: 'exec-1',
      itemId: 'item-1',
      result: 'PASS',
      timestamp: '2025-01-01T12:00:00.000Z',
    })

    expect(out).toEqual({ dropped: true })
    expect(clearChecklistResponseSyncAfterExecutionMissingOnServer).toHaveBeenCalledWith(
      'exec-1',
      'item-1',
    )
    expect(markChecklistResponseSyncedAfterSuccessfulPush).not.toHaveBeenCalled()
  })

  it('rejects truly unsupported operations (regression: no silent no-op)', async () => {
    const run = processor as (op: string, payload: Record<string, unknown>) => Promise<unknown>
    await expect(run('unknown.operation', {})).rejects.toThrow(/Sync not implemented/)
  })

  it('POSTs deficiency.create and reconciles local offline row', async () => {
    const dexie = (await import('./dexie')).db
    await dexie.deficiencies.put({
      id: 'offline-c-create-1',
      clientId: 'c-create-1',
      inspectionId: 'insp-1',
      createdById: 'u1',
      description: 'New deficiency description text',
      severity: 'MAJOR',
      status: 'OPEN',
      isStopWork: false,
      isUnsafe: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      isDirty: true,
    })

    vi.mocked(apiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'srv-def-9',
          clientId: 'c-create-1',
          inspectionId: 'insp-1',
          description: 'New deficiency description text',
          severity: 'MAJOR',
          status: 'OPEN',
          isStopWork: false,
          isUnsafe: false,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:01:00.000Z',
        }),
        { status: 201, headers: { ETag: '"e1"' } },
      ),
    )

    const proc = createInspectorSyncMutationProcessor({ dexie })
    await proc('deficiency.create', {
      id: 'offline-c-create-1',
      clientId: 'c-create-1',
      inspectionId: 'insp-1',
      createdById: 'u1',
      description: 'New deficiency description text',
      severity: 'MAJOR',
      isStopWork: false,
      isUnsafe: false,
    })

    expect(await dexie.deficiencies.get('offline-c-create-1')).toBeUndefined()
    const synced = await dexie.deficiencies.get('srv-def-9')
    expect(synced?.isDirty).toBe(false)
    expect(synced?.etag).toBe('e1')

    await dexie.deficiencies.delete('srv-def-9')
  })

  it('404 Inspection not found drops photo upload without throwing', async () => {
    const abandonSpy = vi
      .spyOn(photoStorage, 'abandonPhotoUploadAfterInspectionMissingOnServer')
      .mockResolvedValue(undefined)

    const blob = new Blob([new Uint8Array([1, 2])], { type: 'image/jpeg' })
    vi.mocked(getOfflinePhoto).mockResolvedValue({
      id: 'p-missing-insp',
      clientId: 'c1',
      inspectionId: 'gone-insp',
      filename: 'a.jpg',
      mimeType: 'image/jpeg',
      size: 2,
      blob,
      metadata: {
        timestamp: '2026-01-01T00:00:00.000Z',
        inspectorId: 'u',
        hasWatermark: false,
      },
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Inspection not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const out = await processor('photo.upload', { photoId: 'p-missing-insp', clientId: 'c1' })

    expect(out).toEqual({ dropped: true })
    expect(abandonSpy).toHaveBeenCalledWith(expect.anything(), 'p-missing-insp')
    expect(applyServerPhotoAfterUpload).not.toHaveBeenCalled()

    abandonSpy.mockRestore()
  })

  it('POSTs photo.upload multipart and applies server photo DTO (M7-S19)', async () => {
    const blob = new Blob([new Uint8Array([1, 2])], { type: 'image/jpeg' })
    vi.mocked(getOfflinePhoto).mockResolvedValue({
      id: 'p1',
      clientId: 'c1',
      inspectionId: 'insp-1',
      filename: 'a.jpg',
      mimeType: 'image/jpeg',
      size: 2,
      blob,
      metadata: {
        timestamp: '2026-01-01T00:00:00.000Z',
        inspectorId: 'u',
        hasWatermark: false,
      },
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'srv-1',
          clientId: 'c1',
          inspectionId: 'insp-1',
          filename: 'a.jpg',
          mimeType: 'image/jpeg',
          size: 2,
          storageKey: 'insp-1/k',
          metadata: {},
          createdAt: '2026-01-01T00:00:00.000Z',
          syncedAt: '2026-01-01T00:01:00.000Z',
        }),
        { status: 201 },
      ),
    )

    await processor('photo.upload', { photoId: 'p1', clientId: 'c1' })

    expect(apiFetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/photos',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    )
    expect(applyServerPhotoAfterUpload).toHaveBeenCalledWith(
      expect.anything(),
      'p1',
      expect.objectContaining({ id: 'srv-1', clientId: 'c1', storageKey: 'insp-1/k' }),
    )
  })

  it('DELETEs photo.delete with clientId query (M7-S19)', async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 204 }))

    await processor('photo.delete', { photoId: 'p1', clientId: 'c1' })

    expect(apiFetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/photos/p1?clientId=c1',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})
