/**
 * Persist permit list rows for offline search (no Vue dependency — safe for SW bundle).
 */

import { db } from './dexie'
import type { LocalPermit } from './types'
import { PermitListDTOSchema, type PermitListDTO } from '@codecomply/validators'

/**
 * Cache permit list results into IndexedDB for offline local search.
 */
export async function cachePermitsForSearch(permits: PermitListDTO[]): Promise<number> {
  const parsed = PermitListDTOSchema.array().parse(permits)
  if (parsed.length === 0) return 0
  const existingIds = new Set(await db.permits.toCollection().primaryKeys())
  const newCount = parsed.filter((p) => !existingIds.has(p.id)).length
  const now = new Date().toISOString()
  const records: LocalPermit[] = parsed.map((p) => ({
    id: p.id,
    permitNumber: p.permitNumber,
    address: p.address,
    status: p.status,
    distance: p.distance,
    nextInspectionDate: p.nextInspectionDate,
    updatedAt: now,
    isOrphan: false,
  }))
  await db.permits.bulkPut(records)
  return newCount
}
