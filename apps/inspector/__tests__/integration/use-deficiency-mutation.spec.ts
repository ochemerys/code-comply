/**
 * Integration tests: useDeficiencyMutation + real Dexie (M6-S5).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createApp } from 'vue'
import { createPinia, setActivePinia, getActivePinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { db } from '@/lib/db/dexie'
import { syncEngine } from '@/lib/db/sync-engine'
import { useDeficiencyMutation } from '@/composables/useDeficiencyMutation'
import { useNetworkStore } from '@/stores/network'
import { apiFetch } from '@/utils/api-error-handler'

vi.mock('@/utils/api-error-handler', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('@/lib/db/sync-engine', () => ({
  syncEngine: {
    queueMutation: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    user: { id: 'user-int-1' },
    accessToken: 'token',
  })),
}))

function mountComposable<T>(fn: () => T): T {
  let result!: T
  const app = createApp({
    setup() {
      result = fn()
      return () => {}
    },
  })
  app.use(getActivePinia()!)
  app.use(VueQueryPlugin)
  app.mount(document.createElement('div'))
  return result
}

describe('useDeficiencyMutation integration', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await db.deficiencies.clear()
    await db.syncQueue.clear()
    vi.clearAllMocks()
    const network = useNetworkStore()
    network.isOnline = true
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('persists offline create to IndexedDB and enqueues sync', async () => {
    useNetworkStore().isOnline = false
    const { createDeficiency } = mountComposable(() => useDeficiencyMutation())
    await createDeficiency.mutateAsync({
      clientId: 'c-offline-1',
      inspectionId: 'insp-1',
      description: 'Integration test deficiency text',
      severity: 'MAJOR',
      isStopWork: false,
      isUnsafe: false,
    })
    const stored = await db.deficiencies.get('offline-c-offline-1')
    expect(stored?.description).toBe('Integration test deficiency text')
    expect(stored?.isDirty).toBe(true)
    expect(syncEngine.queueMutation).toHaveBeenCalledWith(
      'deficiency.create',
      expect.objectContaining({ clientId: 'c-offline-1' }),
      10,
    )
  })

  it('replaces optimistic row after online create', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: 'srv-def-1',
        clientId: 'c-online-1',
        inspectionId: 'insp-1',
        description: 'Integration test deficiency text',
        severity: 'MAJOR',
        status: 'OPEN',
        isStopWork: false,
        isUnsafe: false,
        createdAt: '2026-04-02T12:00:00.000Z',
        updatedAt: '2026-04-02T12:00:00.000Z',
      }),
      headers: { get: () => '"et-1"' },
    } as unknown as Response)

    const { createDeficiency } = mountComposable(() => useDeficiencyMutation())
    await createDeficiency.mutateAsync({
      clientId: 'c-online-1',
      inspectionId: 'insp-1',
      description: 'Integration test deficiency text',
      severity: 'MAJOR',
      isStopWork: false,
      isUnsafe: false,
    })

    expect(await db.deficiencies.get('optimistic-c-online-1')).toBeUndefined()
    const synced = await db.deficiencies.get('srv-def-1')
    expect(synced?.id).toBe('srv-def-1')
    expect(synced?.isDirty).toBe(false)
  })

  it('rolls back IndexedDB after failed online update', async () => {
    await db.deficiencies.put({
      id: 'def-rollback',
      clientId: 'cr-1',
      inspectionId: 'insp-1',
      createdById: 'user-int-1',
      description: 'Before rollback description text',
      severity: 'MINOR',
      status: 'OPEN',
      isStopWork: false,
      isUnsafe: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      isDirty: false,
      etag: 'e-orig',
    })

    vi.mocked(apiFetch).mockResolvedValue({
      ok: false,
      text: vi.fn().mockResolvedValue(JSON.stringify({ error: 'Conflict' })),
    } as unknown as Response)

    const { updateDeficiency } = mountComposable(() => useDeficiencyMutation())
    await expect(
      updateDeficiency.mutateAsync({
        id: 'def-rollback',
        updates: { description: 'After failed update description' },
      }),
    ).rejects.toThrow()

    const row = await db.deficiencies.get('def-rollback')
    expect(row?.description).toBe('Before rollback description text')
    expect(row?.etag).toBe('e-orig')
  })

  it('issues Stop Work offline with high-priority queue entry', async () => {
    useNetworkStore().isOnline = false
    await db.deficiencies.put({
      id: 'def-swo',
      clientId: 'c-swo',
      inspectionId: 'insp-1',
      createdById: 'user-int-1',
      description: 'Integration stop work deficiency description text',
      severity: 'MAJOR',
      status: 'OPEN',
      isStopWork: false,
      isUnsafe: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      isDirty: false,
    })

    const { issueStopWorkOrder } = mountComposable(() => useDeficiencyMutation())
    await issueStopWorkOrder.mutateAsync({ id: 'def-swo' })

    const stored = await db.deficiencies.get('def-swo')
    expect(stored?.isStopWork).toBe(true)
    expect(stored?.isDirty).toBe(true)
    expect(syncEngine.queueMutation).toHaveBeenCalledWith(
      'deficiency.update',
      expect.objectContaining({ id: 'def-swo', isStopWork: true }),
      1,
    )
  })

  it('issues Stop Work online via POST then refreshes from GET', async () => {
    await db.deficiencies.put({
      id: 'def-swo-on',
      clientId: 'c-swo-on',
      inspectionId: 'insp-1',
      createdById: 'user-int-1',
      description: 'Online stop work deficiency description text',
      severity: 'MAJOR',
      status: 'OPEN',
      isStopWork: false,
      isUnsafe: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      isDirty: false,
      etag: 'e0',
    })

    vi.mocked(apiFetch)
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'swo-1',
          deficiencyId: 'def-swo-on',
          inspectionId: 'insp-1',
          issuedAt: '2026-04-05T14:00:00.000Z',
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'def-swo-on',
          clientId: 'c-swo-on',
          inspectionId: 'insp-1',
          description: 'Online stop work deficiency description text',
          severity: 'MAJOR',
          status: 'OPEN',
          isStopWork: true,
          isUnsafe: false,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-04-05T14:00:00.000Z',
        }),
        headers: { get: () => '"e1"' },
      } as unknown as Response)

    const { issueStopWorkOrder } = mountComposable(() => useDeficiencyMutation())
    await issueStopWorkOrder.mutateAsync({ id: 'def-swo-on' })

    const stored = await db.deficiencies.get('def-swo-on')
    expect(stored?.isStopWork).toBe(true)
    expect(stored?.isDirty).toBe(false)
    expect(stored?.etag).toBe('e1')
    expect(vi.mocked(apiFetch).mock.calls[0]?.[0]).toContain('/deficiencies/def-swo-on/stop-work')
  })
})
