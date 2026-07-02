import { describe, it, expect } from 'vitest'
import {
  RemoteWipeConfirmResponseSchema,
  RemoteWipeStatusSchema,
  RemoteWipeTriggerResponseSchema,
} from './remote-wipe.dto'

describe('Remote wipe DTO schemas', () => {
  it('parses wipe status', () => {
    const result = RemoteWipeStatusSchema.safeParse({
      pending: true,
      message: 'Device wiped by administrator',
    })
    expect(result.success).toBe(true)
  })

  it('parses trigger response', () => {
    const result = RemoteWipeTriggerResponseSchema.safeParse({
      message: 'Remote wipe requested',
      requestedAt: '2026-05-19T10:00:00.000Z',
      userId: 'user-1',
    })
    expect(result.success).toBe(true)
  })

  it('parses confirm response', () => {
    const result = RemoteWipeConfirmResponseSchema.safeParse({
      message: 'Remote wipe confirmed',
      confirmedAt: '2026-05-19T11:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })
})
