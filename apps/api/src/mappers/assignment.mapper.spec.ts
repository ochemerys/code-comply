import { describe, it, expect } from 'vitest'
import { AssignmentMapper } from './assignment.mapper'

describe('AssignmentMapper', () => {
  it('maps inspection schedule to DTO', () => {
    const d = new Date('2026-05-01T12:00:00.000Z')
    const row = {
      id: 's1',
      inspectionId: 'i1',
      assignedToId: 'u1',
      assignedDate: d,
      createdAt: d,
      updatedAt: d,
    } as any
    expect(AssignmentMapper.toDTO(row)).toEqual({
      id: 's1',
      inspectionId: 'i1',
      assignedToId: 'u1',
      assignedDate: d.toISOString(),
      createdAt: d.toISOString(),
      updatedAt: d.toISOString(),
    })
  })
})
