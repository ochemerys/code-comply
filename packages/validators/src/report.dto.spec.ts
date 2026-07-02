import { describe, it, expect } from 'vitest'
import { GenerateReportDTOSchema, ReportDTOSchema } from './report.dto.js'

describe('ReportDTO schemas', () => {
  it('accepts valid report DTO', () => {
    const dto = {
      id: 'r1',
      inspectionId: 'insp-1',
      type: 'INSPECTION' as const,
      filename: 'inspection-report.pdf',
      storageKey: 'reports/insp-1/file.pdf',
      hash: 'a'.repeat(64),
      generatedAt: '2026-11-01T12:00:00.000Z',
      distributedAt: null,
    }
    expect(ReportDTOSchema.parse(dto)).toEqual(dto)
  })

  it('requires deficiencyId for DEFICIENCY generate payload', () => {
    expect(() =>
      GenerateReportDTOSchema.parse({ inspectionId: 'insp-1', type: 'DEFICIENCY' }),
    ).toThrow()
    expect(
      GenerateReportDTOSchema.parse({
        inspectionId: 'insp-1',
        type: 'DEFICIENCY',
        deficiencyId: 'def-1',
      }),
    ).toBeTruthy()
  })

  it('requires deficiencyId for STOP_WORK generate payload', () => {
    expect(() =>
      GenerateReportDTOSchema.parse({ inspectionId: 'insp-1', type: 'STOP_WORK' }),
    ).toThrow()
    expect(
      GenerateReportDTOSchema.parse({
        inspectionId: 'insp-1',
        type: 'STOP_WORK',
        deficiencyId: 'def-sw-1',
      }),
    ).toBeTruthy()
  })
})
