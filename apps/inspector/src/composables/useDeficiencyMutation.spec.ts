/**
 * Unit tests for useDeficiencyMutation (M6-S5).
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createApp } from 'vue'
import { createPinia, setActivePinia, getActivePinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { useDeficiencyMutation } from './useDeficiencyMutation'
import { db } from '@/lib/db/dexie'
import { syncEngine } from '@/lib/db/sync-engine'
import { apiFetch } from '@/utils/api-error-handler'
import { useNetworkStore } from '@/stores/network'
import type { LocalDeficiency } from '@/lib/db/types'

vi.mock('@/utils/api-error-handler', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('@/lib/db/dexie', () => ({
  db: {
    deficiencies: {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  },
}))

vi.mock('@/lib/db/sync-engine', () => ({
  syncEngine: {
    queueMutation: vi.fn(),
  },
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    user: { id: 'user-789' },
    accessToken: 'token',
  })),
}))

function withSetup<T>(composable: () => T): T {
  let result!: T
  const app = createApp({
    setup() {
      result = composable()
      return () => {}
    },
  })
  app.use(getActivePinia()!)
  app.use(VueQueryPlugin)
  app.mount(document.createElement('div'))
  return result
}

const basePayload = {
  clientId: 'client-uuid-1',
  inspectionId: 'insp-456',
  description: 'Test deficiency description',
  severity: 'MAJOR' as const,
  isStopWork: false,
  isUnsafe: false,
}

describe('useDeficiencyMutation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    const network = useNetworkStore()
    network.isOnline = true
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createDeficiency', () => {
    it('should create deficiency online and persist server row', async () => {
      const dto = {
        id: 'def-server-1',
        clientId: basePayload.clientId,
        inspectionId: basePayload.inspectionId,
        description: basePayload.description,
        severity: 'MAJOR' as const,
        status: 'OPEN' as const,
        isStopWork: false,
        isUnsafe: false,
        createdAt: '2026-04-01T10:00:00.000Z',
        updatedAt: '2026-04-01T10:00:00.000Z',
      }
      vi.mocked(apiFetch).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(dto),
        headers: { get: () => '"etag-1"' },
      } as unknown as Response)

      const { createDeficiency } = withSetup(() => useDeficiencyMutation())
      const result = await createDeficiency.mutateAsync(basePayload)

      expect(result.id).toBe('def-server-1')
      expect(result.isDirty).toBe(false)
      expect(db.deficiencies.put).toHaveBeenCalled()
      expect(db.deficiencies.delete).toHaveBeenCalledWith(`optimistic-${basePayload.clientId}`)
      expect(syncEngine.queueMutation).not.toHaveBeenCalled()
    })

    it('should queue and save locally when offline', async () => {
      const network = useNetworkStore()
      network.isOnline = false

      const { createDeficiency } = withSetup(() => useDeficiencyMutation())
      const result = await createDeficiency.mutateAsync(basePayload)

      expect(result.id).toBe(`offline-${basePayload.clientId}`)
      expect(result.isDirty).toBe(true)
      expect(db.deficiencies.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: `offline-${basePayload.clientId}`,
          clientId: basePayload.clientId,
        }),
      )
      expect(syncEngine.queueMutation).toHaveBeenCalledWith(
        'deficiency.create',
        expect.objectContaining({ clientId: basePayload.clientId }),
        10,
      )
      expect(apiFetch).not.toHaveBeenCalled()
    })

    it('should rollback optimistic row when API fails', async () => {
      vi.mocked(apiFetch).mockResolvedValue({
        ok: false,
        text: vi.fn().mockResolvedValue(JSON.stringify({ error: 'Bad Request' })),
      } as unknown as Response)

      const { createDeficiency } = withSetup(() => useDeficiencyMutation())

      await expect(createDeficiency.mutateAsync(basePayload)).rejects.toThrow()
      expect(db.deficiencies.delete).toHaveBeenCalledWith(`optimistic-${basePayload.clientId}`)
    })

    it('should use high sync priority for CRITICAL severity', async () => {
      const network = useNetworkStore()
      network.isOnline = false

      const { createDeficiency } = withSetup(() => useDeficiencyMutation())
      await createDeficiency.mutateAsync({
        ...basePayload,
        severity: 'CRITICAL',
      })

      expect(syncEngine.queueMutation).toHaveBeenCalledWith(
        'deficiency.create',
        expect.any(Object),
        1,
      )
    })

    it('should use high sync priority when isUnsafe on create (M6-S16)', async () => {
      const network = useNetworkStore()
      network.isOnline = false

      const { createDeficiency } = withSetup(() => useDeficiencyMutation())
      await createDeficiency.mutateAsync({
        ...basePayload,
        isUnsafe: true,
      })

      expect(syncEngine.queueMutation).toHaveBeenCalledWith(
        'deficiency.create',
        expect.objectContaining({ isUnsafe: true }),
        1,
      )
    })
  })

  describe('updateDeficiency', () => {
    const prev: LocalDeficiency = {
      id: 'def-1',
      clientId: 'c1',
      inspectionId: 'insp-1',
      createdById: 'user-789',
      description: 'Original description text',
      severity: 'MINOR',
      status: 'OPEN',
      isStopWork: false,
      isUnsafe: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      isDirty: false,
      etag: 'e1',
      checklistItemId: 'item-1',
    }

    it('should PATCH online and merge checklistItemId from previous local row', async () => {
      vi.mocked(db.deficiencies.get).mockResolvedValue(prev)
      const dto = {
        ...prev,
        description: 'Updated description text',
        updatedAt: '2026-01-02T00:00:00.000Z',
      }
      vi.mocked(apiFetch).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(dto),
        headers: { get: () => '"etag-2"' },
      } as unknown as Response)

      const { updateDeficiency } = withSetup(() => useDeficiencyMutation())
      const result = await updateDeficiency.mutateAsync({
        id: 'def-1',
        updates: { description: 'Updated description text' },
      })

      expect(result.description).toBe('Updated description text')
      expect(result.checklistItemId).toBe('item-1')
      expect(apiFetch).toHaveBeenCalled()
    })

    it('should queue update when offline', async () => {
      vi.mocked(db.deficiencies.get).mockResolvedValue(prev)
      const network = useNetworkStore()
      network.isOnline = false

      const { updateDeficiency } = withSetup(() => useDeficiencyMutation())
      await updateDeficiency.mutateAsync({
        id: 'def-1',
        updates: { description: 'Updated description text' },
      })

      expect(syncEngine.queueMutation).toHaveBeenCalledWith(
        'deficiency.update',
        expect.objectContaining({ description: 'Updated description text', isDirty: true }),
        10,
      )
      expect(apiFetch).not.toHaveBeenCalled()
    })

    it('should use high sync priority when offline update marks unsafe (M6-S16)', async () => {
      vi.mocked(db.deficiencies.get).mockResolvedValue(prev)
      useNetworkStore().isOnline = false

      const { updateDeficiency } = withSetup(() => useDeficiencyMutation())
      await updateDeficiency.mutateAsync({
        id: 'def-1',
        updates: { isUnsafe: true },
      })

      expect(syncEngine.queueMutation).toHaveBeenCalledWith(
        'deficiency.update',
        expect.objectContaining({ isUnsafe: true, isDirty: true }),
        1,
      )
    })

    it('should restore previous row when PATCH fails', async () => {
      let stored: LocalDeficiency | undefined
      const table = db.deficiencies as unknown as {
        get: { mockImplementation: (fn: () => Promise<LocalDeficiency | undefined>) => void }
        put: { mockImplementation: (fn: (r: LocalDeficiency) => Promise<string>) => void }
      }
      table.get.mockImplementation(async () => stored ?? prev)
      table.put.mockImplementation(async (r: LocalDeficiency) => {
        stored = { ...r }
        return r.id
      })
      vi.mocked(apiFetch).mockResolvedValue({
        ok: false,
        text: vi.fn().mockResolvedValue('{}'),
      } as unknown as Response)

      const { updateDeficiency } = withSetup(() => useDeficiencyMutation())
      await expect(
        updateDeficiency.mutateAsync({
          id: 'def-1',
          updates: { description: 'Updated description text' },
        }),
      ).rejects.toThrow()
      expect(db.deficiencies.put).toHaveBeenCalledWith(prev)
    })

    it('should not rollback over a newer local row when PATCH fails', async () => {
      const concurrent: LocalDeficiency = {
        ...prev,
        description: 'Written elsewhere',
        updatedAt: '2099-01-01T00:00:00.000Z',
        isDirty: true,
      }
      let stored: LocalDeficiency | undefined
      const table = db.deficiencies as unknown as {
        get: { mockImplementation: (fn: () => Promise<LocalDeficiency | undefined>) => void }
        put: { mockImplementation: (fn: (r: LocalDeficiency) => Promise<string>) => void }
      }
      table.get.mockImplementation(async () => stored ?? prev)
      table.put.mockImplementation(async (r: LocalDeficiency) => {
        stored = { ...r }
        stored = { ...concurrent }
        return r.id
      })
      vi.mocked(apiFetch).mockResolvedValue({
        ok: false,
        text: vi.fn().mockResolvedValue('{}'),
      } as unknown as Response)

      const { updateDeficiency } = withSetup(() => useDeficiencyMutation())
      await expect(
        updateDeficiency.mutateAsync({
          id: 'def-1',
          updates: { description: 'Updated description text' },
        }),
      ).rejects.toThrow()
      expect(vi.mocked(db.deficiencies.put).mock.calls.some((c) => c[0] === prev)).toBe(false)
    })
  })

  describe('deleteDeficiency', () => {
    it('should DELETE online and rollback on failure', async () => {
      const row: LocalDeficiency = {
        id: 'def-1',
        clientId: 'c1',
        inspectionId: 'insp-1',
        createdById: 'u1',
        description: 'Some description text',
        severity: 'MAJOR',
        status: 'OPEN',
        isStopWork: false,
        isUnsafe: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        isDirty: false,
        syncedAt: '2026-01-01T00:00:00.000Z',
      }
      let present: LocalDeficiency | undefined = row
      const table = db.deficiencies as unknown as {
        get: {
          mockImplementation: (fn: (id: string) => Promise<LocalDeficiency | undefined>) => void
        }
        delete: { mockImplementation: (fn: (id: string) => Promise<void>) => void }
      }
      table.get.mockImplementation(async (idArg) => {
        if (idArg !== 'def-1') return undefined
        return present
      })
      table.delete.mockImplementation(async (idArg) => {
        if (idArg === 'def-1') present = undefined
      })
      vi.mocked(apiFetch).mockResolvedValue({
        ok: false,
        text: vi.fn().mockResolvedValue(JSON.stringify({ error: 'nope' })),
      } as unknown as Response)

      const { deleteDeficiency } = withSetup(() => useDeficiencyMutation())
      await expect(deleteDeficiency.mutateAsync({ id: 'def-1' })).rejects.toThrow()
      expect(db.deficiencies.put).toHaveBeenCalledWith(row)
    })

    it('should delete locally when offline without queue if never synced', async () => {
      const row: LocalDeficiency = {
        id: 'def-local',
        clientId: 'c1',
        inspectionId: 'insp-1',
        createdById: 'u1',
        description: 'Some description text',
        severity: 'MAJOR',
        status: 'OPEN',
        isStopWork: false,
        isUnsafe: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        isDirty: true,
      }
      vi.mocked(db.deficiencies.get).mockResolvedValue(row)
      const network = useNetworkStore()
      network.isOnline = false

      const { deleteDeficiency } = withSetup(() => useDeficiencyMutation())
      await deleteDeficiency.mutateAsync({ id: 'def-local' })

      expect(db.deficiencies.delete).toHaveBeenCalledWith('def-local')
      expect(syncEngine.queueMutation).not.toHaveBeenCalled()
    })

    it('should queue delete when offline and row was synced', async () => {
      const row: LocalDeficiency = {
        id: 'def-1',
        clientId: 'c1',
        inspectionId: 'insp-1',
        createdById: 'u1',
        description: 'Some description text',
        severity: 'MAJOR',
        status: 'OPEN',
        isStopWork: false,
        isUnsafe: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        isDirty: false,
        syncedAt: '2026-01-01T00:00:00.000Z',
      }
      vi.mocked(db.deficiencies.get).mockResolvedValue(row)
      const network = useNetworkStore()
      network.isOnline = false

      const { deleteDeficiency } = withSetup(() => useDeficiencyMutation())
      await deleteDeficiency.mutateAsync({ id: 'def-1' })

      expect(syncEngine.queueMutation).toHaveBeenCalledWith(
        'deficiency.delete',
        { clientId: 'c1', id: 'def-1' },
        10,
      )
    })
  })

  describe('issueStopWorkOrder', () => {
    const baseRow: LocalDeficiency = {
      id: 'def-sw',
      clientId: 'c-sw',
      inspectionId: 'insp-1',
      createdById: 'u1',
      description: 'Stop work test deficiency description',
      severity: 'CRITICAL',
      status: 'OPEN',
      isStopWork: false,
      isUnsafe: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      isDirty: false,
      etag: 'e-sw',
    }

    it('should set Stop Work offline when navigator.onLine is false even if store is still online', async () => {
      vi.mocked(db.deficiencies.get).mockResolvedValue(baseRow)
      useNetworkStore().isOnline = true
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      vi.mocked(syncEngine.queueMutation).mockResolvedValue('queued-offline-sw')
      vi.mocked(db.deficiencies.put).mockResolvedValue('def-sw')

      const { issueStopWorkOrder } = withSetup(() => useDeficiencyMutation())
      const out = await issueStopWorkOrder.mutateAsync({ id: 'def-sw' })

      expect(out.isStopWork).toBe(true)
      expect(apiFetch).not.toHaveBeenCalled()
      expect(syncEngine.queueMutation).toHaveBeenCalled()
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    })

    it('should set Stop Work offline and queue update at high priority', async () => {
      vi.mocked(db.deficiencies.get).mockResolvedValue(baseRow)
      useNetworkStore().isOnline = false
      vi.mocked(syncEngine.queueMutation).mockResolvedValue(undefined)
      vi.mocked(db.deficiencies.put).mockResolvedValue('def-sw')

      const { issueStopWorkOrder } = withSetup(() => useDeficiencyMutation())
      const out = await issueStopWorkOrder.mutateAsync({ id: 'def-sw' })

      expect(out.isStopWork).toBe(true)
      expect(out.isDirty).toBe(true)
      expect(syncEngine.queueMutation).toHaveBeenCalledWith(
        'deficiency.update',
        expect.objectContaining({ id: 'def-sw', isStopWork: true }),
        1,
      )
    })

    it('should no-op when already Stop Work', async () => {
      vi.mocked(db.deficiencies.get).mockResolvedValue({ ...baseRow, isStopWork: true })
      const { issueStopWorkOrder } = withSetup(() => useDeficiencyMutation())
      const out = await issueStopWorkOrder.mutateAsync({ id: 'def-sw' })
      expect(out.isStopWork).toBe(true)
      expect(syncEngine.queueMutation).not.toHaveBeenCalled()
      expect(apiFetch).not.toHaveBeenCalled()
    })

    it('should queue offline Stop Work when online POST fails with a network error', async () => {
      vi.mocked(db.deficiencies.get).mockResolvedValue(baseRow)
      useNetworkStore().isOnline = true
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
      vi.mocked(apiFetch).mockRejectedValue(new TypeError('Failed to fetch'))
      vi.mocked(syncEngine.queueMutation).mockResolvedValue('queued-network-fallback')
      vi.mocked(db.deficiencies.put).mockResolvedValue('def-sw')

      const { issueStopWorkOrder } = withSetup(() => useDeficiencyMutation())
      const out = await issueStopWorkOrder.mutateAsync({ id: 'def-sw' })

      expect(out.isStopWork).toBe(true)
      expect(out.isDirty).toBe(true)
      expect(syncEngine.queueMutation).toHaveBeenCalled()
    })

    it('should POST stop-work then GET deficiency when online', async () => {
      vi.mocked(db.deficiencies.get).mockResolvedValue(baseRow)
      vi.mocked(apiFetch)
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            id: 'swo-def-sw',
            deficiencyId: 'def-sw',
            inspectionId: 'insp-1',
            issuedAt: '2026-04-05T12:00:00.000Z',
          }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            id: 'def-sw',
            clientId: 'c-sw',
            inspectionId: 'insp-1',
            description: baseRow.description,
            severity: 'CRITICAL',
            status: 'OPEN',
            isStopWork: true,
            isUnsafe: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-04-05T12:00:00.000Z',
          }),
          headers: { get: () => '"e-new"' },
        } as unknown as Response)

      const { issueStopWorkOrder } = withSetup(() => useDeficiencyMutation())
      const out = await issueStopWorkOrder.mutateAsync({ id: 'def-sw' })

      expect(out.isStopWork).toBe(true)
      expect(out.isDirty).toBe(false)
      expect(apiFetch).toHaveBeenCalledTimes(2)
      expect(vi.mocked(apiFetch).mock.calls[0]?.[0]).toContain('/deficiencies/def-sw/stop-work')
    })
  })
})
