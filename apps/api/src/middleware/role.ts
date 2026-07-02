import type { Context, MiddlewareHandler, Next } from 'hono'
import type { User } from '@codecomply/db'
import { AUDIT_ACTION, AUDIT_ENTITY, auditLogService } from '../services/audit-log.service.js'

/** Application roles with distinct API and UI access (M11-S3). */
export const APP_ROLES = ['SCO', 'ADMIN', 'OWNER'] as const
export type AppRole = (typeof APP_ROLES)[number]

/** Permission strings aligned with M11-S3 role_permissions. */
export const SCO_PERMISSIONS = [
  'view_own_inspections',
  'create_deficiencies',
  'submit_voc',
  'view_own_reports',
] as const

export const ADMIN_PERMISSIONS = [
  'view_all_inspections',
  'manage_users',
  'review_voc',
  'generate_reports',
  'manage_assignments',
] as const

export type ScoPermission = (typeof SCO_PERMISSIONS)[number]
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number]
export type RolePermission = ScoPermission | AdminPermission

export const ROLE_PERMISSIONS: Record<'SCO' | 'ADMIN', readonly RolePermission[]> = {
  SCO: SCO_PERMISSIONS,
  ADMIN: ADMIN_PERMISSIONS,
}

export const RBAC_FORBIDDEN_CODE = 'RBAC_FORBIDDEN' as const

/** Permissions required for common admin API route groups. */
export const ADMIN_ROUTE_PERMISSIONS = {
  users: 'manage_users' as const,
  assignments: 'manage_assignments' as const,
  complianceSearch: 'view_all_inspections' as const,
  vocReview: 'review_voc' as const,
  reports: 'generate_reports' as const,
}

export function getPermissionsForRole(role: string): readonly RolePermission[] {
  if (role === 'ADMIN') return ROLE_PERMISSIONS.ADMIN
  if (role === 'SCO') return ROLE_PERMISSIONS.SCO
  return []
}

export function roleHasPermission(role: string, permission: RolePermission): boolean {
  return getPermissionsForRole(role).includes(permission)
}

export function isAdminRole(role: string): role is 'ADMIN' {
  return role === 'ADMIN'
}

export function isInspectorRole(role: string): role is 'SCO' {
  return role === 'SCO'
}

/** Admins see all tenant data; inspectors are scoped to assigned records. */
export function canViewAllData(role: string): boolean {
  return isAdminRole(role)
}

export function inspectorOwnsResource(
  userId: string,
  resourceOwnerId: string | null | undefined,
): boolean {
  return resourceOwnerId != null && resourceOwnerId === userId
}

/**
 * Returns true when the user may read a resource owned by `resourceOwnerId`.
 * Admins bypass ownership; SCO must match the assigned owner id.
 */
export function canAccessResource(
  role: string,
  userId: string,
  resourceOwnerId: string | null | undefined,
): boolean {
  if (canViewAllData(role)) return true
  if (isInspectorRole(role)) {
    return inspectorOwnsResource(userId, resourceOwnerId)
  }
  return false
}

export interface RbacDenialContext {
  path: string
  method: string
  requiredRoles?: readonly string[]
  requiredPermissions?: readonly string[]
  userRole: string
}

/** Append audit row for blocked RBAC attempts (M11-S3). */
export async function logRbacAccessDenied(user: User, context: RbacDenialContext): Promise<void> {
  try {
    await auditLogService.append({
      entityType: AUDIT_ENTITY.SECURITY,
      entityId: user.id,
      action: AUDIT_ACTION.RBAC_ACCESS_DENIED,
      userId: user.id,
      beforeData: null,
      afterData: null,
      metadata: {
        ...context,
        blocked: true,
      },
    })
  } catch (error) {
    // Denial must still return 403 even if audit persistence is unavailable (e.g. DB down in tests).
    console.error('[RBAC] Failed to record access denial audit log:', error)
  }
}

async function denyRoleAccess(
  c: Context,
  user: User,
  allowedRoles: readonly AppRole[],
): Promise<Response> {
  await logRbacAccessDenied(user, {
    path: c.req.path,
    method: c.req.method,
    requiredRoles: allowedRoles,
    userRole: user.role,
  })
  return c.json({ error: 'Forbidden', code: RBAC_FORBIDDEN_CODE }, 403)
}

async function denyPermissionAccess(
  c: Context,
  user: User,
  permissions: readonly RolePermission[],
): Promise<Response> {
  await logRbacAccessDenied(user, {
    path: c.req.path,
    method: c.req.method,
    requiredPermissions: permissions,
    userRole: user.role,
  })
  return c.json({ error: 'Forbidden', code: RBAC_FORBIDDEN_CODE }, 403)
}

/**
 * Restrict routes to one or more roles; denied attempts are audit-logged.
 */
export function roleMiddleware(allowedRoles: readonly AppRole[]): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as User | undefined
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    if (!allowedRoles.includes(user.role as AppRole)) {
      return denyRoleAccess(c, user, allowedRoles)
    }
    await next()
  }
}

/**
 * Restrict routes to users holding at least one of the given permissions.
 */
export function requirePermission(...permissions: RolePermission[]): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as User | undefined
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    const allowed = permissions.some((permission) => roleHasPermission(user.role, permission))
    if (!allowed) {
      return denyPermissionAccess(c, user, permissions)
    }
    await next()
  }
}
