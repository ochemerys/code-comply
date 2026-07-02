/**
 * @see M7-S10 - Store Photos in IndexedDB for Offline
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { InspectorDB } from './dexie'
import type { InspectorDB as InspectorDBType } from './dexie'
import type { LocalPhoto } from './types'
import {
  OFFLINE_PHOTO_MAX_COUNT,
  OFFLINE_PHOTO_MAX_TOTAL_BYTES,
  PHOTO_SYNC_QUEUE_PRIORITY,
  PhotoStorageLimitError,
  estimatePhotoStorageBytes,
  sumStoredPhotoBytes,
  validateOfflinePhotoLimits,
  putOfflinePhoto,
  enqueuePhotoUpload,
  enqueuePhotoDelete,
  uploadBlobWithProgress,
  listOfflinePhotosForChecklistItem,
  applyServerPhotoAfterUpload,
} from './photo-storage'

function basePhoto(overrides?: Partial<LocalPhoto>): LocalPhoto {
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })
  return {
    id: 'photo-1',
    clientId: 'client-1',
    inspectionId: 'insp-1',
    filename: 'a.jpg',
    mimeType: 'image/jpeg',
    size: blob.size,
    blob,
    metadata: {
      timestamp: '2026-04-11T12:00:00.000Z',
      inspectorId: 'u1',
      hasWatermark: false,
    },
    createdAt: '2026-04-11T12:00:00.000Z',
    ...overrides,
  }
}

describe('photo-storage (M7-S10)', () => {
  describe('estimatePhotoStorageBytes', () => {
    it('uses blob size when present', () => {
      const b = new Blob([new Uint8Array(500)])
      expect(estimatePhotoStorageBytes({ blob: b, size: 999 })).toBe(500)
    })

    it('falls back to size when blob missing', () => {
      expect(estimatePhotoStorageBytes({ size: 120 })).toBe(120)
    })

    it('adds thumbnail estimate', () => {
      const thumb = 'abcd'
      const extra = Math.ceil((thumb.length * 3) / 4)
      expect(estimatePhotoStorageBytes({ size: 10, thumbnail: thumb })).toBe(10 + extra)
    })
  })

  describe('validateOfflinePhotoLimits', () => {
    let mockDexie: {
      photos: {
        get: ReturnType<typeof vi.fn>
        toArray: ReturnType<typeof vi.fn>
      }
    }

    beforeEach(() => {
      mockDexie = {
        photos: {
          get: vi.fn(),
          toArray: vi.fn(),
        },
      }
    })

    it('throws MAX_PHOTOS when adding a new row beyond cap', async () => {
      const existing = Array.from({ length: OFFLINE_PHOTO_MAX_COUNT }, (_, i) =>
        basePhoto({ id: `p-${i}`, clientId: `c-${i}` }),
      )
      mockDexie.photos.get.mockResolvedValue(undefined)
      mockDexie.photos.toArray.mockResolvedValue(existing)
      const next = basePhoto({ id: 'new-photo', clientId: 'new-client' })

      await expect(
        validateOfflinePhotoLimits(mockDexie as unknown as InspectorDBType, next),
      ).rejects.toThrow(PhotoStorageLimitError)
      await expect(
        validateOfflinePhotoLimits(mockDexie as unknown as InspectorDBType, next),
      ).rejects.toMatchObject({
        code: 'MAX_PHOTOS',
      })
    })

    it('allows replace of existing id without increasing count', async () => {
      const p = basePhoto({ id: 'same' })
      mockDexie.photos.get.mockResolvedValue(p)
      mockDexie.photos.toArray.mockResolvedValue(
        Array.from({ length: OFFLINE_PHOTO_MAX_COUNT }, (_, i) =>
          basePhoto({ id: `p-${i}`, clientId: `c-${i}` }),
        ),
      )
      await expect(
        validateOfflinePhotoLimits(mockDexie as unknown as InspectorDBType, p),
      ).resolves.toBeUndefined()
    })

    it('throws MAX_BYTES when total footprint would exceed limit', async () => {
      mockDexie.photos.get.mockResolvedValue(undefined)
      mockDexie.photos.toArray.mockResolvedValue([])
      const huge = basePhoto({
        id: 'big',
        blob: undefined,
        size: OFFLINE_PHOTO_MAX_TOTAL_BYTES + 1,
      })
      await expect(
        validateOfflinePhotoLimits(mockDexie as unknown as InspectorDBType, huge),
      ).rejects.toMatchObject({
        code: 'MAX_BYTES',
      })
    })
  })

  describe('enqueuePhotoUpload / enqueuePhotoDelete', () => {
    it('reuses pending upload queue id for same photo', async () => {
      const engine = { queueMutation: vi.fn().mockResolvedValue('new-q') }
      const pending = [
        {
          id: 'existing-q',
          operation: 'photo.upload',
          payload: { photoId: 'photo-1', clientId: 'client-1' },
        },
      ]
      const mockDexie = {
        syncQueue: {
          where: vi.fn().mockReturnValue({
            equals: vi.fn().mockReturnValue({
              toArray: vi.fn().mockResolvedValue(pending),
            }),
          }),
        },
      }
      const id = await enqueuePhotoUpload(
        engine as never,
        mockDexie as unknown as InspectorDBType,
        {
          id: 'photo-1',
          clientId: 'client-1',
        },
      )
      expect(id).toBe('existing-q')
      expect(engine.queueMutation).not.toHaveBeenCalled()
    })

    it('queues new upload with story priority default', async () => {
      const engine = { queueMutation: vi.fn().mockResolvedValue('q-99') }
      const mockDexie = {
        syncQueue: {
          where: vi.fn().mockReturnValue({
            equals: vi.fn().mockReturnValue({
              toArray: vi.fn().mockResolvedValue([]),
            }),
          }),
        },
      }
      await enqueuePhotoUpload(engine as never, mockDexie as unknown as InspectorDBType, {
        id: 'photo-2',
        clientId: 'client-2',
      })
      expect(engine.queueMutation).toHaveBeenCalledWith(
        'photo.upload',
        { photoId: 'photo-2', clientId: 'client-2' },
        PHOTO_SYNC_QUEUE_PRIORITY,
      )
    })

    it('queues photo.delete when not pending', async () => {
      const engine = { queueMutation: vi.fn().mockResolvedValue('qd-1') }
      const mockDexie = {
        syncQueue: {
          where: vi.fn().mockReturnValue({
            equals: vi.fn().mockReturnValue({
              toArray: vi.fn().mockResolvedValue([]),
            }),
          }),
        },
      }
      await enqueuePhotoDelete(engine as never, mockDexie as unknown as InspectorDBType, {
        id: 'photo-3',
        clientId: 'client-3',
      })
      expect(engine.queueMutation).toHaveBeenCalledWith(
        'photo.delete',
        { photoId: 'photo-3', clientId: 'client-3' },
        PHOTO_SYNC_QUEUE_PRIORITY,
      )
    })
  })

  describe('uploadBlobWithProgress', () => {
    it('rejects when XMLHttpRequest is undefined', async () => {
      const prev = globalThis.XMLHttpRequest
      vi.stubGlobal('XMLHttpRequest', undefined)
      await expect(uploadBlobWithProgress('https://example.com/up', new Blob())).rejects.toThrow(
        'XMLHttpRequest is not available',
      )
      vi.stubGlobal('XMLHttpRequest', prev)
    })

    it('invokes onProgress when upload reports lengthComputable', async () => {
      const progress = vi.fn()
      class MockXHR {
        upload: { onprogress: ((ev: ProgressEvent) => void) | null } = { onprogress: null }
        status = 200
        responseText = ''
        open = vi.fn()
        setRequestHeader = vi.fn()
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        send = vi.fn(() => {
          queueMicrotask(() => {
            this.upload.onprogress?.({
              lengthComputable: true,
              loaded: 50,
              total: 100,
            } as ProgressEvent)
            queueMicrotask(() => this.onload?.())
          })
        })
      }
      const inst = new MockXHR()
      vi.spyOn(globalThis, 'XMLHttpRequest').mockImplementation(() => inst as never)

      await uploadBlobWithProgress('https://example.com/up', new Blob([new Uint8Array(100)]), {
        onProgress: progress,
      })

      expect(progress).toHaveBeenCalledWith(50)
      vi.restoreAllMocks()
    })
  })
})

describe('putOfflinePhoto', () => {
  it('validates then writes', async () => {
    const p = basePhoto()
    const mockDexie = {
      photos: {
        get: vi.fn().mockResolvedValue(undefined),
        toArray: vi.fn().mockResolvedValue([]),
        put: vi.fn().mockResolvedValue(undefined),
      },
    }
    await putOfflinePhoto(mockDexie as unknown as InspectorDBType, p)
    expect(mockDexie.photos.put).toHaveBeenCalledWith(p)
  })
})

describe('sumStoredPhotoBytes', () => {
  it('sums estimates for all rows', async () => {
    const mockDexie = {
      photos: {
        toArray: vi.fn().mockResolvedValue([basePhoto({ id: 'a' }), basePhoto({ id: 'b' })]),
      },
    }
    const sum = await sumStoredPhotoBytes(mockDexie as unknown as InspectorDBType)
    expect(sum).toBe(estimatePhotoStorageBytes(basePhoto({ id: 'a' })) * 2)
  })
})

describe('listOfflinePhotosForChecklistItem (M7-S16)', () => {
  it('returns only rows for inspection and checklist line', async () => {
    const rows = [
      basePhoto({ id: 'a', inspectionId: 'in-1', checklistItemId: 'line-1' }),
      basePhoto({ id: 'b', inspectionId: 'in-1', checklistItemId: 'line-2' }),
      basePhoto({ id: 'c', inspectionId: 'in-1' }),
    ]
    const mockDexie = {
      photos: {
        where: vi.fn().mockReturnValue({
          equals: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue(rows),
          }),
        }),
      },
    }
    const got = await listOfflinePhotosForChecklistItem(
      mockDexie as unknown as InspectorDBType,
      'in-1',
      'line-1',
    )
    expect(got).toHaveLength(1)
    expect(got[0]?.id).toBe('a')
  })
})

describe('applyServerPhotoAfterUpload (M7-S19)', () => {
  let testDb: InspectorDB

  beforeEach(async () => {
    const dbName = `PhotoSync-${Math.random().toString(36).slice(2, 9)}`
    testDb = new InspectorDB(dbName)
    await testDb.open()
  })

  afterEach(async () => {
    if (testDb.isOpen()) testDb.close()
    await testDb.delete()
  })

  it('updates storageKey and syncedAt when server id matches local id', async () => {
    const p = basePhoto({ id: 'same-id', clientId: 'c1' })
    await putOfflinePhoto(testDb, p)
    await applyServerPhotoAfterUpload(testDb, 'same-id', {
      id: 'same-id',
      clientId: 'c1',
      storageKey: 'k1',
      syncedAt: '2026-04-15T12:00:00.000Z',
    })
    const row = await testDb.photos.get('same-id')
    expect(row?.storageKey).toBe('k1')
    expect(row?.syncedAt).toBe('2026-04-15T12:00:00.000Z')
  })

  it('re-keys row when server returns a new id', async () => {
    const p = basePhoto({ id: 'local-uuid', clientId: 'c2' })
    await putOfflinePhoto(testDb, p)
    await applyServerPhotoAfterUpload(testDb, 'local-uuid', {
      id: 'server-cuid',
      clientId: 'c2',
      storageKey: 'k2',
    })
    expect(await testDb.photos.get('local-uuid')).toBeUndefined()
    const row = await testDb.photos.get('server-cuid')
    expect(row?.id).toBe('server-cuid')
    expect(row?.clientId).toBe('c2')
    expect(row?.storageKey).toBe('k2')
    expect(row?.syncedAt).toBeTruthy()
  })
})
