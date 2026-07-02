/**
 * Integration: offline deficiency create → online sync reconciles Dexie (M-03).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createSyncEngine } from '@/lib/db/sync-engine'
import { createInspectorSyncMutationProcessor } from '@/lib/db/inspector-sync-mutation-processor'
import { db } from '@/lib/db/dexie'
import type { LocalDeficiency } from '@/lib/db/types'

vi.mock('@/utils/api-fetch', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('@/lib/api-base', () => ({
  getApiBaseUrl: vi.fn(() => 'http://localhost:4000'),
}))

vi.mock('@/composables/usePermitSearch', () => ({
  cachePermitsForSearch: vi.fn().mockResolvedValue(0),
}))

vi.mock('@/lib/permit-orphan-sync', () => ({
  reconcileOrphanPermitsAfterAssignedSync: vi.fn().mockResolvedValue(undefined),
  markFirstAssignedSyncCompleted: vi.fn(),
}))

import { apiFetch } from '@/utils/api-fetch'

const baseDeficiency = (): LocalDeficiency => ({
  id: 'offline-c-tx-1',
  clientId: 'c-tx-1',
  inspectionId: 'insp-tx-1',
  createdById: 'user-tx-1',
  description: 'Offline deficiency for sync transaction test',
  severity: 'MAJOR',
  status: 'OPEN',
  isStopWork: false,
  isUnsafe: false,
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
  isDirty: true,
})

describe('sync deficiency transaction', () => {
  afterEach(async () => {
    await db.syncQueue.clear()
    await db.deficiencies.clear()
  })

  beforeEach(async () => {
    await db.syncQueue.clear()
    await db.deficiencies.clear()
    vi.mocked(apiFetch).mockReset()
  })

  it('reconciles offline create when going online (no optimistic-* ids, isDirty false)', async () => {
    const row = baseDeficiency()
    await db.deficiencies.put(row)

    vi.mocked(apiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'srv-def-tx-1',
          clientId: 'c-tx-1',
          inspectionId: 'insp-tx-1',
          description: row.description,
          severity: 'MAJOR',
          status: 'OPEN',
          isStopWork: false,
          isUnsafe: false,
          createdAt: '2026-05-01T10:00:00.000Z',
          updatedAt: '2026-05-01T11:00:00.000Z',
        }),
        {
          status: 201,
          headers: { ETag: '"etag-tx-1"', 'Content-Type': 'application/json' },
        },
      ),
    )

    const engine = createSyncEngine({ initialDelay: 0, maxDelay: 0, maxAttempts: 3 })
    engine.setMutationProcessor(createInspectorSyncMutationProcessor({ dexie: db }))
    engine.setAuthCheck(() => true)

    await engine.queueMutation('deficiency.create', { ...row })
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
    await engine.sync()

    expect(await db.deficiencies.get('offline-c-tx-1')).toBeUndefined()
    const synced = await db.deficiencies.get('srv-def-tx-1')
    expect(synced?.id).toBe('srv-def-tx-1')
    expect(synced?.clientId).toBe('c-tx-1')
    expect(synced?.isDirty).toBe(false)
    expect(synced?.etag).toBe('etag-tx-1')
    expect(synced?.syncedAt).toBeDefined()

    const pending = await db.syncQueue.where('status').equals('PENDING').count()
    const failed = await db.syncQueue.where('status').equals('FAILED').count()
    expect(pending).toBe(0)
    expect(failed).toBe(0)

    engine.destroy()
  })

  it('drops deficiency.delete when server returns 404 without failing the queue', async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 404 }))

    const engine = createSyncEngine({ initialDelay: 0, maxDelay: 0, maxAttempts: 3 })
    engine.setMutationProcessor(createInspectorSyncMutationProcessor({ dexie: db }))
    engine.setAuthCheck(() => true)

    await engine.queueMutation('deficiency.delete', {
      id: 'gone-def',
      clientId: 'c-gone',
    })
    await engine.sync()

    const failed = await db.syncQueue.where('status').equals('FAILED').count()
    expect(failed).toBe(0)

    engine.destroy()
  })

  it('increments conflictCount after 409 reconcile on deficiency.update', async () => {
    await db.deficiencies.put({
      ...baseDeficiency(),
      id: 'def-conflict-tx',
      clientId: 'c-conflict',
      etag: 'stale',
      isDirty: true,
    })

    vi.mocked(apiFetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Optimistic concurrency conflict' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'def-conflict-tx',
            clientId: 'c-conflict',
            inspectionId: 'insp-tx-1',
            description: 'Server wins description for conflict test',
            severity: 'MAJOR',
            status: 'OPEN',
            isStopWork: false,
            isUnsafe: false,
            createdAt: '2026-05-01T10:00:00.000Z',
            updatedAt: '2026-05-01T12:00:00.000Z',
          }),
          {
            status: 200,
            headers: { ETag: '"etag-server"', 'Content-Type': 'application/json' },
          },
        ),
      )

    const engine = createSyncEngine({ initialDelay: 0, maxDelay: 0, maxAttempts: 3 })
    engine.setMutationProcessor(createInspectorSyncMutationProcessor({ dexie: db }))
    engine.setAuthCheck(() => true)

    await engine.queueMutation('deficiency.update', {
      id: 'def-conflict-tx',
      clientId: 'c-conflict',
      description: 'Local edit description text',
      severity: 'MAJOR',
    })

    await engine.sync()

    const status = await engine.getStatusAsync()
    expect(status.conflictCount).toBe(1)

    const row = await db.deficiencies.get('def-conflict-tx')
    expect(row?.description).toBe('Server wins description for conflict test')
    expect(row?.isDirty).toBe(false)
    expect(row?.etag).toBe('etag-server')

    engine.destroy()
  })
})
