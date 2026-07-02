import { describe, it, expect } from 'vitest'
import { PushSubscriptionBodySchema } from './push-notification.dto'

describe('PushSubscriptionBodySchema', () => {
  it('accepts a valid subscription body', () => {
    const parsed = PushSubscriptionBodySchema.parse({
      endpoint: 'https://push.example/sub',
      deviceId: 'device-1',
      keys: { p256dh: 'abc', auth: 'def' },
    })
    expect(parsed.deviceId).toBe('device-1')
  })

  it('rejects missing keys', () => {
    expect(() =>
      PushSubscriptionBodySchema.parse({
        endpoint: 'https://push.example/sub',
        deviceId: 'device-1',
        keys: { p256dh: 'abc' },
      }),
    ).toThrow()
  })
})
