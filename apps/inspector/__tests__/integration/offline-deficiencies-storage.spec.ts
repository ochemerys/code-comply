/**
 * Integration tests: useOfflineDeficiencies + real Dexie (M6-S17).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createApp } from 'vue'
import { db } from '@/lib/db/dexie'
import { syncEngine } from '@/lib/db/sync-engine'
import { useOfflineDeficiencies } from '@/composables/useOfflineDeficiencies'

vi.mock('@/lib/db/sync-engine', () => ({
  syncEngine: {
    queueMutation: vi.fn().mockResolvedValue('queue-item'),
  },
}))

function mountComposable<T>(fn: () => T): T {
  let result!: T
  const app = createApp({
    setup() {
      result = fn()
      return () => {}
    },
  })
  app.mount(document.createElement('div'))
  return result
}

const baseRow = {
  id: 'def-m6s17',
  clientId: 'client-m6s17',
  inspectionId: 'insp-m6s17',
  createdById: 'user-m6s17',
  description: 'Offline deficiency storage integration test description.',
  severity: 'MAJOR' as const,
  status: 'OPEN' as const,
  isStopWork: false,
  isUnsafe: false,
  createdAt: '2026-04-01T10:00:00.000Z',
  updatedAt: '2026-04-01T10:00:00.000Z',
  isDirty: false,
}

describe('useOfflineDeficiencies integration', () => {
  beforeEach(async () => {
    await db.deficiencies.clear()
    await db.syncQueue.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('offline create persists to IndexedDB and enqueues deficiency.create', async () => {
    const { save } = mountComposable(() => useOfflineDeficiencies())
    await save({
      ...baseRow,
      isDirty: false,
    })

    const stored = await db.deficiencies.get('def-m6s17')
    expect(stored?.description).toContain('integration test')
    expect(stored?.isDirty).toBe(true)
    expect(syncEngine.queueMutation).toHaveBeenCalledWith(
      'deficiency.create',
      expect.objectContaining({ id: 'def-m6s17', clientId: 'client-m6s17', isDirty: true }),
      10,
    )
  })

  it('offline update enqueues deficiency.update', async () => {
    await db.deficiencies.put({ ...baseRow, syncedAt: '2026-04-01T11:00:00.000Z' })

    const { save } = mountComposable(() => useOfflineDeficiencies())
    await save({
      ...baseRow,
      description: 'Updated offline deficiency description text for sync queue.',
      status: 'VOC_SUBMITTED',
    })

    expect(syncEngine.queueMutation).toHaveBeenCalledWith(
      'deficiency.update',
      expect.objectContaining({ status: 'VOC_SUBMITTED', isDirty: true }),
      10,
    )
  })

  it('offline delete enqueues deficiency.delete when row was synced', async () => {
    await db.deficiencies.put({
      ...baseRow,
      syncedAt: '2026-04-01T11:00:00.000Z',
    })

    const { delete: del } = mountComposable(() => useOfflineDeficiencies())
    await del('def-m6s17')

    expect(await db.deficiencies.get('def-m6s17')).toBeUndefined()
    expect(syncEngine.queueMutation).toHaveBeenCalledWith('deficiency.delete', {
      clientId: 'client-m6s17',
      id: 'def-m6s17',
    })
  })

  it('applyFromServer clears dirty flag and updates local row after sync', async () => {
    await db.deficiencies.put({
      ...baseRow,
      isDirty: true,
      etag: 'old',
    })

    const { applyFromServer } = mountComposable(() => useOfflineDeficiencies())
    await applyFromServer({
      ...baseRow,
      description: 'Reconciled from server after successful sync.',
      isDirty: false,
      etag: 'new-etag',
      status: 'OPEN',
    })

    const stored = await db.deficiencies.get('def-m6s17')
    expect(stored?.isDirty).toBe(false)
    expect(stored?.etag).toBe('new-etag')
    expect(stored?.description).toContain('Reconciled from server')
    expect(stored?.syncedAt).toBeDefined()
  })

  it('applyFromServer with keep-local-when-dirty skips write on etag conflict', async () => {
    await db.deficiencies.put({
      ...baseRow,
      isDirty: true,
      etag: 'local-etag',
      description: 'Local pending edits.',
    })

    const { applyFromServer } = mountComposable(() => useOfflineDeficiencies())
    const result = await applyFromServer(
      {
        ...baseRow,
        etag: 'remote-etag',
        description: 'Remote wins unless skipped.',
        isDirty: false,
      },
      { strategy: 'keep-local-when-dirty' },
    )

    expect(result).toEqual({ applied: false, conflict: true })
    const stored = await db.deficiencies.get('def-m6s17')
    expect(stored?.description).toBe('Local pending edits.')
  })
})
