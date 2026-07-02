import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import {
  assertInspectionMutable,
  ImmutableInspectionError,
  immutableInspectionGuard,
  isInspectionFinalized,
  logImmutableViolationAttempt,
} from './immutable.js'
import { auditLogService } from '../services/audit-log.service.js'
import { prisma } from '@codecomply/db'

vi.mock('@codecomply/db', () => ({
  prisma: { permitInspection: { findUnique: vi.fn() } },
}))

vi.mock('../services/audit-log.service.js', () => ({
  AUDIT_ENTITY: { PERMIT_INSPECTION: 'PermitInspection' },
  AUDIT_ACTION: { INSPECTION_IMMUTABLE_VIOLATION: 'INSPECTION_IMMUTABLE_VIOLATION' },
  auditLogService: { append: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
  inspectionPayloadForAudit: vi.fn((row) => row),
}))

describe('immutable inspection helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('isInspectionFinalized is true when finalizedAt is set', () => {
    expect(isInspectionFinalized({ finalizedAt: new Date() })).toBe(true)
    expect(isInspectionFinalized({ finalizedAt: null })).toBe(false)
  })

  it('assertInspectionMutable allows non-finalized inspections', async () => {
    await expect(
      assertInspectionMutable({ id: 'insp-1', finalizedAt: null }, 'user-1', 'update'),
    ).resolves.toBeUndefined()
    expect(auditLogService.append).not.toHaveBeenCalled()
  })

  it('assertInspectionMutable logs and throws for finalized inspections', async () => {
    const inspection = {
      id: 'insp-1',
      finalizedAt: new Date('2026-01-01'),
      status: 'PASSED',
    }

    await expect(assertInspectionMutable(inspection, 'user-1', 'delete')).rejects.toBeInstanceOf(
      ImmutableInspectionError,
    )

    expect(auditLogService.append).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: 'insp-1',
        action: 'INSPECTION_IMMUTABLE_VIOLATION',
        userId: 'user-1',
        metadata: { operation: 'delete', blocked: true },
      }),
    )
  })

  it('logImmutableViolationAttempt records blocked operation', async () => {
    await logImmutableViolationAttempt('insp-2', 'admin-1', 'update', { id: 'insp-2' })
    expect(auditLogService.append).toHaveBeenCalled()
  })
})

describe('immutableInspectionGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function appWithGuard() {
    const app = new Hono<{ Variables: { userId: string } }>()
    app.use('*', async (c, next) => {
      c.set('userId', 'user-1')
      await next()
    })
    app.patch('/:id', immutableInspectionGuard('update'), (c) => c.json({ ok: true }))
    return app
  }

  it('returns 409 for finalized inspection', async () => {
    vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue({
      id: 'insp-1',
      finalizedAt: new Date(),
      status: 'PASSED',
    } as never)

    const res = await appWithGuard().request('/insp-1', { method: 'PATCH' })
    expect(res.status).toBe(409)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe('IMMUTABLE_INSPECTION')
    expect(auditLogService.append).toHaveBeenCalled()
  })

  it('calls next for mutable inspection', async () => {
    vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue({
      id: 'insp-1',
      finalizedAt: null,
      status: 'IN_PROGRESS',
    } as never)

    const res = await appWithGuard().request('/insp-1', { method: 'PATCH' })
    expect(res.status).toBe(200)
  })

  it('returns 404 when inspection missing', async () => {
    vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(null)
    const res = await appWithGuard().request('/missing', { method: 'PATCH' })
    expect(res.status).toBe(404)
  })
})
