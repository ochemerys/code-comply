import { describe, it, expect } from 'vitest'
import { CodeReferenceDTOSchema } from './code-reference.dto'

describe('CodeReferenceDTOSchema', () => {
  it('should accept a minimal valid reference', () => {
    const result = CodeReferenceDTOSchema.safeParse({
      code: 'NBC',
      section: '9.10.1',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.code).toBe('NBC')
      expect(result.data.section).toBe('9.10.1')
    }
  })

  it('should accept optional id and title', () => {
    const result = CodeReferenceDTOSchema.safeParse({
      id: 'lib-1',
      code: 'NEC',
      section: '110.26',
      title: 'Working space',
    })
    expect(result.success).toBe(true)
  })

  it('should reject empty code or section', () => {
    expect(CodeReferenceDTOSchema.safeParse({ code: '', section: '1' }).success).toBe(false)
    expect(CodeReferenceDTOSchema.safeParse({ code: 'NBC', section: '' }).success).toBe(false)
  })
})
