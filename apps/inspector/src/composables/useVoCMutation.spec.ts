/**
 * Unit tests for useVoCMutation (M10-S13).
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createApp } from 'vue'
import { createPinia, setActivePinia, getActivePinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { useVoCMutation } from './useVoCMutation'
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
    },
  },
}))

vi.mock('@/lib/db/sync-engine', () => ({
  syncEngine: {
    queueMutation: vi.fn(),
  },
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

const baseRow: LocalDeficiency = {
  id: 'def-1',
  clientId: 'client-1',
  inspectionId: 'insp-1',
  createdById: 'user-1',
  description: 'Test deficiency',
  severity: 'MAJOR',
  status: 'OPEN',
  isStopWork: false,
  isUnsafe: false,
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
  isDirty: false,
}

const vocPayload = {
  verificationDate: '2026-05-14T12:00:00.000Z',
  sectionTitle: 'NBC §9.10.1',
  title: 'Fire separation',
  name: 'Jane Contractor',
  method: 'WRITTEN_ASSURANCE' as const,
}

describe('useVoCMutation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    const network = useNetworkStore()
    network.isOnline = true
    vi.mocked(db.deficiencies.get).mockResolvedValue({ ...baseRow })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('submits VoC online and updates local deficiency', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: 'voc-1',
        deficiencyId: 'def-1',
        submittedAt: '2026-05-14T12:05:00.000Z',
        status: 'PENDING',
      }),
    } as unknown as Response)

    const { submitVoC } = withSetup(() => useVoCMutation())
    const result = await submitVoC.mutateAsync({ deficiencyId: 'def-1', payload: vocPayload })

    expect(result.status).toBe('VOC_SUBMITTED')
    expect(result.isDirty).toBe(false)
    expect(apiFetch).toHaveBeenCalledWith(
      expect.stringContaining('/deficiencies/def-1/voc'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(syncEngine.queueMutation).not.toHaveBeenCalled()
  })

  it('queues VoC submission when offline', async () => {
    const network = useNetworkStore()
    network.isOnline = false

    const { submitVoC } = withSetup(() => useVoCMutation())
    const result = await submitVoC.mutateAsync({ deficiencyId: 'def-1', payload: vocPayload })

    expect(result.status).toBe('VOC_SUBMITTED')
    expect(result.isDirty).toBe(true)
    expect(syncEngine.queueMutation).toHaveBeenCalledWith(
      'deficiency.voc.submit',
      { deficiencyId: 'def-1', payload: vocPayload },
      5,
    )
  })

  it('throws when deficiency is missing', async () => {
    vi.mocked(db.deficiencies.get).mockResolvedValue(undefined)
    const { submitVoC } = withSetup(() => useVoCMutation())
    await expect(
      submitVoC.mutateAsync({ deficiencyId: 'missing', payload: vocPayload }),
    ).rejects.toThrow(/not found/i)
  })

  it('rolls back optimistic update when online API fails', async () => {
    vi.useFakeTimers({ now: new Date('2026-05-14T12:00:00.000Z') })
    vi.mocked(apiFetch).mockResolvedValue({
      ok: false,
      text: vi.fn().mockResolvedValue('Conflict'),
    } as unknown as Response)
    vi.mocked(db.deficiencies.get)
      .mockResolvedValueOnce({ ...baseRow })
      .mockResolvedValueOnce({
        ...baseRow,
        status: 'VOC_SUBMITTED',
        updatedAt: '2026-05-14T12:00:00.000Z',
        isDirty: true,
      })

    const { submitVoC } = withSetup(() => useVoCMutation())
    await expect(
      submitVoC.mutateAsync({ deficiencyId: 'def-1', payload: vocPayload }),
    ).rejects.toThrow(/Conflict/)
    expect(db.deficiencies.put).toHaveBeenCalledWith(expect.objectContaining({ status: 'OPEN' }))
    vi.useRealTimers()
  })
})
