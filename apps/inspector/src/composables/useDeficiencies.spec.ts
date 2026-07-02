/**
 * Unit tests for useDeficiencies (M6-S6).
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createApp } from 'vue'
import { createPinia, setActivePinia, getActivePinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { useDeficiencies, mergeDeficiencyLists } from './useDeficiencies'
import { db } from '@/lib/db/dexie'
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
      put: vi.fn().mockResolvedValue(undefined),
      toArray: vi.fn(),
    },
  },
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    user: { id: 'user-list-1' },
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

function baseLocal(overrides: Partial<LocalDeficiency> = {}): LocalDeficiency {
  return {
    id: 'def-1',
    clientId: 'c1',
    inspectionId: 'insp-1',
    createdById: 'user-list-1',
    description: 'Description long enough',
    severity: 'MAJOR',
    status: 'OPEN',
    isStopWork: false,
    isUnsafe: false,
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-01T10:00:00.000Z',
    isDirty: false,
    ...overrides,
  }
}

describe('mergeDeficiencyLists', () => {
  it('prefers dirty local over server row with same id', () => {
    const server = [baseLocal({ id: 'a', description: 'server', isDirty: false })]
    const local = [baseLocal({ id: 'a', description: 'dirty local', isDirty: true })]
    const merged = mergeDeficiencyLists(server, local, undefined)
    expect(merged.find((m) => m.id === 'a')?.description).toBe('dirty local')
  })

  it('keeps offline- prefixed rows', () => {
    const local = [baseLocal({ id: 'offline-c1', isDirty: true })]
    const merged = mergeDeficiencyLists([], local, undefined)
    expect(merged).toHaveLength(1)
    expect(merged[0].id).toBe('offline-c1')
  })

  it('scopes locals by inspectionId when provided', () => {
    const local = [
      baseLocal({ id: 'x', inspectionId: 'insp-a' }),
      baseLocal({ id: 'y', inspectionId: 'insp-b' }),
    ]
    const merged = mergeDeficiencyLists([], local, 'insp-a')
    expect(merged.map((m) => m.id)).toEqual(['x'])
  })
})

describe('useDeficiencies', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    useNetworkStore().isOnline = true
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads from API when online and exposes openCount and criticalCount', async () => {
    const dto = {
      id: 'srv-1',
      clientId: 'cl-1',
      inspectionId: 'insp-1',
      description: 'Server deficiency text here',
      severity: 'CRITICAL' as const,
      status: 'OPEN' as const,
      isStopWork: false,
      isUnsafe: false,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    }
    vi.mocked(db.deficiencies.toArray).mockResolvedValue([])
    vi.mocked(db.deficiencies.get).mockResolvedValue(undefined)
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([dto]),
      text: vi.fn(),
    } as unknown as Response)

    const { deficiencies, openCount, criticalCount, isLoading } = withSetup(() => useDeficiencies())

    await vi.waitFor(() => expect(isLoading.value).toBe(false))
    expect(deficiencies.value).toHaveLength(1)
    expect(deficiencies.value[0].id).toBe('srv-1')
    expect(openCount.value).toBe(1)
    expect(criticalCount.value).toBe(1)
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('/deficiencies'))
  })

  it('uses cached locals when offline', async () => {
    useNetworkStore().isOnline = false
    const cached = [
      baseLocal({ id: 'loc-1', status: 'CLOSED' }),
      baseLocal({ id: 'loc-2', status: 'OPEN', severity: 'CRITICAL' }),
    ]
    vi.mocked(db.deficiencies.toArray).mockResolvedValue(cached)

    const { deficiencies, openCount, criticalCount, isLoading } = withSetup(() => useDeficiencies())

    await vi.waitFor(() => expect(isLoading.value).toBe(false))
    expect(deficiencies.value).toHaveLength(2)
    expect(openCount.value).toBe(1)
    expect(criticalCount.value).toBe(1)
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('refresh refetches via query', async () => {
    vi.mocked(db.deficiencies.toArray).mockResolvedValue([])
    vi.mocked(db.deficiencies.get).mockResolvedValue(undefined)
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([]),
      text: vi.fn(),
    } as unknown as Response)

    const { refresh, isLoading } = withSetup(() => useDeficiencies())
    await vi.waitFor(() => expect(isLoading.value).toBe(false))
    await refresh()
    expect(apiFetch).toHaveBeenCalledTimes(2)
  })

  it('filterByStatus and filterBySeverity use current list', async () => {
    vi.mocked(db.deficiencies.toArray).mockResolvedValue([])
    vi.mocked(db.deficiencies.get).mockResolvedValue(undefined)
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([
        {
          id: 'a',
          clientId: 'c',
          inspectionId: 'i',
          description: 'Open major text ok',
          severity: 'MAJOR',
          status: 'OPEN',
          isStopWork: false,
          isUnsafe: false,
          createdAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-04-01T10:00:00.000Z',
        },
        {
          id: 'b',
          clientId: 'c',
          inspectionId: 'i',
          description: 'Closed minor text ok',
          severity: 'MINOR',
          status: 'CLOSED',
          isStopWork: false,
          isUnsafe: false,
          createdAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-04-01T11:00:00.000Z',
        },
      ]),
      text: vi.fn(),
    } as unknown as Response)

    const { filterByStatus, filterBySeverity, isLoading } = withSetup(() => useDeficiencies())
    await vi.waitFor(() => expect(isLoading.value).toBe(false))

    expect(filterByStatus('OPEN').map((d) => d.id)).toEqual(['a'])
    expect(filterBySeverity('MINOR').map((d) => d.id)).toEqual(['b'])
  })

  it('merges checklistItemId from local toArray snapshot without db.get per deficiency', async () => {
    const localWithLink = baseLocal({
      id: 'srv-1',
      checklistItemId: 'chk-item-42',
    })
    vi.mocked(db.deficiencies.toArray).mockResolvedValue([localWithLink])
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([
        {
          id: 'srv-1',
          clientId: 'cl-1',
          inspectionId: 'insp-1',
          description: 'Server deficiency text here',
          severity: 'MAJOR' as const,
          status: 'OPEN' as const,
          isStopWork: false,
          isUnsafe: false,
          createdAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-04-01T12:00:00.000Z',
        },
      ]),
      text: vi.fn(),
    } as unknown as Response)

    const { deficiencies, isLoading } = withSetup(() => useDeficiencies())
    await vi.waitFor(() => expect(isLoading.value).toBe(false))

    expect(deficiencies.value[0]?.checklistItemId).toBe('chk-item-42')
    expect(vi.mocked(db.deficiencies.get)).not.toHaveBeenCalled()
  })
})
