import { describe, it, expect } from 'vitest'
import { AuditLogEntryDTOSchema, AuditLogListQuerySchema } from './admin-audit-log.dto'

describe('AuditLogListQuerySchema', () => {
  it('accepts action filter for PERMIT_SYNC', () => {
    const result = AuditLogListQuerySchema.safeParse({ action: 'PERMIT_SYNC', limit: 10 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.action).toBe('PERMIT_SYNC')
      expect(result.data.limit).toBe(10)
    }
  })
})

describe('AuditLogEntryDTOSchema', () => {
  it('accepts audit log entry with metadata counts', () => {
    const result = AuditLogEntryDTOSchema.safeParse({
      id: 'audit-1',
      entityType: 'Permit',
      entityId: 'municipal',
      action: 'PERMIT_SYNC',
      userId: 'user-1',
      timestamp: '2026-06-07T12:00:00.000Z',
      metadata: { newPermits: 1, updatedPermits: 1, unchanged: 20 },
    })
    expect(result.success).toBe(true)
  })
})
