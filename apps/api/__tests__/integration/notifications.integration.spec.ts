import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { User } from '@codecomply/db'
import { authService } from '../../src/services/auth.service.js'
import { pushNotificationService } from '../../src/services/push-notification.service.js'

vi.mock('../../src/services/auth.service.js', () => ({
  authService: { validateToken: vi.fn() },
}))

vi.mock('../../src/services/push-notification.service.js', () => ({
  isPushConfigured: vi.fn(() => true),
  pushNotificationService: {
    upsertSubscription: vi.fn(),
    removeSubscription: vi.fn(),
    sendTestNotification: vi.fn(),
  },
}))

const scoUser = {
  id: 'sco-push-1',
  email: 'sco@example.com',
  name: 'SCO',
  role: 'SCO',
} as User

const adminUser = {
  id: 'admin-push-1',
  email: 'admin@example.com',
  name: 'Admin',
  role: 'ADMIN',
} as User

describe('Notifications integration (NFR-M-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inspector can subscribe', async () => {
    vi.mocked(authService.validateToken).mockResolvedValue(scoUser)
    vi.mocked(pushNotificationService.upsertSubscription).mockResolvedValue({
      id: 'sub-1',
    } as never)

    const { app } = await import('../../src/app.js')
    const res = await app.request('/api/notifications/subscribe', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer sco-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint: 'https://push.example/sub/1',
        deviceId: 'device-abc',
        keys: { p256dh: 'key', auth: 'secret' },
      }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'sub-1', subscribed: true })
    expect(pushNotificationService.upsertSubscription).toHaveBeenCalledWith(
      'sco-push-1',
      expect.objectContaining({ deviceId: 'device-abc' }),
    )
  })

  it('admin can send test push', async () => {
    vi.mocked(authService.validateToken).mockResolvedValue(adminUser)
    vi.mocked(pushNotificationService.sendTestNotification).mockResolvedValue({
      sent: 1,
      failed: 0,
    })

    const { app } = await import('../../src/app.js')
    const res = await app.request('/api/notifications/test', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer admin-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: 'sco-push-1', path: '/permits/p-99' }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sent: 1, failed: 0 })
    expect(pushNotificationService.sendTestNotification).toHaveBeenCalledWith(
      'sco-push-1',
      expect.objectContaining({ path: '/permits/p-99' }),
    )
  })

  it('inspector cannot call admin test endpoint', async () => {
    vi.mocked(authService.validateToken).mockResolvedValue(scoUser)

    const { app } = await import('../../src/app.js')
    const res = await app.request('/api/notifications/test', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer sco-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(403)
  })
})
