import { describe, it, expect } from 'vitest'
import {
  DeficiencyDTOSchema,
  CreateDeficiencyDTOSchema,
  UpdateDeficiencyDTOSchema,
  DeficiencySeveritySchema,
} from './deficiency.dto'

const iso = '2026-03-29T12:00:00.000Z'

describe('DeficiencyDTOSchema', () => {
  it('should parse a complete deficiency', () => {
    const result = DeficiencyDTOSchema.safeParse({
      id: 'def-1',
      clientId: 'client-uuid-1',
      inspectionId: 'insp-1',
      description: 'Missing GFCI protection in required locations.',
      location: 'Kitchen counter outlets',
      severity: 'MAJOR',
      status: 'OPEN',
      codeReference: { code: 'NBC', section: '9.10.1', title: 'Fire separation' },
      isStopWork: false,
      isUnsafe: true,
      dueDate: iso,
      createdAt: iso,
      updatedAt: iso,
    })
    expect(result.success).toBe(true)
  })

  it('should accept optional location, dueDate, and codeReference omitted', () => {
    const result = DeficiencyDTOSchema.safeParse({
      id: 'def-2',
      clientId: 'c2',
      inspectionId: 'insp-2',
      description: 'Panel not labeled with directory information.',
      severity: 'MINOR',
      status: 'VOC_SUBMITTED',
      isStopWork: false,
      isUnsafe: false,
      createdAt: iso,
      updatedAt: iso,
    })
    expect(result.success).toBe(true)
  })

  it('should accept optional checklistItemId', () => {
    const result = DeficiencyDTOSchema.safeParse({
      id: 'def-chk',
      clientId: 'c-chk',
      inspectionId: 'insp-chk',
      checklistItemId: 'item-exit-sign',
      description: 'Exit signage not visible from required distance.',
      severity: 'MAJOR',
      status: 'OPEN',
      isStopWork: false,
      isUnsafe: false,
      createdAt: iso,
      updatedAt: iso,
    })
    expect(result.success).toBe(true)
  })

  it('should reject invalid codeReference (empty section)', () => {
    const result = DeficiencyDTOSchema.safeParse({
      id: 'def-3',
      clientId: 'c3',
      inspectionId: 'insp-3',
      description: 'Some deficiency text here minimum.',
      severity: 'CRITICAL',
      status: 'OPEN',
      codeReference: { code: 'NBC', section: '' },
      isStopWork: true,
      isUnsafe: false,
      createdAt: iso,
      updatedAt: iso,
    })
    expect(result.success).toBe(false)
  })

  it('should reject invalid status enum', () => {
    expect(
      DeficiencyDTOSchema.safeParse({
        id: 'x',
        clientId: 'c',
        inspectionId: 'i',
        description: 'd',
        severity: 'MAJOR',
        status: 'PENDING',
        isStopWork: false,
        isUnsafe: false,
        createdAt: iso,
        updatedAt: iso,
      }).success,
    ).toBe(false)
  })
})

describe('CreateDeficiencyDTOSchema', () => {
  it('should apply default false for isStopWork and isUnsafe', () => {
    const result = CreateDeficiencyDTOSchema.safeParse({
      clientId: 'cl-1',
      inspectionId: 'insp-1',
      description: 'At least ten chars required for description field.',
      severity: 'MINOR',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isStopWork).toBe(false)
      expect(result.data.isUnsafe).toBe(false)
    }
  })

  it('should accept optional checklistItemId and dueDate', () => {
    const result = CreateDeficiencyDTOSchema.safeParse({
      clientId: 'cl-2',
      inspectionId: 'insp-2',
      checklistItemId: 'item-9.10.1',
      description: 'Another valid longer description text.',
      severity: 'CRITICAL',
      isStopWork: true,
      isUnsafe: true,
      dueDate: iso,
    })
    expect(result.success).toBe(true)
  })

  it('should reject description shorter than 10 characters', () => {
    const result = CreateDeficiencyDTOSchema.safeParse({
      clientId: 'c',
      inspectionId: 'i',
      description: 'short',
      severity: 'MAJOR',
    })
    expect(result.success).toBe(false)
  })
})

describe('UpdateDeficiencyDTOSchema', () => {
  it('should allow empty object (no required fields)', () => {
    const result = UpdateDeficiencyDTOSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('should not accept clientId', () => {
    const result = UpdateDeficiencyDTOSchema.safeParse({
      clientId: 'must-not-be-here',
    })
    expect(result.success).toBe(false)
  })

  it('should validate description min length when provided', () => {
    expect(UpdateDeficiencyDTOSchema.safeParse({ description: 'bad' }).success).toBe(false)
    expect(
      UpdateDeficiencyDTOSchema.safeParse({
        description: 'This patch updates the deficiency text ok.',
      }).success,
    ).toBe(true)
  })

  it('should allow partial severity and codeReference update', () => {
    const result = UpdateDeficiencyDTOSchema.safeParse({
      severity: 'CRITICAL',
      codeReference: { code: 'ABC', section: '1.2.3' },
    })
    expect(result.success).toBe(true)
  })

  it('should allow status update (e.g. mark resolved)', () => {
    expect(UpdateDeficiencyDTOSchema.safeParse({ status: 'CLOSED' }).success).toBe(true)
    expect(UpdateDeficiencyDTOSchema.safeParse({ status: 'INVALID' }).success).toBe(false)
  })
})

describe('DeficiencySeveritySchema', () => {
  it('should accept MINOR, MAJOR, CRITICAL only', () => {
    expect(DeficiencySeveritySchema.safeParse('MINOR').success).toBe(true)
    expect(DeficiencySeveritySchema.safeParse('MAJOR').success).toBe(true)
    expect(DeficiencySeveritySchema.safeParse('CRITICAL').success).toBe(true)
    expect(DeficiencySeveritySchema.safeParse('LOW').success).toBe(false)
  })
})
