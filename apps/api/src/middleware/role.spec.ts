import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import type { User } from '@codecomply/db'
import {
  ADMIN_PERMISSIONS,
  RBAC_FORBIDDEN_CODE,
  SCO_PERMISSIONS,
  canAccessResource,
  canViewAllData,
  getPermissionsForRole,
  isAdminRole,
  isInspectorRole,
  requirePermission,
  roleHasPermission,
  roleMiddleware,
} from './role.js'
import { AUDIT_ACTION, auditLogService } from '../services/audit-log.service.js'

vi.mock('../services/audit-log.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/audit-log.service.js')>()
  return {
    ...actual,
    auditLogService: { append: vi.fn().mockResolvedValue({ id: 'audit-rbac-1' }) },
  }
})

function userFixture(role: User['role'], id = 'user-1'): User {
  return {
    id,
    email: `${role.toLowerCase()}@example.com`,
    name: 'Test User',
    role,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    passwordHash: 'hash',
    designationId: null,
    phone: null,
    certifications: [],
    disciplines: [],
  } as User
}

function appWithUser(user: User, allowedRoles: Parameters<typeof roleMiddleware>[0]) {
  const app = new Hono<{ Variables: { user: User; userId: string } }>()
  app.use('*', async (c, next) => {
    c.set('user', user)
    c.set('userId', user.id)
    await next()
  })
  app.get('/protected', roleMiddleware(allowedRoles), (c) => c.json({ ok: true }))
  return app
}

describe('role middleware (M11-S3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('defines SCO and ADMIN permissions from story', () => {
    expect([...SCO_PERMISSIONS]).toEqual([
      'view_own_inspections',
      'create_deficiencies',
      'submit_voc',
      'view_own_reports',
    ])
    expect([...ADMIN_PERMISSIONS]).toEqual([
      'view_all_inspections',
      'manage_users',
      'review_voc',
      'generate_reports',
      'manage_assignments',
    ])
  })

  it('roleHasPermission grants admin-only capabilities to ADMIN', () => {
    expect(roleHasPermission('ADMIN', 'manage_users')).toBe(true)
    expect(roleHasPermission('SCO', 'manage_users')).toBe(false)
    expect(roleHasPermission('SCO', 'submit_voc')).toBe(true)
  })

  it('getPermissionsForRole returns empty for unknown roles', () => {
    expect(getPermissionsForRole('OWNER')).toEqual([])
  })

  it('canViewAllData is true only for ADMIN', () => {
    expect(canViewAllData('ADMIN')).toBe(true)
    expect(canViewAllData('SCO')).toBe(false)
    expect(isAdminRole('ADMIN')).toBe(true)
    expect(isInspectorRole('SCO')).toBe(true)
  })

  it('canAccessResource enforces inspector data isolation', () => {
    expect(canAccessResource('SCO', 'sco-1', 'sco-1')).toBe(true)
    expect(canAccessResource('SCO', 'sco-1', 'sco-2')).toBe(false)
    expect(canAccessResource('ADMIN', 'admin-1', 'sco-2')).toBe(true)
  })

  it('allows ADMIN on admin-only routes', async () => {
    const res = await appWithUser(userFixture('ADMIN'), ['ADMIN']).request('/protected')
    expect(res.status).toBe(200)
    expect(auditLogService.append).not.toHaveBeenCalled()
  })

  it('blocks SCO from admin-only routes and audit-logs denial', async () => {
    const res = await appWithUser(userFixture('SCO'), ['ADMIN']).request('/protected')
    expect(res.status).toBe(403)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe(RBAC_FORBIDDEN_CODE)
    expect(auditLogService.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTION.RBAC_ACCESS_DENIED,
        userId: 'user-1',
        metadata: expect.objectContaining({
          userRole: 'SCO',
          requiredRoles: ['ADMIN'],
          blocked: true,
        }),
      }),
    )
  })

  it('requirePermission allows admin VoC review', async () => {
    const app = new Hono<{ Variables: { user: User; userId: string } }>()
    app.use('*', async (c, next) => {
      c.set('user', userFixture('ADMIN'))
      c.set('userId', 'user-1')
      await next()
    })
    app.get('/voc/pending', requirePermission('review_voc'), (c) => c.json({ items: [] }))
    const res = await app.request('/voc/pending')
    expect(res.status).toBe(200)
  })

  it('requirePermission blocks SCO from admin VoC review', async () => {
    const app = new Hono<{ Variables: { user: User; userId: string } }>()
    app.use('*', async (c, next) => {
      c.set('user', userFixture('SCO'))
      c.set('userId', 'user-1')
      await next()
    })
    app.get('/voc/pending', requirePermission('review_voc'), (c) => c.json({ items: [] }))
    const res = await app.request('/voc/pending')
    expect(res.status).toBe(403)
    expect(auditLogService.append).toHaveBeenCalled()
  })
})
