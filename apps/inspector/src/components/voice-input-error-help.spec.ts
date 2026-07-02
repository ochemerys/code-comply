import { describe, it, expect } from 'vitest'
import { voiceInputErrorHelp } from './voice-input-error-help'

describe('voiceInputErrorHelp', () => {
  it('maps offline message', () => {
    const h = voiceInputErrorHelp('Voice recognition is unavailable while offline')
    expect(h.summary).toMatch(/internet/i)
    expect(h.resolution).toMatch(/Connect|type/i)
  })

  it('maps not-allowed', () => {
    const h = voiceInputErrorHelp('Speech recognition error: not-allowed')
    expect(h.summary).toMatch(/microphone|blocked/i)
    expect(h.resolution).toMatch(/Allow|permission/i)
  })

  it('maps empty to generic guidance', () => {
    const h = voiceInputErrorHelp(null)
    expect(h.summary).toBeTruthy()
    expect(h.resolution).toMatch(/Press and hold|type/i)
  })
})
