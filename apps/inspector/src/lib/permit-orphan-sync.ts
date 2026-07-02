/**
 * Detects cached permits that no longer exist on the server (e.g. after DB re-seed)
 * and persists `isOrphan` on LocalPermit for offline-visible warnings.
 *
 * Runs after a successful `/permits/assigned` fetch while online: permits in that
 * response are authoritative; any other cached permit is checked via GET /permits/:id.
 */

import { getApiBaseUrl } from '@/lib/api-base'
import { db } from '@/lib/db/dexie'
import { apiFetch } from '@/utils/api-fetch'

export const FIRST_ASSIGNED_SYNC_STORAGE_KEY = 'inspector.permits.firstAssignedSyncCompleted'

export function hasCompletedFirstAssignedSync(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(FIRST_ASSIGNED_SYNC_STORAGE_KEY) === '1'
}

export function markFirstAssignedSyncCompleted(): void {
  localStorage.setItem(FIRST_ASSIGNED_SYNC_STORAGE_KEY, '1')
}

function apiPrefix(): string {
  const base = getApiBaseUrl()
  return base ? `${base}/api` : '/api'
}

async function permitExistsOnServer(id: string): Promise<boolean> {
  const res = await apiFetch(`${apiPrefix()}/permits/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  if (res.status === 404) return false
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Permit check failed (${res.status})`)
  }
  return true
}

/**
 * For each cached permit not in the latest assigned list, verify with the server.
 * Sets `isOrphan` when GET returns 404; clears it when the permit still exists.
 * No-op when offline (keeps previously stored flags).
 */
export async function reconcileOrphanPermitsAfterAssignedSync(
  assignedIds: Set<string>,
): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return

  const all = await db.permits.toArray()
  const candidates = all.filter((p) => !assignedIds.has(p.id))
  if (candidates.length === 0) return

  for (const p of candidates) {
    try {
      const exists = await permitExistsOnServer(p.id)
      await db.permits.update(p.id, { isOrphan: !exists })
    } catch (e) {
      console.warn('[permit-orphan-sync] could not verify permit', p.id, e)
    }
  }
}

export async function deleteOrphanPermitFromCache(id: string): Promise<void> {
  await db.permits.delete(id)
}
