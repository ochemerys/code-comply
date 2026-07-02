import { describe, it, expect } from 'vitest'
import { ReportMapper } from './report.mapper.js'

describe('ReportMapper', () => {
  it('maps report row to DTO', () => {
    const generatedAt = new Date('2026-06-01T16:00:00.000Z')
    const distributedAt = new Date('2026-06-02T10:00:00.000Z')

    const dto = ReportMapper.toDTO(
      {
        id: 'rep-1',
        inspectionId: 'insp-1',
        type: 'INSPECTION',
        filename: 'inspection-report.pdf',
        storageKey: 'reports/insp-1/file.pdf',
        hash: 'a'.repeat(64),
        generatedAt,
        distributedAt,
      } as any,
      { inspectionUniqueId: 'RPT-UNIQUE-1' },
    )

    expect(dto).toMatchObject({
      id: 'rep-1',
      inspectionId: 'insp-1',
      type: 'INSPECTION',
      uniqueReportId: 'RPT-UNIQUE-1',
      distributedAt: distributedAt.toISOString(),
    })
    expect(dto.verifyUrl).toContain('/reports/verify/rep-1?hash=')
  })

  it('maps null distributedAt', () => {
    const dto = ReportMapper.toDTO({
      id: 'rep-2',
      inspectionId: 'insp-2',
      type: 'NO_ENTRY',
      filename: 'no-entry.pdf',
      storageKey: 'k',
      hash: 'b'.repeat(64),
      generatedAt: new Date('2026-06-01T16:00:00.000Z'),
      distributedAt: null,
    } as any)

    expect(dto.distributedAt).toBeNull()
  })

  it('maps multiple rows via toDTOs', () => {
    const generatedAt = new Date('2026-06-01T16:00:00.000Z')
    const rows = ReportMapper.toDTOs([
      {
        id: 'rep-1',
        inspectionId: 'insp-1',
        type: 'INSPECTION',
        filename: 'a.pdf',
        storageKey: 'k1',
        hash: 'a'.repeat(64),
        generatedAt,
        distributedAt: null,
      },
    ] as any)

    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('rep-1')
  })
})
