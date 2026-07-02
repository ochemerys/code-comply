import { describe, it, expect } from 'vitest'
import {
  ChecklistItemDTOSchema,
  ChecklistTemplateDTOSchema,
  ChecklistResponseDTOSchema,
  ChecklistExecutionDTOSchema,
  ChecklistResponseResultSchema,
  computeChecklistExecutionProgress,
} from './checklist.dto'

const iso = '2026-03-29T12:00:00.000Z'

describe('ChecklistItemDTOSchema', () => {
  it('should parse required fields and apply defaults', () => {
    const result = ChecklistItemDTOSchema.safeParse({
      id: 'item-1',
      order: 1,
      text: 'Verify grounding',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isRequired).toBe(true)
      expect(result.data.requiresPhoto).toBe(false)
    }
  })

  it('should accept optional category and codeReferences', () => {
    const result = ChecklistItemDTOSchema.safeParse({
      id: 'item-2',
      order: 2,
      text: 'Panel clearance',
      category: 'Electrical',
      isRequired: false,
      requiresPhoto: true,
      codeReferences: [{ code: 'NBC', section: '9.10.1', title: 'Fire separation' }],
    })
    expect(result.success).toBe(true)
  })

  it('should reject invalid payloads', () => {
    expect(
      ChecklistItemDTOSchema.safeParse({
        id: 'x',
        order: '1',
        text: 't',
      }).success,
    ).toBe(false)
  })
})

describe('ChecklistResponseDTOSchema', () => {
  it('should accept PASS, FAIL with code reference, and NA', () => {
    const pass = ChecklistResponseDTOSchema.safeParse({
      itemId: 'i1',
      result: 'PASS',
      timestamp: iso,
    })
    expect(pass.success).toBe(true)

    const fail = ChecklistResponseDTOSchema.safeParse({
      itemId: 'i1',
      result: 'FAIL',
      codeReference: { code: 'NBC', section: '9.10.1' },
      timestamp: iso,
    })
    expect(fail.success).toBe(true)

    const na = ChecklistResponseDTOSchema.safeParse({
      itemId: 'i1',
      result: 'NA',
      notes: 'Not applicable — removed',
      timestamp: iso,
    })
    expect(na.success).toBe(true)
  })

  it('should require codeReference when result is FAIL', () => {
    const result = ChecklistResponseDTOSchema.safeParse({
      itemId: 'i1',
      result: 'FAIL',
      timestamp: iso,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.flatten().fieldErrors.codeReference
      expect(paths?.length).toBeGreaterThan(0)
    }
  })

  it('should reject invalid result enum values', () => {
    expect(
      ChecklistResponseDTOSchema.safeParse({
        itemId: 'i1',
        result: 'MAYBE',
        timestamp: iso,
      }).success,
    ).toBe(false)
  })
})

describe('ChecklistExecutionDTOSchema', () => {
  const validResponse = {
    itemId: 'i1',
    result: 'PASS' as const,
    timestamp: iso,
  }

  it('should accept a valid execution', () => {
    const result = ChecklistExecutionDTOSchema.safeParse({
      id: 'exec-1',
      inspectionId: 'insp-1',
      templateId: 'tpl-1',
      versionHash: 'sha256:abc',
      responses: [validResponse],
      progress: 50,
    })
    expect(result.success).toBe(true)
  })

  it('should reject progress outside 0–100', () => {
    expect(
      ChecklistExecutionDTOSchema.safeParse({
        id: 'e',
        inspectionId: 'i',
        templateId: 't',
        versionHash: 'h',
        responses: [],
        progress: 101,
      }).success,
    ).toBe(false)
    expect(
      ChecklistExecutionDTOSchema.safeParse({
        id: 'e',
        inspectionId: 'i',
        templateId: 't',
        versionHash: 'h',
        responses: [],
        progress: -1,
      }).success,
    ).toBe(false)
  })

  it('should reject nested FAIL response without code reference', () => {
    const result = ChecklistExecutionDTOSchema.safeParse({
      id: 'exec-1',
      inspectionId: 'insp-1',
      templateId: 'tpl-1',
      versionHash: 'sha256:abc',
      responses: [
        {
          itemId: 'i1',
          result: 'FAIL',
          timestamp: iso,
        },
      ],
      progress: 0,
    })
    expect(result.success).toBe(false)
  })
})

describe('ChecklistTemplateDTOSchema', () => {
  it('should accept a template with items', () => {
    const result = ChecklistTemplateDTOSchema.safeParse({
      id: 'tpl-1',
      name: 'Rough-in',
      discipline: 'Electrical',
      version: 1,
      versionHash: 'sha256:tpl',
      items: [
        {
          id: 'item-1',
          order: 0,
          text: 'Bonding',
        },
      ],
      createdAt: iso,
      updatedAt: iso,
    })
    expect(result.success).toBe(true)
  })
})

describe('computeChecklistExecutionProgress', () => {
  const items = [
    { id: 'a', isRequired: true },
    { id: 'b', isRequired: true },
    { id: 'c', isRequired: false },
  ]

  it('should return 100 when no required items', () => {
    expect(computeChecklistExecutionProgress([], [])).toBe(100)
    expect(computeChecklistExecutionProgress([{ id: 'x', isRequired: false }], [])).toBe(100)
  })

  it('should count only required items', () => {
    expect(computeChecklistExecutionProgress(items, [{ itemId: 'a' }, { itemId: 'c' }])).toBe(50)
    expect(computeChecklistExecutionProgress(items, [{ itemId: 'a' }, { itemId: 'b' }])).toBe(100)
  })
})

describe('DTO exports', () => {
  it('should export response result schema', () => {
    expect(ChecklistResponseResultSchema.safeParse('PASS').success).toBe(true)
  })
})
