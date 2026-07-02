import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import * as permissions from '../../composables/useAdminPermissions'
import {
  matchedRequiresAdmin,
  matchedRequiresAuth,
  matchedRequiredPermission,
  hasStoredTokens,
  shouldDeferNavigationForSession,
  runAdminPortalBeforeEach,
  type AdminGuardAuthState,
} from './admin.guard'

function mockTo(meta: Record<string, unknown>[]): RouteLocationNormalized {
  return {
    name: 'x',
    matched: meta.map((m) => ({ meta: m })),
  } as unknown as RouteLocationNormalized
}

function nextMock() {
  const calls: unknown[] = []
  const next = vi.fn((arg?: unknown) => {
    calls.push(arg === undefined ? '__empty__' : arg)
  })
  return { next: next as import('vue-router').NavigationGuardNext, calls }
}

function baseAuth(overrides: Partial<AdminGuardAuthState> = {}): AdminGuardAuthState {
  return {
    isAuthenticated: false,
    isAdmin: false,
    user: null,
    accessToken: null,
    refreshToken: null,
    sessionStatus: 'anonymous',
    ...overrides,
  }
}

describe('admin.guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('matchedRequiresAuth is true when any matched record does not set requiresAuth false', () => {
    expect(matchedRequiresAuth(mockTo([{ requiresAuth: true }]))).toBe(true)
    expect(matchedRequiresAuth(mockTo([{ requiresAuth: false }]))).toBe(false)
  })

  it('matchedRequiresAdmin is true only when meta requiresAdmin is true', () => {
    expect(matchedRequiresAdmin(mockTo([{ requiresAdmin: true }]))).toBe(true)
    expect(matchedRequiresAdmin(mockTo([{ title: 'x' }]))).toBe(false)
  })

  it('matchedRequiredPermission returns deepest matched route permission', () => {
    expect(
      matchedRequiredPermission(
        mockTo([{ requiresAdmin: true }, { requiredPermission: 'manage_users' }]),
      ),
    ).toBe('manage_users')
    expect(matchedRequiredPermission(mockTo([{ title: 'Dashboard' }]))).toBeUndefined()
  })

  it('hasStoredTokens detects both tokens', () => {
    const s = baseAuth({ accessToken: 'a', refreshToken: 'b' })
    expect(hasStoredTokens(s)).toBe(true)
    expect(hasStoredTokens({ ...s, refreshToken: null })).toBe(false)
  })

  it('shouldDeferNavigationForSession defers only when restoring or unknown with tokens', () => {
    expect(shouldDeferNavigationForSession(baseAuth({ sessionStatus: 'unknown' }))).toBe(false)
    expect(
      shouldDeferNavigationForSession(
        baseAuth({ sessionStatus: 'unknown', accessToken: 'a', refreshToken: 'b' }),
      ),
    ).toBe(true)
    expect(shouldDeferNavigationForSession(baseAuth({ sessionStatus: 'restoring' }))).toBe(true)
    expect(shouldDeferNavigationForSession(baseAuth({ sessionStatus: 'authenticated' }))).toBe(
      false,
    )
  })

  it('redirects authenticated non-admin away from admin routes', () => {
    const auth = baseAuth({
      isAuthenticated: true,
      isAdmin: false,
      user: { role: 'SCO' },
      accessToken: 'a',
      refreshToken: 'b',
      sessionStatus: 'authenticated',
    })
    const { next, calls } = nextMock()
    runAdminPortalBeforeEach(mockTo([{ requiresAuth: true, requiresAdmin: true }]), auth, next)
    expect(next).toHaveBeenCalledTimes(1)
    expect(calls[0]).toEqual({ name: 'login', query: { reason: 'access_denied' } })
  })

  it('allows authenticated admin into admin routes', () => {
    const auth = baseAuth({
      isAuthenticated: true,
      isAdmin: true,
      user: { role: 'ADMIN' },
      accessToken: 'a',
      refreshToken: 'b',
      sessionStatus: 'authenticated',
    })
    const { next, calls } = nextMock()
    runAdminPortalBeforeEach(mockTo([{ requiresAuth: true, requiresAdmin: true }]), auth, next)
    expect(calls[0]).toBe('__empty__')
  })

  it('redirects unauthenticated visitors without tokens to login with redirect', () => {
    const auth = baseAuth()
    const { next, calls } = nextMock()
    const to = {
      ...mockTo([{ requiresAuth: true, requiresAdmin: true }]),
      fullPath: '/users',
    } as RouteLocationNormalized
    runAdminPortalBeforeEach(to, auth, next)
    expect(calls[0]).toEqual({ name: 'login', query: { redirect: '/users' } })
  })

  it('aborts protected navigation while session is restoring with tokens but no user', () => {
    const auth = baseAuth({
      accessToken: 'a',
      refreshToken: 'b',
      sessionStatus: 'restoring',
    })
    const { next, calls } = nextMock()
    runAdminPortalBeforeEach(
      mockTo([{ requiresAuth: true, requiresAdmin: true, requiredPermission: 'manage_users' }]),
      auth,
      next,
    )
    expect(calls[0]).toBe(false)
  })

  it('redirects to login when tokens exist but session is anonymous after failed restore', () => {
    const auth = baseAuth({
      accessToken: null,
      refreshToken: null,
      sessionStatus: 'anonymous',
    })
    const { next, calls } = nextMock()
    const to = {
      ...mockTo([{ requiresAuth: true, requiresAdmin: true }]),
      fullPath: '/users',
    } as RouteLocationNormalized
    runAdminPortalBeforeEach(to, auth, next)
    expect(calls[0]).toEqual({ name: 'login', query: { redirect: '/users' } })
  })

  it('aborts protected navigation when restore failed with network error', () => {
    const auth = baseAuth({
      accessToken: 'a',
      refreshToken: 'b',
      sessionStatus: 'restore_error',
    })
    const { next, calls } = nextMock()
    runAdminPortalBeforeEach(mockTo([{ requiresAuth: true, requiresAdmin: true }]), auth, next)
    expect(calls[0]).toBe(false)
  })

  it('sends logged-in admin from login to dashboard', () => {
    const auth = baseAuth({
      isAuthenticated: true,
      isAdmin: true,
      user: { role: 'ADMIN' },
      accessToken: 'a',
      refreshToken: 'b',
      sessionStatus: 'authenticated',
    })
    const { next, calls } = nextMock()
    const to = { name: 'login', matched: [] } as unknown as RouteLocationNormalized
    runAdminPortalBeforeEach(to, auth, next)
    expect(calls[0]).toEqual({ name: 'dashboard' })
  })

  it('allows authenticated admin with permission into gated route', () => {
    const auth = baseAuth({
      isAuthenticated: true,
      isAdmin: true,
      user: { role: 'ADMIN' },
      accessToken: 'a',
      refreshToken: 'b',
      sessionStatus: 'authenticated',
    })
    const { next, calls } = nextMock()
    runAdminPortalBeforeEach(
      mockTo([{ requiresAuth: true, requiresAdmin: true, requiredPermission: 'manage_users' }]),
      auth,
      next,
    )
    expect(calls[0]).toBe('__empty__')
  })

  it('redirects authenticated admin without manage_users to dashboard', () => {
    vi.spyOn(permissions, 'adminHasPermission').mockReturnValue(false)
    const auth = baseAuth({
      isAuthenticated: true,
      isAdmin: true,
      user: { role: 'ADMIN' },
      accessToken: 'a',
      refreshToken: 'b',
      sessionStatus: 'authenticated',
    })
    const { next, calls } = nextMock()
    runAdminPortalBeforeEach(
      mockTo([{ requiresAuth: true, requiresAdmin: true, requiredPermission: 'manage_users' }]),
      auth,
      next,
    )
    expect(calls[0]).toEqual({ name: 'dashboard', query: { reason: 'permission_denied' } })
  })
})
