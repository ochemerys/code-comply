import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'
import type { Router } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../stores/auth'

// Create a test router with the same configuration
const createTestRouter = (): Router => {
  const routes = [
    {
      path: '/login',
      name: 'login',
      component: { template: '<div>Login</div>' },
      meta: { requiresAuth: false },
    },
    {
      path: '/',
      name: 'home',
      component: { template: '<div>Home</div>' },
      meta: { requiresAuth: true },
    },
    {
      path: '/profile',
      name: 'profile',
      component: { template: '<div>Profile</div>' },
      meta: { requiresAuth: true },
    },
    {
      path: '/permits',
      name: 'permits',
      component: { template: '<div>Permits</div>' },
      meta: { requiresAuth: true },
    },
    {
      path: '/user-manual',
      name: 'user-manual',
      component: { template: '<div>UserManual</div>' },
      meta: { requiresAuth: false },
    },
  ]

  const router = createRouter({
    history: createWebHistory(),
    routes,
  })

  // Add the same navigation guard as the real router
  router.beforeEach((to, _from, next) => {
    const authStore = useAuthStore()
    const requiresAuth = to.meta.requiresAuth !== false

    // If route requires authentication
    if (requiresAuth) {
      // Check if user is fully authenticated (has user profile and valid token)
      if (authStore.isAuthenticated) {
        // User is authenticated, allow navigation
        next()
      } else if (authStore.isOfflineGracePeriodActive) {
        // Allow navigation during offline grace period
        next()
      } else {
        // User is not authenticated, redirect to login
        console.log('[Router] Unauthorized access attempt, redirecting to login')
        next({
          name: 'login',
          query: { redirect: to.fullPath },
        })
      }
    } else {
      // Route doesn't require auth (e.g., login page)
      if (to.name === 'login' && authStore.isAuthenticated) {
        // Already authenticated, redirect to home instead of showing login
        next({ name: 'home' })
      } else {
        // Allow access to public routes
        next()
      }
    }
  })

  return router
}

