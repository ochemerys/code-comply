import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isPushApiSupported } from './usePushSubscription'

describe('usePushSubscription', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  describe('isPushApiSupported', () => {
    it('returns false when PushManager is missing', () => {
      expect(isPushApiSupported()).toBe(false)
    })

    it('returns true when PushManager, serviceWorker, and Notification exist', () => {
      vi.stubGlobal('Notification', { permission: 'default' })
      vi.stubGlobal('PushManager', class {})
      vi.stubGlobal('navigator', {
        serviceWorker: {},
      })
      expect(isPushApiSupported()).toBe(true)
    })
  })
})
