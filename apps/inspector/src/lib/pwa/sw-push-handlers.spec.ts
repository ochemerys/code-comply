import { describe, it, expect } from 'vitest'
import { parsePushPayload, resolveNotificationUrl } from './sw-push-handlers'

describe('sw-push-handlers', () => {
  it('parsePushPayload returns empty object when data is missing', () => {
    const event = { data: null } as PushEvent
    expect(parsePushPayload(event)).toEqual({})
  })

  it('parsePushPayload parses JSON payload', () => {
    const event = {
      data: {
        json: () => ({ title: 'Hi', url: '/permits/p1' }),
      },
    } as PushEvent
    expect(parsePushPayload(event)).toEqual({ title: 'Hi', url: '/permits/p1' })
  })

  it('resolveNotificationUrl builds absolute URL from path', () => {
    expect(resolveNotificationUrl('/permits/abc', 'https://inspector.example')).toBe(
      'https://inspector.example/permits/abc',
    )
  })

  it('resolveNotificationUrl defaults to root', () => {
    expect(resolveNotificationUrl(undefined, 'https://inspector.example')).toBe(
      'https://inspector.example/',
    )
  })
})
