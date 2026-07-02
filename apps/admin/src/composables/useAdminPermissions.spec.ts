import { describe, it, expect } from 'vitest'
import { adminHasPermission, filterAdminNavItems } from './useAdminPermissions'
import { ADMIN_NAV_ITEMS } from '../config/admin-navigation'

describe('useAdminPermissions helpers (M11-S3)', () => {
  it('ADMIN sees all permission-gated nav items', () => {
    const visible = filterAdminNavItems(ADMIN_NAV_ITEMS, 'ADMIN')
    expect(visible.length).toBe(ADMIN_NAV_ITEMS.length)
    expect(adminHasPermission('ADMIN', 'manage_users')).toBe(true)
  })

  it('non-admin roles see no permission-gated nav items', () => {
    const visible = filterAdminNavItems(ADMIN_NAV_ITEMS, 'SCO')
    const gated = ADMIN_NAV_ITEMS.filter((item) => item.requiredPermission)
    expect(visible.length).toBe(ADMIN_NAV_ITEMS.length - gated.length)
    expect(adminHasPermission('SCO', 'manage_users')).toBe(false)
  })
})
