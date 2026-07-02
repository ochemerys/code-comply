import { describe, it, expect, beforeEach } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'
import type { Router } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import type { UserDTO } from '@codecomply/validators'
import { useAuthStore } from '../stores/auth'
import { runAdminPortalBeforeEach } from './guards/admin.guard'

const iso = () => new Date().toISOString()

const adminUser = (): UserDTO => ({
  id: '1',
  email: 'a@b.com',
  name: 'Admin',
  role: 'ADMIN',
  disciplines: [],
  certifications: [],
  createdAt: iso(),
  updatedAt: iso(),
})

function createTestRouter(): Router {
  const routes = [
    {
      path: '/login',
      name: 'login',
      component: { template: '<div>Login</div>' },
      meta: { requiresAuth: false },
    },
    {
      path: '/',
      component: { template: '<div>Layout</div><router-view />' },
      meta: { requiresAuth: true, requiresAdmin: true },
      children: [
        { path: '', name: 'dashboard', component: { template: '<div>Dashboard</div>' } },
        { path: 'settings', name: 'settings', component: { template: '<div>Settings</div>' } },
      ],
    },
  ]

  const router = createRouter({
    history: createMemoryHistory(),
    routes,
  })

  router.beforeEach((to, _from, next) => {
    const authStore = useAuthStore()
    runAdminPortalBeforeEach(to, authStore, next)
  })

  return router
}

describe('admin router', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('redirects unauthenticated users from dashboard to login with redirect query', async () => {
    const router = createTestRouter()
    await router.push('/')
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/')
  })

  it('redirects to login when tokens exist but session is not authenticated', async () => {
    const authStore = useAuthStore()
    localStorage.setItem('admin_accessToken', 't')
    localStorage.setItem('admin_refreshToken', 'r')
    authStore.accessToken = 't'
    authStore.refreshToken = 'r'
    authStore.sessionStatus = 'anonymous'

    const router = createTestRouter()
    await router.push('/')
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/')
  })

  it('redirects authenticated users away from login to dashboard', async () => {
    const authStore = useAuthStore()
    authStore.setUser(adminUser())
    authStore.updateTokens({ accessToken: 'a', refreshToken: 'b', expiresIn: 3600 })

    const router = createTestRouter()
    await router.push('/login')
    expect(router.currentRoute.value.name).toBe('dashboard')
  })

  it('redirects non-admin authenticated user from dashboard to login with access_denied', async () => {
    const authStore = useAuthStore()
    authStore.setUser({
      id: '2',
      email: 'sco@test.com',
      name: 'SCO User',
      role: 'SCO',
      disciplines: [],
      certifications: [],
      createdAt: iso(),
      updatedAt: iso(),
    })
    authStore.updateTokens({ accessToken: 'a', refreshToken: 'b', expiresIn: 3600 })

    const router = createTestRouter()
    await router.push('/')
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.reason).toBe('access_denied')
  })

  it('navigates to nested settings when authenticated', async () => {
    const authStore = useAuthStore()
    authStore.setUser(adminUser())
    authStore.updateTokens({ accessToken: 'a', refreshToken: 'b', expiresIn: 3600 })

    const router = createTestRouter()
    await router.push('/settings')
    expect(router.currentRoute.value.name).toBe('settings')
  })
})
