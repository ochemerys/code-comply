/**
 * Offline photo persistence in IndexedDB with capacity limits and sync queue helpers.
 *
 * @see M7-S10 - Store Photos in IndexedDB for Offline
 */

import type { InspectorDB } from './dexie'
import type { SyncEngine } from './sync-engine'
import type { LocalPhoto } from './types'

/** Story M7-S10: max distinct photo rows in IndexedDB (excluding replace of same id). */
export const OFFLINE_PHOTO_MAX_COUNT = 100

/** Story M7-S10: max combined footprint of stored blobs + thumbnails (bytes). */
export const OFFLINE_PHOTO_MAX_TOTAL_BYTES = 500 * 1024 * 1024

/** Lower value = higher priority in SyncEngine ordering. */
export const PHOTO_SYNC_QUEUE_PRIORITY = 2

export type PhotoStorageLimitCode = 'MAX_PHOTOS' | 'MAX_BYTES'

export class PhotoStorageLimitError extends Error {
  readonly code: PhotoStorageLimitCode

  constructor(message: string, code: PhotoStorageLimitCode) {
    super(message)
    this.name = 'PhotoStorageLimitError'
    this.code = code
  }
}

function thumbnailByteEstimate(thumbnail?: string): number {
  if (!thumbnail) return 0
  return Math.ceil((thumbnail.length * 3) / 4)
}

/**
 * Approximate IndexedDB footprint for a LocalPhoto (blob + embedded thumbnail).
 */
export function estimatePhotoStorageBytes(
  photo: Pick<LocalPhoto, 'blob' | 'thumbnail' | 'size'>,
): number {
  const blobBytes = photo.blob !== undefined ? photo.blob.size : (photo.size ?? 0)
  return blobBytes + thumbnailByteEstimate(photo.thumbnail)
}

/**
 * Sum estimated bytes for all photos currently in the database.
 */
export async function sumStoredPhotoBytes(dexie: InspectorDB): Promise<number> {
  const rows = await dexie.photos.toArray()
  return rows.reduce((sum, row) => sum + estimatePhotoStorageBytes(row), 0)
}

/**
 * Validate count and total size before writing a LocalPhoto.
 */
export async function validateOfflinePhotoLimits(
  dexie: InspectorDB,
  candidate: LocalPhoto,
): Promise<void> {
  const existing = await dexie.photos.get(candidate.id)
  const all = await dexie.photos.toArray()
  const isNew = !existing
  const nextCount = isNew ? all.length + 1 : all.length
  if (nextCount > OFFLINE_PHOTO_MAX_COUNT) {
    throw new PhotoStorageLimitError(
      `Offline photo limit reached (${OFFLINE_PHOTO_MAX_COUNT} photos).`,
      'MAX_PHOTOS',
    )
  }

  const bytesWithout = all
    .filter((p) => p.id !== candidate.id)
    .reduce((sum, p) => sum + estimatePhotoStorageBytes(p), 0)
  const nextTotal = bytesWithout + estimatePhotoStorageBytes(candidate)
  if (nextTotal > OFFLINE_PHOTO_MAX_TOTAL_BYTES) {
    throw new PhotoStorageLimitError(
      'Offline photo storage would exceed the configured size limit.',
      'MAX_BYTES',
    )
  }
}

/**
 * Persist a photo after enforcing offline limits.
 */
export async function putOfflinePhoto(dexie: InspectorDB, photo: LocalPhoto): Promise<void> {
  await validateOfflinePhotoLimits(dexie, photo)
  await dexie.photos.put(photo)
}

export async function getOfflinePhoto(
  dexie: InspectorDB,
  id: string,
): Promise<LocalPhoto | undefined> {
  return dexie.photos.get(id)
}

export async function listOfflinePhotosForInspection(
  dexie: InspectorDB,
  inspectionId: string,
): Promise<LocalPhoto[]> {
  return dexie.photos.where('inspectionId').equals(inspectionId).toArray()
}

/** Photos scoped to a checklist line item (M7-S16). */
export async function listOfflinePhotosForChecklistItem(
  dexie: InspectorDB,
  inspectionId: string,
  checklistItemId: string,
): Promise<LocalPhoto[]> {
  const rows = await dexie.photos.where('inspectionId').equals(inspectionId).toArray()
  return rows.filter((p) => p.checklistItemId === checklistItemId)
}

/** Photos attached to a deficiency (M7-I1). Indexed by `deficiencyId` on `photos` table. */
export async function listOfflinePhotosForDeficiency(
  dexie: InspectorDB,
  deficiencyId: string,
): Promise<LocalPhoto[]> {
  return dexie.photos.where('deficiencyId').equals(deficiencyId).toArray()
}

