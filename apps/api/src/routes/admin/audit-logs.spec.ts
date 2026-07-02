import { describe, it, expect, beforeEach, vi } from 'vitest'
import { testClient } from 'hono/testing'
import { Hono } from 'hono'
import type { User } from '@codecomply/db'
import auditLogsApp from './audit-logs.js'
import { auditLogService } from '../../services/audit-log.service.js'
import { roleMiddleware } from '../../middleware/auth.middleware'

vi.mock('../../services/audit-log.service.js', () => ({
  auditLogService: { list: vi.fn() },
  AUDIT_ACTION: { PERMIT_SYNC: 'PERMIT_SYNC' },
  AUDIT_ENTITY: { PERMIT: 'Permit' },
}))

type AuditLogsTestClient = {
  index: { $get: (opts: { query?: Record<string, unknown> }) => Promise<Response> }
}

const createAdminTestApp = () => {
  const testApp = new Hono()
  testApp.use('*', async (c, next) => {
    c.set('user', { id: 'admin-1', role: 'ADMIN' } as User)
    c.set('userId', 'admin-1')
    await next()
  })
  testApp.use('*', roleMiddleware(['ADMIN']))
  testApp.route('/', auditLogsApp)
  return testApp
}

const adminClient = () => testClient(createAdminTestApp()) as AuditLogsTestClient

describe('Admin audit logs routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET / returns PERMIT_SYNC audit entries', async () => {
    vi.mocked(auditLogService.list).mockResolvedValue([
      {
        id: 'audit-1',
        entityType: 'Permit',
        entityId: 'municipal',
        action: 'PERMIT_SYNC',
        userId: 'admin-1',
        timestamp: new Date('2026-06-07T12:00:00.000Z'),
        beforeData: null,
        afterData: null,
        metadata: { newPermits: 1, updatedPermits: 0, unchanged: 21 },
      },
    ] as any)

    const res = await adminClient().index.$get({
      query: { action: 'PERMIT_SYNC', limit: '5' },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(1)
    expect(body.entries[0].action).toBe('PERMIT_SYNC')
    expect(body.entries[0].metadata).toEqual({ newPermits: 1, updatedPermits: 0, unchanged: 21 })
    expect(auditLogService.list).toHaveBeenCalledWith({
      action: 'PERMIT_SYNC',
      entityType: undefined,
      limit: 5,
    })
  })
})
