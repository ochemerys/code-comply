/**
 * Integration tests for useCodeReference (M5-S7): composable + localStorage cache contract.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useCodeReference, CODE_REFERENCE_LIBRARY_KEY } from '@/composables/useCodeReference'

vi.mock('@/lib/db/sync-engine', () => ({
  syncEngine: {
    resumeSync: vi.fn().mockResolvedValue(undefined),
    pauseSync: vi.fn(),
    setAuthCheck: vi.fn(),
  },
}))

describe('useCodeReference integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    global.fetch = vi.fn()
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    useAuthStore().accessToken = 'tok'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('merges API search results into the offline library for later offline search', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [{ code: 'NBC', section: '9.10.1', title: 'Smoke' }],
    } as Response)

    const { search } = useCodeReference()
    await search('smoke')

    const stored = localStorage.getItem(CODE_REFERENCE_LIBRARY_KEY)
    expect(stored).toBeTruthy()
    const parsed = JSON.parse(stored!) as { entries: { code: string; section: string }[] }
    expect(parsed.entries.some((e) => e.code === 'NBC' && e.section === '9.10.1')).toBe(true)
  })

  it('offline search reads merged library without calling the network', async () => {
    localStorage.setItem(
      CODE_REFERENCE_LIBRARY_KEY,
      JSON.stringify({
        entries: [
          {
            code: 'ABC',
            section: '1.1.1',
            title: 'Beam',
            cachedAt: new Date().toISOString(),
          },
        ],
      }),
    )
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    const { search, searchResults } = useCodeReference()
    await search('beam')

    expect(fetch).not.toHaveBeenCalled()
    expect(searchResults.value[0]?.code).toBe('ABC')
  })
})