export async function deleteOfflinePhoto(dexie: InspectorDB, id: string): Promise<void> {
  await dexie.photos.delete(id)
}

/**
 * POST /photos returned inspection missing (404). Drop queued `photo.upload` rows so SyncEngine stops retrying.
 * Offline evidence remains in `photos`; user may need to attach under a valid inspection later.
 */
export async function abandonPhotoUploadAfterInspectionMissingOnServer(
  dexie: InspectorDB,
  photoId: string,
): Promise<void> {
  const rows = await dexie.syncQueue.toArray()
  for (const q of rows) {
    if (q.operation !== 'photo.upload') continue
    const pid = (q.payload as { photoId?: string }).photoId
    if (pid === photoId) {
      await dexie.syncQueue.delete(q.id)
    }
  }
}

export type ServerPhotoUploadDTO = {
  id: string
  clientId: string
  storageKey?: string | null
  syncedAt?: string | null
}

/**
 * After a successful `POST /api/photos`, align IndexedDB with server ids and storage key (M7-S19).
 * Re-keys the Dexie row when the server assigns a different primary id than the offline UUID.
 */
export async function applyServerPhotoAfterUpload(
  dexie: InspectorDB,
  localId: string,
  dto: ServerPhotoUploadDTO,
): Promise<void> {
  const row = await dexie.photos.get(localId)
  if (!row) return

  const syncedAt = dto.syncedAt ?? new Date().toISOString()
  const storageKey = dto.storageKey ?? undefined

  if (row.id === dto.id) {
    await dexie.photos.update(localId, {
      storageKey,
      syncedAt,
    })
    return
  }

  await dexie.transaction('rw', dexie.photos, async () => {
    await dexie.photos.delete(localId)
    await dexie.photos.put({
      ...row,
      id: dto.id,
      storageKey,
      syncedAt,
    })
  })
}

function findPendingPhotoOperationId(
  pending: { id: string; operation: string; payload: Record<string, unknown> }[],
  operation: 'photo.upload' | 'photo.delete',
  photoId: string,
): string | undefined {
  const found = pending.find(
    (q) => q.operation === operation && (q.payload as { photoId?: string }).photoId === photoId,
  )
  return found?.id
}

/**
 * Queue a photo upload. If an upload is already pending for this photo, returns that queue item id.
 */
export async function enqueuePhotoUpload(
  engine: Pick<SyncEngine, 'queueMutation'>,
  dexie: InspectorDB,
  photo: Pick<LocalPhoto, 'id' | 'clientId'>,
  priority: number = PHOTO_SYNC_QUEUE_PRIORITY,
): Promise<string> {
  const pending = await dexie.syncQueue.where('status').equals('PENDING').toArray()
  const existing = findPendingPhotoOperationId(pending, 'photo.upload', photo.id)
  if (existing) return existing
  return engine.queueMutation(
    'photo.upload',
    { photoId: photo.id, clientId: photo.clientId },
    priority,
  )
}

/**
 * Queue a server-side delete for a photo. If a delete is already pending, returns that queue item id.
 */
export async function enqueuePhotoDelete(
  engine: Pick<SyncEngine, 'queueMutation'>,
  dexie: InspectorDB,
  photo: Pick<LocalPhoto, 'id' | 'clientId'>,
  priority: number = PHOTO_SYNC_QUEUE_PRIORITY,
): Promise<string> {
  const pending = await dexie.syncQueue.where('status').equals('PENDING').toArray()
  const existing = findPendingPhotoOperationId(pending, 'photo.delete', photo.id)
  if (existing) return existing
  return engine.queueMutation(
    'photo.delete',
    { photoId: photo.id, clientId: photo.clientId },
    priority,
  )
}

/**
 * Upload a blob with XMLHttpRequest so upload progress can be reported (browser only).
 * Intended for direct multipart / signed-URL flows once the documents API is wired.
 */
export function uploadBlobWithProgress(
  url: string,
  blob: Blob,
  options?: {
    method?: string
    headers?: Record<string, string>
    onProgress?: (percent: number) => void
  },
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof XMLHttpRequest === 'undefined') {
      reject(new Error('XMLHttpRequest is not available in this environment'))
      return
    }
    const xhr = new XMLHttpRequest()
    xhr.open(options?.method ?? 'POST', url)
    for (const [k, v] of Object.entries(options?.headers ?? {})) {
      xhr.setRequestHeader(k, v)
    }
    xhr.upload.onprogress = (ev) => {
      if (!options?.onProgress || !ev.lengthComputable || ev.total <= 0) return
      options.onProgress(Math.min(100, Math.round((ev.loaded / ev.total) * 100)))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload failed with status ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('Upload network error'))
    xhr.send(blob)
  })
}
