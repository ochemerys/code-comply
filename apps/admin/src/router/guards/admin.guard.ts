import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router'
import type { AdminPermission } from '../../config/admin-navigation'
import { adminHasPermission } from '../../composables/useAdminPermissions'
import type { SessionStatus } from '../../stores/auth'

/** Snapshot of auth store fields used by the admin portal router guard. */
export interface AdminGuardAuthState {
  isAuthenticated: boolean
  isAdmin: boolean
  user: { role?: string } | null
  accessToken: string | null
  refreshToken: string | null
  sessionStatus: SessionStatus
}

export function matchedRequiresAuth(to: RouteLocationNormalized): boolean {
  return to.matched.some((record) => record.meta.requiresAuth !== false)
}

export function matchedRequiresAdmin(to: RouteLocationNormalized): boolean {
  return to.matched.some((record) => record.meta.requiresAdmin === true)
}

/** Deepest matched route record that declares a required RBAC permission. */
export function matchedRequiredPermission(
  to: RouteLocationNormalized,
): AdminPermission | undefined {
  for (let i = to.matched.length - 1; i >= 0; i -= 1) {
    const permission = to.matched[i]?.meta.requiredPermission
    if (permission) return permission as AdminPermission
  }
  return undefined
}

export function hasStoredTokens(
  state: Pick<AdminGuardAuthState, 'accessToken' | 'refreshToken'>,
): boolean {
  return !!state.accessToken && !!state.refreshToken
}

export function shouldDeferNavigationForSession(
  authStore: Pick<AdminGuardAuthState, 'sessionStatus' | 'accessToken' | 'refreshToken'>,
): boolean {
  if (authStore.sessionStatus === 'restoring') return true
  return authStore.sessionStatus === 'unknown' && hasStoredTokens(authStore)
}

/**
 * Global `beforeEach` logic: authentication, admin-only enforcement, login redirect.
 * Waits for session hydration; does not admit protected routes on tokens alone.
 */
export function runAdminPortalBeforeEach(
  to: RouteLocationNormalized,
  authStore: AdminGuardAuthState,
  next: NavigationGuardNext,
): void {
  const requiresAuth = matchedRequiresAuth(to)
  const requiresAdmin = matchedRequiresAdmin(to)
  const requiredPermission = matchedRequiredPermission(to)

  if (to.name === 'login' && authStore.isAuthenticated && authStore.isAdmin) {
    next({ name: 'dashboard' })
    return
  }

  if (requiresAuth) {
    if (shouldDeferNavigationForSession(authStore)) {
      next(false)
      return
    }

    if (authStore.sessionStatus === 'restore_error') {
      next(false)
      return
    }

    if (!authStore.isAuthenticated) {
      next({ name: 'login', query: { redirect: to.fullPath } })
      return
    }

    if (requiresAdmin && !authStore.isAdmin) {
      next({ name: 'login', query: { reason: 'access_denied' } })
      return
    }
    if (
      requiredPermission &&
      authStore.user != null &&
      !adminHasPermission(authStore.user.role, requiredPermission)
    ) {
      next({ name: 'dashboard', query: { reason: 'permission_denied' } })
      return
    }
    next()
    return
  }

  next()
}
