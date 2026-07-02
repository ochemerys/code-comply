import { describe, it, expect } from 'vitest'
import {
  ADMIN_NAV_ITEMS,
  ADMIN_PERMISSIONS,
  API_ROUTE_GROUP_PERMISSIONS,
} from '../config/admin-navigation'
import router from './index'

/** Values mirrored from apps/api/src/middleware/role.ts ADMIN_PERMISSIONS */
const API_ADMIN_PERMISSIONS = [
  'view_all_inspections',
  'manage_users',
  'review_voc',
  'generate_reports',
  'manage_assignments',
] as const

function routePathByName(name: string): string | undefined {
  const record = router.getRoutes().find((r) => r.name === name)
  return record?.path
}

function routeMetaByName(name: string): Record<string, unknown> | undefined {
  const record = router.getRoutes().find((r) => r.name === name)
  return record?.meta
}

describe('admin route permissions (M11-S3)', () => {
  it('ADMIN_PERMISSIONS stays aligned with API ADMIN_PERMISSIONS', () => {
    expect([...ADMIN_PERMISSIONS]).toEqual([...API_ADMIN_PERMISSIONS])
  })

  it('API_ROUTE_GROUP_PERMISSIONS values are included in ADMIN_PERMISSIONS', () => {
    const permissionSet = new Set(ADMIN_PERMISSIONS)
    for (const permission of Object.values(API_ROUTE_GROUP_PERMISSIONS)) {
      expect(permissionSet.has(permission)).toBe(true)
    }
  })

  it('every nav item with requiredPermission has matching route meta', () => {
    const gatedNavItems = ADMIN_NAV_ITEMS.filter((item) => item.requiredPermission)

    for (const item of gatedNavItems) {
      const resolved = router.resolve(item.route)
      const deepest = resolved.matched[resolved.matched.length - 1]
      expect(deepest, `route for ${item.route}`).toBeDefined()
      expect(deepest?.meta.requiredPermission).toBe(item.requiredPermission)
    }
  })

  it('user detail route requires manage_users', () => {
    expect(routeMetaByName('user-detail')?.requiredPermission).toBe('manage_users')
  })

  it('dashboard and settings routes have no requiredPermission', () => {
    expect(routeMetaByName('dashboard')?.requiredPermission).toBeUndefined()
    expect(routeMetaByName('settings')?.requiredPermission).toBeUndefined()
  })

  it('maps known API route groups to admin paths', () => {
    expect(routeMetaByName('users')?.requiredPermission).toBe(API_ROUTE_GROUP_PERMISSIONS.users)
    expect(routeMetaByName('assignment-grid')?.requiredPermission).toBe(
      API_ROUTE_GROUP_PERMISSIONS.assignments,
    )
    expect(routeMetaByName('compliance-search')?.requiredPermission).toBe(
      API_ROUTE_GROUP_PERMISSIONS.complianceSearch,
    )
    expect(routeMetaByName('deficiencies')?.requiredPermission).toBe(
      API_ROUTE_GROUP_PERMISSIONS.complianceSearch,
    )
    expect(routeMetaByName('inspection-detail')?.requiredPermission).toBe(
      API_ROUTE_GROUP_PERMISSIONS.complianceSearch,
    )
    expect(routeMetaByName('inspection-documents')?.requiredPermission).toBe(
      API_ROUTE_GROUP_PERMISSIONS.complianceSearch,
    )
    expect(routeMetaByName('voc-review')?.requiredPermission).toBe(
      API_ROUTE_GROUP_PERMISSIONS.vocReview,
    )
    expect(routeMetaByName('reports')?.requiredPermission).toBe(API_ROUTE_GROUP_PERMISSIONS.reports)
    expect(routePathByName('users')).toBe('/users')
  })
})
