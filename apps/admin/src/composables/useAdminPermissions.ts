import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import {
  ADMIN_NAV_ITEMS,
  ADMIN_PERMISSIONS,
  type AdminNavItem,
  type AdminPermission,
} from '../config/admin-navigation'

/** Full permission set for the ADMIN role (M11-S3). */
const ADMIN_ROLE_PERMISSIONS: readonly AdminPermission[] = ADMIN_PERMISSIONS

export function adminHasPermission(
  role: string | undefined,
  permission: AdminPermission | undefined,
): boolean {
  if (!permission) return true
  if (role !== 'ADMIN') return false
  return ADMIN_ROLE_PERMISSIONS.includes(permission)
}

export function filterAdminNavItems(
  items: AdminNavItem[],
  role: string | undefined,
): AdminNavItem[] {
  return items.filter((item) => adminHasPermission(role, item.requiredPermission))
}

export function useAdminPermissions() {
  const authStore = useAuthStore()

  const permissions = computed(() =>
    authStore.user?.role === 'ADMIN' ? [...ADMIN_ROLE_PERMISSIONS] : [],
  )

  const visibleNavItems = computed(() => filterAdminNavItems(ADMIN_NAV_ITEMS, authStore.user?.role))

  function can(permission: AdminPermission): boolean {
    return adminHasPermission(authStore.user?.role, permission)
  }

  return {
    permissions,
    visibleNavItems,
    can,
  }
}
