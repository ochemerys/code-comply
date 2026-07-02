import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import * as permissions from '../composables/useAdminPermissions'
import router from './index'
import { useAuthStore } from '../stores/auth'

describe('router module', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.restoreAllMocks()
    await router.replace({ name: 'login' })
  })

  it('defines login and primary admin route names', () => {
    const names = router.getRoutes().map((r) => r.name)
    expect(names).toContain('login')
    expect(names).toContain('dashboard')
    expect(names).toContain('assignment-grid')
    expect(names).toContain('workload-calendar')
    expect(names).toContain('bulk-assignment')
    expect(names).toContain('users')
    expect(names).toContain('user-detail')
    expect(names).toContain('permits')
    expect(names).toContain('inspections')
    expect(names).toContain('inspection-monitor')
    expect(names).toContain('voc-review')
    expect(names).toContain('reports')
    expect(names).toContain('settings')
  })

  it('redirects to login with redirect query when dashboard is accessed unauthenticated', async () => {
    await router.replace('/')
    await router.isReady()
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/')
  })

  it('redirects non-admin users with session to login with access_denied', async () => {
    const auth = useAuthStore()
    auth.setUser({
      id: 'sco-1',
      email: 'sco@test.com',
      name: 'SCO',
      role: 'SCO',
      disciplines: [],
      certifications: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    auth.updateTokens({ accessToken: 'a', refreshToken: 'b', expiresIn: 3600 })
    await router.replace('/')
    await router.isReady()
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.reason).toBe('access_denied')
  })

  it('redirects admin without manage_users from /users to dashboard', async () => {
    vi.spyOn(permissions, 'adminHasPermission').mockReturnValue(false)
    const auth = useAuthStore()
    auth.setUser({
      id: 'admin-1',
      email: 'admin@test.com',
      name: 'Admin',
      role: 'ADMIN',
      disciplines: [],
      certifications: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    auth.updateTokens({ accessToken: 'a', refreshToken: 'b', expiresIn: 3600 })
    await router.replace('/users')
    await router.isReady()
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('dashboard')
    expect(router.currentRoute.value.query.reason).toBe('permission_denied')
  })
})
