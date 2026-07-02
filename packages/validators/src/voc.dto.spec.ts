import { describe, it, expect } from 'vitest'
import { SubmitVoCDTOSchema, VoCDecisionSchema, ReviewVoCDTOSchema } from './voc.dto.js'

describe('SubmitVoCDTOSchema', () => {
  const valid = {
    verificationDate: '2026-11-02T12:00:00.000Z',
    sectionTitle: 'Division B — Safety',
    title: 'Guardrail corrected',
    name: 'Building Owner LLC',
    method: 'SITE_VISIT' as const,
    comments: 'Verified on site.',
  }

  it('accepts a valid submission', () => {
    expect(SubmitVoCDTOSchema.parse(valid)).toEqual(valid)
  })

  it('rejects empty section title', () => {
    expect(() => SubmitVoCDTOSchema.parse({ ...valid, sectionTitle: '' })).toThrow()
  })
})

describe('VoCDecisionSchema', () => {
  it('allows ACCEPTED and REJECTED', () => {
    expect(VoCDecisionSchema.parse('ACCEPTED')).toBe('ACCEPTED')
    expect(VoCDecisionSchema.parse('REJECTED')).toBe('REJECTED')
  })
})

describe('ReviewVoCDTOSchema', () => {
  it('accepts decision with optional comments', () => {
    expect(ReviewVoCDTOSchema.parse({ decision: 'ACCEPTED' })).toEqual({
      decision: 'ACCEPTED',
    })
    expect(
      ReviewVoCDTOSchema.parse({ decision: 'REJECTED', comments: 'Need more detail' }),
    ).toEqual({
      decision: 'REJECTED',
      comments: 'Need more detail',
    })
  })
})
