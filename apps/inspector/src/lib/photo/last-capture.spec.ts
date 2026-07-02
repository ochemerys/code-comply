import { describe, it, expect, beforeEach } from 'vitest'
import {
  clearPendingAcceptedPhoto,
  consumeLastAcceptedPhoto,
  setLastAcceptedPhoto,
} from './last-capture'

describe('last-capture', () => {
  beforeEach(() => {
    clearPendingAcceptedPhoto()
  })

  it('hands off a single blob to the consumer then clears', () => {
    const b = new Blob(['x'], { type: 'image/jpeg' })
    setLastAcceptedPhoto(b)
    expect(consumeLastAcceptedPhoto()).toBe(b)
    expect(consumeLastAcceptedPhoto()).toBeNull()
  })

  it('scoped capture is ignored by non-matching checklist galleries', () => {
    const b = new Blob(['x'], { type: 'image/jpeg' })
    setLastAcceptedPhoto(b, { checklistItemId: 'line-b' })
    expect(consumeLastAcceptedPhoto('line-a')).toBeNull()
    expect(consumeLastAcceptedPhoto('line-b')).toBe(b)
    expect(consumeLastAcceptedPhoto('line-b')).toBeNull()
  })

  it('unscoped capture is consumed regardless of consumer checklist id (legacy flows)', () => {
    const b = new Blob(['y'], { type: 'image/jpeg' })
    setLastAcceptedPhoto(b)
    expect(consumeLastAcceptedPhoto('line-z')).toBe(b)
    expect(consumeLastAcceptedPhoto('line-z')).toBeNull()
  })

  it('scoped deficiency capture only matches that deficiency gallery (M7-I1)', () => {
    const b = new Blob(['d'], { type: 'image/jpeg' })
    setLastAcceptedPhoto(b, { deficiencyId: 'def-a' })
    expect(consumeLastAcceptedPhoto({ deficiencyId: 'def-b' })).toBeNull()
    expect(consumeLastAcceptedPhoto({ deficiencyId: 'def-a' })).toBe(b)
    expect(consumeLastAcceptedPhoto({ deficiencyId: 'def-a' })).toBeNull()
  })

  it('checklist scoped capture rejects deficiency consumer', () => {
    const b = new Blob(['c'], { type: 'image/jpeg' })
    setLastAcceptedPhoto(b, { checklistItemId: 'line-1' })
    expect(consumeLastAcceptedPhoto({ deficiencyId: 'def-x' })).toBeNull()
    expect(consumeLastAcceptedPhoto('line-1')).toBe(b)
  })
})
