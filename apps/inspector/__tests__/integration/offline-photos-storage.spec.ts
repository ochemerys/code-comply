/**
 * Integration: offline photo limits, IndexedDB blobs, upload queue (M7-S10).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/lib/db/dexie'
import { createSyncEngine } from '@/lib/db/sync-engine'
import {
  OFFLINE_PHOTO_MAX_COUNT,
  PhotoStorageLimitError,
  putOfflinePhoto,
  enqueuePhotoUpload,
  getOfflinePhoto,
  listOfflinePhotosForInspection,
} from '@/lib/db/photo-storage'
import type { LocalPhoto } from '@/lib/db/types'
import { buildEmbeddedPhotoMetadata, toPhotoMetadata } from '@/lib/photo/metadata'

function makePhoto(id: string, inspectionId: string, blobSize: number): LocalPhoto {
  const blob = new Blob([new Uint8Array(blobSize)], { type: 'image/jpeg' })
  const embedded = buildEmbeddedPhotoMetadata({
    capturedAt: new Date('2026-04-11T12:00:00.000Z'),
    inspectorId: 'integration-user',
    inspectorName: 'Integration Tester',
    permitNumber: 'BP-M7S10',
  })
  return {
    id,
    clientId: `client-${id}`,
    inspectionId,
    filename: `${id}.jpg`,
    mimeType: 'image/jpeg',
    size: blob.size,
    blob,
    metadata: toPhotoMetadata(embedded, { hasWatermark: false }),
    createdAt: embedded.timestamp,
  }
}

describe('offline photos storage integration (M7-S10)', () => {
  beforeEach(async () => {
    await db.photos.clear()
    await db.syncQueue.clear()
  })

  it('persists blob and metadata and reads back from IndexedDB', async () => {
    const photo = makePhoto('int-photo-1', 'insp-int-1', 64)
    await putOfflinePhoto(db, photo)
    const read = await getOfflinePhoto(db, 'int-photo-1')
    expect(read?.metadata.permitNumber).toBe('BP-M7S10')
    expect(read?.size).toBe(64)
    const list = await listOfflinePhotosForInspection(db, 'insp-int-1')
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('int-photo-1')
  })

  it('rejects when adding more than max distinct photos', async () => {
    for (let i = 0; i < OFFLINE_PHOTO_MAX_COUNT; i++) {
      await putOfflinePhoto(db, makePhoto(`fill-${i}`, 'insp-cap', 8))
    }
    await expect(putOfflinePhoto(db, makePhoto('one-too-many', 'insp-cap', 8))).rejects.toThrow(
      PhotoStorageLimitError,
    )
  })

  it('enqueues photo.upload with deduped queue id', async () => {
    const engine = createSyncEngine()
    const photo = makePhoto('q-photo', 'insp-q', 16)
    await putOfflinePhoto(db, photo)
    const first = await enqueuePhotoUpload(engine, db, photo)
    const second = await enqueuePhotoUpload(engine, db, photo)
    expect(first).toBe(second)
    const pending = await db.syncQueue.where('status').equals('PENDING').toArray()
    expect(pending.filter((p) => p.operation === 'photo.upload')).toHaveLength(1)
    engine.destroy()
  })
})