describe('Router Authentication Guard', () => {
  let router: Router
  let authStore: ReturnType<typeof useAuthStore>

  beforeEach(() => {
    // Set up Pinia
    setActivePinia(createPinia())
    authStore = useAuthStore()

    // Create fresh router for each test
    router = createTestRouter()

    // Clear console.log spy
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  describe('Scenario 1: Direct URL Access (Unauthorized)', () => {
    it('should redirect unauthorized user from home to login', async () => {
      // User is not authenticated
      expect(authStore.isAuthenticated).toBe(false)

      // Try to navigate to home
      await router.push('/')

      // Should be redirected to login with return path
      expect(router.currentRoute.value.name).toBe('login')
      expect(router.currentRoute.value.query.redirect).toBe('/')
    })

    it('should redirect unauthorized user from permits to login', async () => {
      // User is not authenticated
      expect(authStore.isAuthenticated).toBe(false)

      // Try to navigate to permits
      await router.push('/permits')

      // Should be redirected to login with return path
      expect(router.currentRoute.value.name).toBe('login')
      expect(router.currentRoute.value.query.redirect).toBe('/permits')
    })

    it('should redirect unauthorized user from profile to login', async () => {
      // User is not authenticated
      expect(authStore.isAuthenticated).toBe(false)

      // Try to navigate to profile
      await router.push('/profile')

      // Should be redirected to login with return path
      expect(router.currentRoute.value.name).toBe('login')
      expect(router.currentRoute.value.query.redirect).toBe('/profile')
    })

    it('should allow unauthorized user to access login page', async () => {
      // User is not authenticated
      expect(authStore.isAuthenticated).toBe(false)

      // Navigate to login
      await router.push('/login')

      // Should be on login page
      expect(router.currentRoute.value.name).toBe('login')
    })

    it('should allow unauthorized user to access user manual', async () => {
      expect(authStore.isAuthenticated).toBe(false)

      await router.push('/user-manual')

      expect(router.currentRoute.value.name).toBe('user-manual')
    })
  })

  describe('Scenario 2: Authenticated User Access', () => {
    beforeEach(() => {
      // Simulate authenticated user
      authStore.user = {
        id: 'user-1',
        email: 'inspector@example.com',
        name: 'Test Inspector',
        role: 'SCO',
        certifications: [],
        disciplines: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any
      authStore.accessToken = 'valid-token'
    })

    it('should allow authenticated user to access home', async () => {
      expect(authStore.isAuthenticated).toBe(true)

      await router.push('/')

      expect(router.currentRoute.value.name).toBe('home')
    })

    it('should allow authenticated user to access permits', async () => {
      expect(authStore.isAuthenticated).toBe(true)

      await router.push('/permits')

      expect(router.currentRoute.value.name).toBe('permits')
    })

    it('should allow authenticated user to access profile', async () => {
      expect(authStore.isAuthenticated).toBe(true)

      await router.push('/profile')

      expect(router.currentRoute.value.name).toBe('profile')
    })

    it('should redirect authenticated user from login to home', async () => {
      expect(authStore.isAuthenticated).toBe(true)

      await router.push('/login')

      // Should be redirected to home
      expect(router.currentRoute.value.name).toBe('home')
    })

    it('should allow authenticated user to access user manual', async () => {
      expect(authStore.isAuthenticated).toBe(true)

      await router.push('/user-manual')

      expect(router.currentRoute.value.name).toBe('user-manual')
    })
  })

  describe('Scenario 3: Offline Grace Period', () => {
    beforeEach(() => {
      // Simulate offline grace period (tokens exist but no user profile)
      authStore.accessToken = 'expired-token'
      authStore.refreshToken = 'refresh-token'
      authStore.offlineGracePeriodExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours from now
    })

    it('should allow access during offline grace period', async () => {
      expect(authStore.isAuthenticated).toBe(false)
      expect(authStore.isOfflineGracePeriodActive).toBe(true)

      await router.push('/permits')

      // Should be allowed to access
      expect(router.currentRoute.value.name).toBe('permits')
    })

    it('should redirect when grace period expired', async () => {
      // Set grace period to past
      authStore.offlineGracePeriodExpiry = new Date(Date.now() - 1000) // 1 second ago

      expect(authStore.isAuthenticated).toBe(false)
      expect(authStore.isOfflineGracePeriodActive).toBe(false)

      await router.push('/permits')

      // Should be redirected to login
      expect(router.currentRoute.value.name).toBe('login')
      expect(router.currentRoute.value.query.redirect).toBe('/permits')
    })
  })

  describe('Scenario 4: URL Manipulation', () => {
    it('should block direct URL manipulation to protected routes', async () => {
      // User is not authenticated
      expect(authStore.isAuthenticated).toBe(false)

      // Try to manipulate URL to access protected route
      await router.push('/permits')

      // Should be blocked and redirected to login
      expect(router.currentRoute.value.name).toBe('login')
      expect(router.currentRoute.value.query.redirect).toBe('/permits')
    })

    it('should block navigation via router.push to protected routes', async () => {
      // User is not authenticated
      expect(authStore.isAuthenticated).toBe(false)

      // Try to navigate programmatically
      await router.push({ name: 'profile' })

      // Should be blocked and redirected to login
      expect(router.currentRoute.value.name).toBe('login')
      expect(router.currentRoute.value.query.redirect).toBe('/profile')
    })

    it('should block navigation via router.replace to protected routes', async () => {
      // User is not authenticated
      expect(authStore.isAuthenticated).toBe(false)

      // Try to navigate via replace
      await router.replace({ name: 'home' })

      // Should be blocked and redirected to login
      expect(router.currentRoute.value.name).toBe('login')
      expect(router.currentRoute.value.query.redirect).toBe('/')
    })
  })

  describe('Scenario 5: Return Path After Login', () => {
    it('should preserve return path in query parameter', async () => {
      // User is not authenticated
      expect(authStore.isAuthenticated).toBe(false)

      // Try to access permits
      await router.push('/permits')

      // Should be on login with redirect query
      expect(router.currentRoute.value.name).toBe('login')
      expect(router.currentRoute.value.query.redirect).toBe('/permits')

      // Simulate login
      authStore.user = {
        id: 'user-1',
        email: 'inspector@example.com',
        name: 'Test Inspector',
        role: 'SCO',
        certifications: [],
        disciplines: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any
      authStore.accessToken = 'valid-token'

      // Navigate to the redirect path
      const redirectPath = router.currentRoute.value.query.redirect as string
      await router.push(redirectPath)

      // Should be on the original intended page
      expect(router.currentRoute.value.name).toBe('permits')
    })
  })

  describe('Scenario 6: Cached Page Load', () => {
    it('should redirect when tokens exist but user profile is null', async () => {
      // Simulate cached page with tokens but no user profile
      authStore.accessToken = 'cached-token'
      authStore.refreshToken = 'cached-refresh-token'
      authStore.user = null

      // isAuthenticated should be false (requires both user and token)
      expect(authStore.isAuthenticated).toBe(false)

      // Try to access protected route
      await router.push('/permits')

      // Should be redirected to login
      expect(router.currentRoute.value.name).toBe('login')
      expect(router.currentRoute.value.query.redirect).toBe('/permits')
    })
  })

  describe('Scenario 7: Multiple Navigation Attempts', () => {
    it('should consistently block all unauthorized navigation attempts', async () => {
      // User is not authenticated
      expect(authStore.isAuthenticated).toBe(false)

      // Try multiple routes
      await router.push('/')
      expect(router.currentRoute.value.name).toBe('login')

      await router.push('/profile')
      expect(router.currentRoute.value.name).toBe('login')

      await router.push('/permits')
      expect(router.currentRoute.value.name).toBe('login')

      // All should be blocked
      expect(router.currentRoute.value.name).toBe('login')
    })
  })

  describe('Scenario 8: Session State Changes', () => {
    it('should allow navigation after authentication', async () => {
      // Start unauthenticated
      expect(authStore.isAuthenticated).toBe(false)

      await router.push('/permits')
      expect(router.currentRoute.value.name).toBe('login')

      // Authenticate
      authStore.user = {
        id: 'user-1',
        email: 'inspector@example.com',
        name: 'Test Inspector',
        role: 'SCO',
        certifications: [],
        disciplines: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any
      authStore.accessToken = 'valid-token'

      // Now should be able to navigate
      await router.push('/permits')
      expect(router.currentRoute.value.name).toBe('permits')
    })

    it('should block navigation after logout', async () => {
      // Start authenticated
      authStore.user = {
        id: 'user-1',
        email: 'inspector@example.com',
        name: 'Test Inspector',
        role: 'SCO',
        certifications: [],
        disciplines: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any
      authStore.accessToken = 'valid-token'

      await router.push('/permits')
      expect(router.currentRoute.value.name).toBe('permits')

      // Logout
      await authStore.logout()

      // Try to navigate
      await router.push('/profile')
      expect(router.currentRoute.value.name).toBe('login')
    })
  })
})
