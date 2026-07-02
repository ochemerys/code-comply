/**
 * Integration: sensitive fields are encrypted at rest in IndexedDB (NFR-M-03).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { db, DB_NAME } from '@/lib/db/dexie'
import {
  bootstrapEncryptionSession,
  teardownEncryptionSession,
} from '@/lib/db/encryption-bootstrap'
import { getEncryptionService, ENCRYPTED_PREFIX_V2 } from '@/lib/db/encryption'
import type { LocalInspection } from '@/lib/db/types'

const TEST_REFRESH = 'integration-refresh-token'
const TEST_USER_ID = 'user-encryption-integration'

async function readRawInspectionNotes(id: string): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const idb = request.result
      const tx = idb.transaction('inspections', 'readonly')
      const store = tx.objectStore('inspections')
      const getReq = store.get(id)
      getReq.onerror = () => reject(getReq.error)
      getReq.onsuccess = () => {
        const record = getReq.result as { notes?: string } | undefined
        resolve(record?.notes)
        idb.close()
      }
    }
  })
}

const baseInspection: LocalInspection = {
  id: 'insp-enc-at-rest',
  clientId: 'client-enc-at-rest',
  permitId: 'permit-enc',
  status: 'SCHEDULED',
  scheduledDate: '2026-05-01T10:00:00.000Z',
  assignedToId: TEST_USER_ID,
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
  isDirty: false,
}

describe('IndexedDB encryption at rest', () => {
  beforeEach(async () => {
    teardownEncryptionSession()
    await bootstrapEncryptionSession(TEST_REFRESH, TEST_USER_ID)
    await db.inspections.clear()
  })

  it('initializes encryption service after bootstrap', () => {
    expect(getEncryptionService().getKey()).toBe(TEST_REFRESH)
  })

  it('stores notes as enc:v2 ciphertext in raw IndexedDB and returns plaintext via Dexie', async () => {
    await db.inspections.add({
      ...baseInspection,
      notes: 'x',
    })

    const rawNotes = await readRawInspectionNotes('insp-enc-at-rest')
    expect(rawNotes).toBeDefined()
    expect(rawNotes!.startsWith(ENCRYPTED_PREFIX_V2)).toBe(true)

    const retrieved = await db.inspections.get('insp-enc-at-rest')
    expect(retrieved?.notes).toBe('x')
  })

  it('clears encryption service on teardown (logout)', () => {
    teardownEncryptionSession()
    expect(() => getEncryptionService()).toThrow(/not initialized/)
  })
})
