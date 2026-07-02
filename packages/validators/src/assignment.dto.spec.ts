import { describe, it, expect } from 'vitest'
import {
  AdminAssignmentCreateBodySchema,
  AdminBulkAssignmentBodySchema,
  AdminUserListQuerySchema,
  AdminWorkloadQuerySchema,
} from './assignment.dto'

describe('assignment.dto schemas', () => {
  it('parses admin user list query with isActive string', () => {
    const q = AdminUserListQuerySchema.parse({ role: 'SCO', isActive: 'true', search: 'x' })
    expect(q.role).toBe('SCO')
    expect(q.isActive).toBe(true)
    expect(q.search).toBe('x')
  })

  it('parses assignment create body', () => {
    expect(AdminAssignmentCreateBodySchema.parse({ inspectionId: 'i1', userId: 'u1' })).toEqual({
      inspectionId: 'i1',
      userId: 'u1',
    })
  })

  it('parses bulk body', () => {
    const b = AdminBulkAssignmentBodySchema.parse({
      items: [{ inspectionId: 'i1', userId: 'u1' }],
    })
    expect(b.items).toHaveLength(1)
  })

  it('parses workload query', () => {
    const w = AdminWorkloadQuerySchema.parse({
      userId: 'u1',
      from: '2026-05-01T00:00:00.000Z',
      to: '2026-05-02T00:00:00.000Z',
    })
    expect(w.userId).toBe('u1')
  })
})
