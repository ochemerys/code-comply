import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  LAST_SEEN_AT_STORAGE_KEY,
  isDeviceIdleExceeded,
  touchLastSeenAt,
  getMaxOfflineDays,
} from './device-idle'

describe('device-idle', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubEnv('VITE_MAX_OFFLINE_DAYS', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults max offline days to 30', () => {
    expect(getMaxOfflineDays()).toBe(30)
  })

  it('returns false when last seen is within the window', () => {
    const now = Date.UTC(2026, 4, 23)
    touchLastSeenAt(now - 10 * 86_400_000)
    expect(isDeviceIdleExceeded(now)).toBe(false)
  })

  it('returns true when last seen exceeds the window', () => {
    const now = Date.UTC(2026, 4, 23)
    touchLastSeenAt(now - 31 * 86_400_000)
    expect(isDeviceIdleExceeded(now)).toBe(true)
  })

  it('persists last seen in localStorage', () => {
    touchLastSeenAt(12345)
    expect(localStorage.getItem(LAST_SEEN_AT_STORAGE_KEY)).toBe('12345')
  })
})
