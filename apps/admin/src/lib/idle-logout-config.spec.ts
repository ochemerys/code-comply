import { describe, it, expect, vi, afterEach } from 'vitest'
import { getIdleLogoutConfig } from './idle-logout-config'

describe('getIdleLogoutConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses defaults when env vars are unset', () => {
    vi.stubEnv('VITE_IDLE_WARN_MS', '')
    vi.stubEnv('VITE_IDLE_LOGOUT_MS', '')
    expect(getIdleLogoutConfig()).toEqual({
      warnAfterMs: 14 * 60 * 1000,
      logoutAfterMs: 15 * 60 * 1000,
    })
  })

  it('reads warn and logout from Vite env', () => {
    vi.stubEnv('VITE_IDLE_WARN_MS', '60000')
    vi.stubEnv('VITE_IDLE_LOGOUT_MS', '120000')
    expect(getIdleLogoutConfig()).toEqual({
      warnAfterMs: 60000,
      logoutAfterMs: 120000,
    })
  })

  it('falls back to default logout when logout is not after warn', () => {
    vi.stubEnv('VITE_IDLE_WARN_MS', '120000')
    vi.stubEnv('VITE_IDLE_LOGOUT_MS', '60000')
    expect(getIdleLogoutConfig().logoutAfterMs).toBe(15 * 60 * 1000)
  })
})
