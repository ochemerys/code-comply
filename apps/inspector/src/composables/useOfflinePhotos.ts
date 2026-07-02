/**
 * Vue composable for offline photo storage, upload queueing, and coarse upload progress.
 *
 * @see M7-S10 - Store Photos in IndexedDB for Offline
 */

import { onMounted, onUnmounted, ref, type Ref } from 'vue'
import { db } from '@/lib/db/dexie'
import type { InspectorDB } from '@/lib/db/dexie'
import {
  deleteOfflinePhoto,
  enqueuePhotoDelete,
  enqueuePhotoUpload,
  getOfflinePhoto,
  listOfflinePhotosForChecklistItem,
  listOfflinePhotosForDeficiency,
  listOfflinePhotosForInspection,
  putOfflinePhoto,
  sumStoredPhotoBytes,
  uploadBlobWithProgress,
} from '@/lib/db/photo-storage'
import { syncEngine } from '@/lib/db/sync-engine'
import type { SyncEngine, SyncEvent } from '@/lib/db/sync-engine'
import type { LocalPhoto } from '@/lib/db/types'

export interface UseOfflinePhotosOptions {
  dexie?: InspectorDB
  engine?: SyncEngine
}

export interface OfflinePhotoStorageStats {
  count: number
  estimatedBytes: number
}

export interface UseOfflinePhotosReturn {
  uploadProgress: Ref<Record<string, number>>
  savePhoto: (photo: LocalPhoto) => Promise<void>
  queueUpload: (photo: Pick<LocalPhoto, 'id' | 'clientId'>) => Promise<string>
  saveAndQueueUpload: (photo: LocalPhoto) => Promise<string>
  queueDelete: (photo: Pick<LocalPhoto, 'id' | 'clientId'>) => Promise<string>
  removeLocalPhoto: (id: string) => Promise<void>
  getPhoto: (id: string) => Promise<LocalPhoto | undefined>
  listForInspection: (inspectionId: string) => Promise<LocalPhoto[]>
  listForChecklistItem: (inspectionId: string, checklistItemId: string) => Promise<LocalPhoto[]>
  listForDeficiency: (deficiencyId: string) => Promise<LocalPhoto[]>
  getStorageStats: () => Promise<OfflinePhotoStorageStats>
  retryFailedSyncItems: () => Promise<number>
  uploadBlobWithProgress: typeof uploadBlobWithProgress
}

/**
 * Track photo uploads: progress starts when an item is queued and completes on sync success.
 * Maps sync queue item ids to photo ids because sync events only include queue item ids.
 */
export function useOfflinePhotos(options: UseOfflinePhotosOptions = {}): UseOfflinePhotosReturn {
  const dexie = options.dexie ?? db
  const engine = options.engine ?? syncEngine
  const uploadProgress = ref<Record<string, number>>({})
  const queueItemToPhotoId = new Map<string, string>()

  const seedProgressForPhoto = (photoId: string, percent: number) => {
    uploadProgress.value = { ...uploadProgress.value, [photoId]: percent }
  }

  const registerQueueBinding = (queueItemId: string, photoId: string) => {
    queueItemToPhotoId.set(queueItemId, photoId)
    seedProgressForPhoto(photoId, 10)
  }

  const onItemSuccess = (ev: SyncEvent) => {
    if (ev.data?.operation !== 'photo.upload' || !ev.data.itemId) return
    const photoId = queueItemToPhotoId.get(ev.data.itemId)
    if (!photoId) return
    queueItemToPhotoId.delete(ev.data.itemId)
    seedProgressForPhoto(photoId, 100)
  }

  const onItemRetry = (ev: SyncEvent) => {
    if (ev.data?.operation !== 'photo.upload' || !ev.data.itemId) return
    const photoId = queueItemToPhotoId.get(ev.data.itemId)
    if (!photoId || ev.data.attempt === undefined) return
    const pct = Math.min(90, 20 + ev.data.attempt * 15)
    seedProgressForPhoto(photoId, pct)
  }

  const onItemError = (ev: SyncEvent) => {
    if (ev.data?.operation !== 'photo.upload' || !ev.data.itemId) return
    const photoId = queueItemToPhotoId.get(ev.data.itemId)
    if (!photoId) return
    queueItemToPhotoId.delete(ev.data.itemId)
    seedProgressForPhoto(photoId, 0)
  }

  onMounted(() => {
    engine.on('sync:item:success', onItemSuccess)
    engine.on('sync:item:retry', onItemRetry)
    engine.on('sync:item:error', onItemError)
  })

  onUnmounted(() => {
    engine.off('sync:item:success', onItemSuccess)
    engine.off('sync:item:retry', onItemRetry)
    engine.off('sync:item:error', onItemError)
  })

  const queueUpload = async (photo: Pick<LocalPhoto, 'id' | 'clientId'>) => {
    const qid = await enqueuePhotoUpload(engine, dexie, photo)
    registerQueueBinding(qid, photo.id)
    return qid
  }

  return {
    uploadProgress,
    savePhoto: (photo) => putOfflinePhoto(dexie, photo),
    queueUpload,
    async saveAndQueueUpload(photo) {
      await putOfflinePhoto(dexie, photo)
      return queueUpload(photo)
    },
    queueDelete: (photo) => enqueuePhotoDelete(engine, dexie, photo),
    removeLocalPhoto: (id) => deleteOfflinePhoto(dexie, id),
    getPhoto: (id) => getOfflinePhoto(dexie, id),
    listForInspection: (inspectionId) => listOfflinePhotosForInspection(dexie, inspectionId),
    listForChecklistItem: (inspectionId, checklistItemId) =>
      listOfflinePhotosForChecklistItem(dexie, inspectionId, checklistItemId),
    listForDeficiency: (deficiencyId) => listOfflinePhotosForDeficiency(dexie, deficiencyId),
    async getStorageStats() {
      const [count, estimatedBytes] = await Promise.all([
        dexie.photos.count(),
        sumStoredPhotoBytes(dexie),
      ])
      return { count, estimatedBytes }
    },
    retryFailedSyncItems: () => engine.retryFailedItems(),
    uploadBlobWithProgress,
  }
}
