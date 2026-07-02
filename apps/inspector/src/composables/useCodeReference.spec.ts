/**
 * Unit tests for useCodeReference (M5-S7)
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import {
  useCodeReference,
  CODE_REFERENCE_LIBRARY_KEY,
  CODE_REFERENCE_RECENT_KEY,
  CODE_REFERENCE_CACHE_MS,
} from './useCodeReference'

vi.mock('@/lib/db/sync-engine', () => ({
  syncEngine: {
    resumeSync: vi.fn().mockResolvedValue(undefined),
    pauseSync: vi.fn(),
    setAuthCheck: vi.fn(),
  },
}))

describe('useCodeReference', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
    global.fetch = vi.fn()
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    const auth = useAuthStore()
    auth.accessToken = 'test-access-token'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('search returns results from API when online', async () => {
    const payload = [{ id: '1', code: 'NBC', section: '9.10.1', title: 'Fire separation' }]
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => payload,
    } as Response)

    const { search, searchResults, isSearching } = useCodeReference()
    await search('fire')

    expect(isSearching.value).toBe(false)
    expect(searchResults.value).toEqual([
      { code: 'NBC', section: '9.10.1', title: 'Fire separation' },
    ])
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/codes?q='),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-access-token',
        }),
      }),
    )
  })

  it('select returns resolved code from API', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'NBC', section: '9.23.1', title: 'Framing' }),
    } as Response)

    const { select, recentCodes } = useCodeReference()
    const result = await select('NBC', '9.23.1')

    expect(result).toEqual({ code: 'NBC', section: '9.23.1', title: 'Framing' })
    expect(recentCodes.value[0]).toEqual(result)
  })

  it('recent codes are capped at the configured limit', async () => {
    const { select, recentCodes } = useCodeReference()
    for (let i = 0; i < 12; i++) {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: 'NBC', section: `s-${i}` }),
      } as Response)
      await select('NBC', `s-${i}`)
    }
    expect(recentCodes.value.length).toBe(10)
  })

  it('search uses cached library when offline', async () => {
    localStorage.setItem(
      CODE_REFERENCE_LIBRARY_KEY,
      JSON.stringify({
        entries: [
          {
            code: 'NBC',
            section: '3.1.1',
            title: 'General',
            cachedAt: new Date().toISOString(),
          },
        ],
      }),
    )

    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    const { search, searchResults } = useCodeReference()
    await search('general')

    expect(fetch).not.toHaveBeenCalled()
    expect(searchResults.value).toEqual([{ code: 'NBC', section: '3.1.1', title: 'General' }])
  })

  it('select resolves from library cache when offline', async () => {
    localStorage.setItem(
      CODE_REFERENCE_LIBRARY_KEY,
      JSON.stringify({
        entries: [
          {
            code: 'NBC',
            section: '9.23.1',
            title: 'Cached',
            cachedAt: new Date().toISOString(),
          },
        ],
      }),
    )
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    const { select } = useCodeReference()
    const r = await select('NBC', '9.23.1')
    expect(r).toEqual({ code: 'NBC', section: '9.23.1', title: 'Cached' })
  })

  it('clearSearch resets results and isSearching', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [{ code: 'A', section: '1', title: 'x' }],
    } as Response)

    const { search, searchResults, clearSearch, isSearching } = useCodeReference()
    const p = search('x')
    expect(isSearching.value).toBe(true)
    await p
    expect(searchResults.value.length).toBe(1)
    clearSearch()
    expect(searchResults.value).toEqual([])
    expect(isSearching.value).toBe(false)
  })

  it('drops stale library entries older than cache duration', async () => {
    const old = new Date(Date.now() - CODE_REFERENCE_CACHE_MS - 60_000).toISOString()
    localStorage.setItem(
      CODE_REFERENCE_LIBRARY_KEY,
      JSON.stringify({
        entries: [{ code: 'OLD', section: '1', cachedAt: old }],
      }),
    )
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    const { search, searchResults } = useCodeReference()
    await search('OLD')
    expect(searchResults.value).toEqual([])
  })

  it('persists recent in localStorage', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'NBC', section: '1.2.3' }),
    } as Response)

    const { select } = useCodeReference()
    await select('NBC', '1.2.3')

    const raw = localStorage.getItem(CODE_REFERENCE_RECENT_KEY)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!) as { ref: { code: string; section: string } }[]
    expect(parsed[0].ref.section).toBe('1.2.3')
  })
})
