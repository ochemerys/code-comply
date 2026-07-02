import { describe, it, expect } from 'vitest'
import { formatDateShort, createStorage } from './index'

describe('@codecomply/utils index exports', () => {
  it('re-exports date utilities', () => {
    expect(formatDateShort('2024-06-01T12:00:00.000Z')).toContain('Jun')
  })

  it('re-exports storage utilities', () => {
    const storage = {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    }
    expect(createStorage(storage).has('missing')).toBe(false)
  })
})
