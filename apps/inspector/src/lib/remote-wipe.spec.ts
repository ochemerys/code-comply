import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import * as Sentry from '@sentry/vue'

vi.mock('./db', () => ({
  db: { clearAllData: vi.fn().mockResolvedValue(undefined) },
}))

vi.mock('./api-base', () => ({
  getApiBaseUrl: () => 'http://localhost:4000',
}))

vi.mock('@sentry/vue', () => ({
  addBreadcrumb: vi.fn(),
}))

const mockLogout = vi.fn().mockResolvedValue(undefined)

const authStore = {
  accessToken: ref('access-token'),
  refreshToken: ref('refresh-token'),
  logout: mockLogout,
  isAuthenticated: ref(true),
}

describe('remote-wipe (M11-S4)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { resetRemoteWipeCheckCache } = await import('./remote-wipe')
    resetRemoteWipeCheckCache()
    vi.stubGlobal('localStorage', {
      removeItem: vi.fn(),
      getItem: vi.fn(),
      setItem: vi.fn(),
    })
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue(['cache-v1']),
      delete: vi.fn().mockResolvedValue(true),
    })
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistrations: vi
          .fn()
          .mockResolvedValue([{ unregister: vi.fn().mockResolvedValue(true) }]),
      },
    })
  })

  it('clearLocalStorage removes auth keys', async () => {
    const { clearLocalStorage } = await import('./remote-wipe')
    clearLocalStorage()
    expect(localStorage.removeItem).toHaveBeenCalledWith('accessToken')
    expect(localStorage.removeItem).toHaveBeenCalledWith('refreshToken')
    expect(localStorage.removeItem).toHaveBeenCalledWith('inspector_user_profile')
  })

  it('executeRemoteWipe clears caches, db, storage, and logs out', async () => {
    const { executeRemoteWipe } = await import('./remote-wipe')
    const { db } = await import('./db')

    await executeRemoteWipe(authStore as any)

    expect(caches.keys).toHaveBeenCalled()
    expect(db.clearAllData).toHaveBeenCalled()
    expect(mockLogout).toHaveBeenCalled()
  })

  it('checkAndHandleRemoteWipe runs wipe flow when pending', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pending: true, message: 'Device wiped by administrator' }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'ok' }) })
    vi.stubGlobal('fetch', fetchMock)

    const { checkAndHandleRemoteWipe } = await import('./remote-wipe')
    const wiped = await checkAndHandleRemoteWipe(authStore as any)

    expect(wiped).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/device/remote-wipe/status',
      expect.any(Object),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/device/remote-wipe/confirm',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(mockLogout).toHaveBeenCalled()
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'remote-wipe',
        message: 'remote-wipe.check',
        data: expect.objectContaining({ outcome: 'wiped' }),
      }),
    )
  })

  it('checkAndHandleRemoteWipe is no-op when not pending', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ pending: false }),
      }),
    )

    const { checkAndHandleRemoteWipe } = await import('./remote-wipe')
    const wiped = await checkAndHandleRemoteWipe(authStore as any)

    expect(wiped).toBe(false)
    expect(mockLogout).not.toHaveBeenCalled()
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'remote-wipe',
        message: 'remote-wipe.check',
        data: expect.objectContaining({ outcome: 'success', pending: false }),
      }),
    )
  })

  it('runRemoteWipeCheck skips duplicate sync guards inside the cache window', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ pending: false }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { runRemoteWipeCheck, REMOTE_WIPE_SYNC_CACHE_TTL_MS } = await import('./remote-wipe')

    await runRemoteWipeCheck(authStore as any, {
      reason: 'sync-engine',
      cacheTtlMs: REMOTE_WIPE_SYNC_CACHE_TTL_MS,
      now: () => 1000,
    })
    const cached = await runRemoteWipeCheck(authStore as any, {
      reason: 'sync-engine',
      cacheTtlMs: REMOTE_WIPE_SYNC_CACHE_TTL_MS,
      now: () => 2000,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(cached).toMatchObject({ wiped: false, checked: false, skipped: true })
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'remote-wipe',
        message: 'remote-wipe.check',
        data: expect.objectContaining({ outcome: 'skipped-cached' }),
      }),
    )
  })
})
