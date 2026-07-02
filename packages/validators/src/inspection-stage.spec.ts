import { describe, it, expect } from 'vitest'
import { formatInspectionStageLabels, primaryInspectionStageLabel } from './inspection-stage.js'

describe('inspection-stage helpers', () => {
  it('formats a single stage label', () => {
    expect(formatInspectionStageLabels(['FOUNDATION'])).toBe('Foundation')
  })

  it('joins multiple stage labels', () => {
    expect(formatInspectionStageLabels(['FOUNDATION', 'FRAMING'])).toBe('Foundation, Framing')
  })

  it('returns undefined for empty stages', () => {
    expect(primaryInspectionStageLabel([])).toBeUndefined()
    expect(primaryInspectionStageLabel(undefined)).toBeUndefined()
  })

  it('returns label for non-empty stages', () => {
    expect(primaryInspectionStageLabel(['FOUNDATION'])).toBe('Foundation')
  })
})
