import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { exportComplianceResultsCsv } from './useAdminComplianceSearch'

describe('useAdminComplianceSearch utilities (M10-S16)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'URL',
      class {
        static createObjectURL = vi.fn(() => 'blob:mock')
        static revokeObjectURL = vi.fn()
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exportComplianceResultsCsv triggers download with CSV blob', () => {
    const click = vi.fn()
    const link = document.createElement('a')
    link.click = click
    vi.spyOn(document, 'createElement').mockReturnValue(link)

    exportComplianceResultsCsv([
      {
        inspectionId: 'insp-1',
        permitNumber: 'P-001',
        legalLandDescription: 'Plan A',
        address: '123 Main',
        status: 'PASSED',
        scheduledDate: '2024-01-15T10:00:00.000Z',
        inspectorName: 'Alice',
        deficiencyCount: 1,
      },
    ])

    expect(URL.createObjectURL).toHaveBeenCalled()
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0]?.[0] as Blob
    expect(blob.type).toBe('text/csv;charset=utf-8')
    expect(link.download).toBe('compliance-search-export.csv')
    expect(click).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })
})
