/**
 * IndexedDB quota handling: detect QuotaExceededError and reclaim safe-to-drop cache data.
 *
 * @see M6 review — applyFromServer resilience when device storage is full
 */

import { db } from './dexie'
import type { LocalPhoto } from './types'

/** Thrown when a write still fails after a best-effort reclaim pass. */
export class OfflineStorageQuotaError extends Error {
  override readonly name = 'OfflineStorageQuotaError'
  readonly cause?: unknown
  constructor(message: string, options?: { cause?: unknown }) {
    super(message)
    this.cause = options?.cause
  }
}

export function isQuotaExceededError(err: unknown): boolean {
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
    return err.name === 'QuotaExceededError'
  }
  if (err && typeof err === 'object' && 'name' in err) {
    return (err as { name: string }).name === 'QuotaExceededError'
  }
  return false
}

/** InvalidStateError often indicates a closed or corrupted IndexedDB connection. */
export function isIndexedDbInvalidStateError(err: unknown): boolean {
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
    return err.name === 'InvalidStateError'
  }
  if (err && typeof err === 'object' && 'name' in err) {
    return (err as { name: string }).name === 'InvalidStateError'
  }
  return false
}

/**
 * Best-effort space reclaim without touching dirty deficiencies or unsynced photos.
 * Clears refetchable caches and strips blob payloads from photos already uploaded (storageKey + syncedAt).
 */
export async function tryReclaimIndexedDbSpace(): Promise<void> {
  await db.transaction('rw', db.photos, db.permits, db.checklistTemplateCache, async () => {
    await db.permits.clear()
    await db.checklistTemplateCache.clear()
    await db.photos.toCollection().modify((photo: LocalPhoto) => {
      if (photo.syncedAt && photo.storageKey) {
        delete photo.blob
        delete photo.thumbnail
      }
    })
  })
}

/**
 * Runs an IndexedDB operation; on QuotaExceededError, reclaims cache/blob space once and retries.
 */
export async function runWithIndexedDbQuotaRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (err) {
    if (!isQuotaExceededError(err)) throw err
    await tryReclaimIndexedDbSpace()
    try {
      return await operation()
    } catch (retryErr) {
      throw new OfflineStorageQuotaError(
        'Device storage is full. Try deleting local photos, closing other tabs, or clearing site data for this app in your browser settings.',
        { cause: retryErr as unknown },
      )
    }
  }
}
