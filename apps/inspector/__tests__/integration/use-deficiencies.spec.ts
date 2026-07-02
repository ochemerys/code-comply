/**
 * Integration tests: useDeficiencies + real Dexie (M6-S6).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createApp } from 'vue'
import { createPinia, setActivePinia, getActivePinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { db } from '@/lib/db/dexie'
import { useDeficiencies } from '@/composables/useDeficiencies'
import { useNetworkStore } from '@/stores/network'
import { apiFetch } from '@/utils/api-error-handler'

vi.mock('@/utils/api-error-handler', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    user: { id: 'user-int-def-list' },
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

describe('useDeficiencies integration', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await db.deficiencies.clear()
    vi.clearAllMocks()
    useNetworkStore().isOnline = true
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('serves IndexedDB-only list when offline including pending offline id', async () => {
    useNetworkStore().isOnline = false
    await db.deficiencies.put({
      id: 'offline-c-xyz',
      clientId: 'c-xyz',
      inspectionId: 'insp-int-1',
      createdById: 'user-int-def-list',
      description: 'Offline pending deficiency text',
      severity: 'MAJOR',
      status: 'OPEN',
      isStopWork: false,
      isUnsafe: false,
      createdAt: '2026-04-02T10:00:00.000Z',
      updatedAt: '2026-04-02T10:00:00.000Z',
      isDirty: true,
    })

    const { deficiencies, isLoading } = mountComposable(() => useDeficiencies())
    await vi.waitFor(() => expect(isLoading.value).toBe(false))

    expect(deficiencies.value.some((d) => d.id === 'offline-c-xyz')).toBe(true)
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('persists clean server rows to IndexedDB after online fetch', async () => {
    const dto = {
      id: 'srv-def-int-1',
      clientId: 'cl-int-1',
      inspectionId: 'insp-merge',
      description: 'Synced deficiency description text',
      severity: 'MINOR',
      status: 'OPEN',
      isStopWork: false,
      isUnsafe: false,
      createdAt: '2026-04-03T12:00:00.000Z',
      updatedAt: '2026-04-03T12:00:00.000Z',
    }
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([dto]),
      text: vi.fn(),
    } as unknown as Response)

    const { deficiencies, isLoading } = mountComposable(() =>
      useDeficiencies({ inspectionId: 'insp-merge' }),
    )
    await vi.waitFor(() => expect(isLoading.value).toBe(false))

    expect(deficiencies.value).toHaveLength(1)
    const stored = await db.deficiencies.get('srv-def-int-1')
    expect(stored?.description).toBe('Synced deficiency description text')
    expect(stored?.isDirty).toBe(false)
  })

  it('does not overwrite dirty local row when persisting server list', async () => {
    await db.deficiencies.put({
      id: 'dirty-same',
      clientId: 'c-d',
      inspectionId: 'insp-1',
      createdById: 'user-int-def-list',
      description: 'Local dirty text goes here ok',
      severity: 'CRITICAL',
      status: 'OPEN',
      isStopWork: true,
      isUnsafe: false,
      createdAt: '2026-04-01T08:00:00.000Z',
      updatedAt: '2026-04-04T08:00:00.000Z',
      isDirty: true,
    })

    const dto = {
      id: 'dirty-same',
      clientId: 'c-d',
      inspectionId: 'insp-1',
      description: 'Server would say this',
      severity: 'MINOR',
      status: 'CLOSED',
      isStopWork: false,
      isUnsafe: false,
      createdAt: '2026-04-01T08:00:00.000Z',
      updatedAt: '2026-04-05T09:00:00.000Z',
    }
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([dto]),
      text: vi.fn(),
    } as unknown as Response)

    const { deficiencies, isLoading } = mountComposable(() => useDeficiencies())
    await vi.waitFor(() => expect(isLoading.value).toBe(false))

    const shown = deficiencies.value.find((d) => d.id === 'dirty-same')
    expect(shown?.description).toBe('Local dirty text goes here ok')
    expect(shown?.isDirty).toBe(true)

    const stored = await db.deficiencies.get('dirty-same')
    expect(stored?.description).toBe('Local dirty text goes here ok')
  })
})
