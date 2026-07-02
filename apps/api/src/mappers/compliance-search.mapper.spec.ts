import { describe, it, expect } from 'vitest'
import { ComplianceSearchMapper } from './compliance-search.mapper'

describe('ComplianceSearchMapper (M10-S16)', () => {
  it('maps inspection row to result DTO', () => {
    const dto = ComplianceSearchMapper.toResultDTO({
      id: 'insp-1',
      status: 'PASSED',
      scheduledDate: new Date('2024-01-15T10:00:00Z'),
      completedDate: new Date('2024-01-15T12:00:00Z'),
      finalizedAt: new Date('2024-01-15T12:05:00Z'),
      permit: {
        permitNumber: 'BP-001',
        address: '123 Main St',
        legalLandDesc: 'Plan 1234',
      },
      schedule: { assignedTo: { id: 'u1', name: 'Alice' } },
      inspector: { id: 'u2', name: 'Bob' },
      deficiencies: [{ id: 'd1' }, { id: 'd2' }],
    } as never)

    expect(dto.inspectionId).toBe('insp-1')
    expect(dto.permitNumber).toBe('BP-001')
    expect(dto.legalLandDescription).toBe('Plan 1234')
    expect(dto.inspectorId).toBe('u2')
    expect(dto.inspectorName).toBe('Bob')
    expect(dto.deficiencyCount).toBe(2)
  })

  it('falls back to assigned inspector when not finalized', () => {
    const dto = ComplianceSearchMapper.toResultDTO({
      id: 'insp-2',
      status: 'IN_PROGRESS',
      scheduledDate: new Date('2024-02-01'),
      completedDate: null,
      finalizedAt: null,
      permit: { permitNumber: 'BP-002', address: '456 Oak', legalLandDesc: null },
      schedule: { assignedTo: { id: 'u3', name: 'Carol' } },
      inspector: null,
      deficiencies: [],
    } as never)

    expect(dto.inspectorId).toBe('u3')
    expect(dto.inspectorName).toBe('Carol')
    expect(dto.legalLandDescription).toBeUndefined()
  })
})
