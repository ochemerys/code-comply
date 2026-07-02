/**
 * M-03 sync down: assigned permits list + checklist template pre-fetch.
 */

import { PermitListDTOSchema } from '@codecomply/validators'
import { getApiBaseUrl } from '@/lib/api-base'
import { apiFetch } from '@/utils/api-fetch'
import { cachePermitsForSearch } from './permit-cache'
import { prefetchChecklistTemplatesForPermitIds } from './checklist-template-prefetch'
import {
  markFirstAssignedSyncCompleted,
  reconcileOrphanPermitsAfterAssignedSync,
} from '@/lib/permit-orphan-sync'

function apiPrefix(): string {
  const base = getApiBaseUrl()
  return base ? `${base}/api` : '/api'
}

/**
 * Loads `/permits/assigned`, updates local permit cache, reconciles orphans,
 * and pre-downloads checklist templates for assigned inspections.
 */
export async function syncAssignedPermitsFromApi(): Promise<void> {
  const res = await apiFetch(`${apiPrefix()}/permits/assigned`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Could not load assigned permits (${res.status})`)
  }

  const raw = await res.json()
  const listParsed = PermitListDTOSchema.array().safeParse(raw)
  if (!listParsed.success) {
    throw new Error('Assigned permits response was invalid')
  }

  await cachePermitsForSearch(listParsed.data)
  const assignedIds = new Set(listParsed.data.map((p) => p.id))
  await reconcileOrphanPermitsAfterAssignedSync(assignedIds)
  markFirstAssignedSyncCompleted()
  await prefetchChecklistTemplatesForPermitIds(listParsed.data.map((p) => p.id))
}
