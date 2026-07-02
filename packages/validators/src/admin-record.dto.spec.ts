import { describe, it, expect } from 'vitest'
import {
  AddendumDTOSchema,
  AdminInspectionRecordDetailSchema,
  CreateAddendumRequestSchema,
} from './admin-record.dto.js'

describe('admin-record.dto', () => {
  it('parses create addendum request with signature', () => {
    const result = CreateAddendumRequestSchema.safeParse({
      reason: 'Correction',
      content: 'Room 202 not 201',
      signature: 'data:image/png;base64,abc',
    })
    expect(result.success).toBe(true)
  })

  it('rejects addendum without signature', () => {
    const result = CreateAddendumRequestSchema.safeParse({
      reason: 'Correction',
      content: 'Details',
    })
    expect(result.success).toBe(false)
  })

  it('parses admin inspection record detail', () => {
    const result = AdminInspectionRecordDetailSchema.safeParse({
      inspectionId: 'insp-1',
      permitNumber: 'P-001',
      address: '123 Main',
      status: 'PASSED',
      scheduledDate: '2024-01-15T10:00:00.000Z',
      isFinalized: true,
      finalizedAt: '2024-01-15T12:00:00.000Z',
      deficiencyCount: 0,
      deficiencies: [],
      hasCertificationSnapshot: true,
      addendums: [],
      appendOnlyMessage: 'Append-only',
    })
    expect(result.success).toBe(true)
  })

  it('parses addendum DTO', () => {
    const result = AddendumDTOSchema.safeParse({
      id: 'add-1',
      inspectionId: 'insp-1',
      reason: 'Fix',
      content: 'Details',
      createdById: 'u1',
      createdAt: '2024-01-16T10:00:00.000Z',
      signature: null,
    })
    expect(result.success).toBe(true)
  })
})
