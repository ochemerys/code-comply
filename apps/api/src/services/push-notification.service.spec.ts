import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PushNotificationService, isPushConfigured } from './push-notification.service'

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}))

vi.mock('@codecomply/db', () => ({
  prisma: {
    devicePushSubscription: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import webpush from 'web-push'
import { prisma } from '@codecomply/db'

describe('PushNotificationService', () => {
  const service = new PushNotificationService()

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.VAPID_PUBLIC_KEY
    delete process.env.VAPID_PRIVATE_KEY
  })

  it('isPushConfigured reflects env vars', () => {
    expect(isPushConfigured()).toBe(false)
    process.env.VAPID_PUBLIC_KEY = 'pub'
    process.env.VAPID_PRIVATE_KEY = 'priv'
    expect(isPushConfigured()).toBe(true)
  })

  it('upsertSubscription stores keys', async () => {
    vi.mocked(prisma.devicePushSubscription.upsert).mockResolvedValueOnce({
      id: 'sub-1',
    } as never)

    const row = await service.upsertSubscription('user-1', {
      endpoint: 'https://push.example/sub',
      deviceId: 'device-1',
      keys: { p256dh: 'p256', auth: 'auth' },
    })

    expect(row.id).toBe('sub-1')
    expect(prisma.devicePushSubscription.upsert).toHaveBeenCalled()
  })

  it('sendToUser skips when VAPID is not configured', async () => {
    const result = await service.sendToUser('user-1', {
      title: 'T',
      body: 'B',
      url: '/',
    })
    expect(result).toEqual({ sent: 0, failed: 0 })
    expect(webpush.sendNotification).not.toHaveBeenCalled()
  })

  it('sendToUser dispatches to all subscriptions', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub'
    process.env.VAPID_PRIVATE_KEY = 'priv'
    vi.mocked(prisma.devicePushSubscription.findMany).mockResolvedValueOnce([
      {
        id: 's1',
        endpoint: 'https://push.example/1',
        p256dh: 'p',
        auth: 'a',
      },
    ] as never)
    vi.mocked(webpush.sendNotification).mockResolvedValueOnce(undefined as never)

    const result = await service.sendToUser('user-1', {
      title: 'New assignment',
      body: 'Assigned',
      url: '/permits/p1',
    })

    expect(result.sent).toBe(1)
    expect(result.failed).toBe(0)
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      { endpoint: 'https://push.example/1', keys: { p256dh: 'p', auth: 'a' } },
      expect.stringContaining('New assignment'),
    )
  })
})
