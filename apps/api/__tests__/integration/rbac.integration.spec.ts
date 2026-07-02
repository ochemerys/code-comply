import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import type { User } from '@codecomply/db'
import { prisma } from '@codecomply/db'
import { authService } from '../../src/services/auth.service.js'
import { AUDIT_ACTION, auditLogService } from '../../src/services/audit-log.service.js'

vi.mock('../../src/services/auth.service.js', () => ({
  authService: { validateToken: vi.fn() },
}))

vi.mock('../../src/services/audit-log.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/audit-log.service.js')>()
  return {
    ...actual,
    auditLogService: { append: vi.fn().mockResolvedValue({ id: 'audit-rbac-int' }) },
  }
})

vi.mock('@codecomply/db', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue(true),
    user: { findMany: vi.fn().mockResolvedValue([]) },
    auditLog: { create: vi.fn() },
  },
}))

const scoUser = {
  id: 'sco-rbac-1',
  email: 'sco@example.com',
  name: 'SCO Test',
  role: 'SCO',
} as User

const adminUser = {
  id: 'admin-rbac-1',
  email: 'admin@example.com',
  name: 'Admin Test',
  role: 'ADMIN',
} as User

describe('RBAC integration (M11-S3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('SCO cannot access admin user registry', async () => {
    vi.mocked(authService.validateToken).mockResolvedValue(scoUser)
    const { app } = await import('../../src/app.js')

    const res = await app.request('/api/admin/users', {
      headers: { Authorization: 'Bearer sco-token' },
    })

    expect(res.status).toBe(403)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe('RBAC_FORBIDDEN')
    expect(auditLogService.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: AUDIT_ACTION.RBAC_ACCESS_DENIED }),
    )
  })

  it('ADMIN can access admin user registry route', async () => {
    vi.mocked(authService.validateToken).mockResolvedValue(adminUser)
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never)
    const { app } = await import('../../src/app.js')

    const res = await app.request('/api/admin/users', {
      headers: { Authorization: 'Bearer admin-token' },
    })

    expect(res.status).toBe(200)
  })

  it('SCO cannot access VoC admin review queue', async () => {
    vi.mocked(authService.validateToken).mockResolvedValue(scoUser)
    const { app } = await import('../../src/app.js')

    const res = await app.request('/api/voc/pending', {
      headers: { Authorization: 'Bearer sco-token' },
    })

    expect(res.status).toBe(403)
    expect(auditLogService.append).toHaveBeenCalled()
  })
})
