import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { hasValidCertification } from '../lib/auth/certification'
import { lazyView } from '../lib/lazy-component'

const INSPECTION_MUTATION_META = {
  requiresAuth: true,
  requiresValidCertification: true,
} as const

// Dev-only routes (excluded from production builds unless VITE_ENABLE_E2E_ROUTES=true)
const devRoutes: RouteRecordRaw[] = []
if (!import.meta.env.PROD || import.meta.env.VITE_ENABLE_E2E_ROUTES === 'true') {
  devRoutes.push({
    path: '/e2e-annotate-photo',
    name: 'e2e-annotate-photo',
    component: lazyView(() => import('../views/AnnotatePhotoE2EView.vue')),
    meta: { requiresAuth: true, devOnly: true, appShell: false },
  })
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: lazyView(() => import('../views/LoginView.vue')),
    meta: { requiresAuth: false, appShell: false },
  },
  {
    path: '/login/sso-callback',
    name: 'login-sso-callback',
    component: lazyView(() => import('../views/SsoCallbackView.vue')),
    meta: { requiresAuth: false, appShell: false },
  },
  {
    path: '/',
    name: 'home',
    component: lazyView(() => import('../views/HomeView.vue')),
    meta: { requiresAuth: true },
  },
  {
    path: '/profile',
    name: 'profile',
    component: lazyView(() => import('../views/ProfileView.vue')),
    meta: { requiresAuth: true },
  },
  {
    path: '/permits',
    name: 'permits',
    component: lazyView(() => import('../views/PermitsView.vue')),
    meta: { requiresAuth: true },
  },
  {
    path: '/permits/:id',
    name: 'permit-detail',
    component: lazyView(() => import('../views/PermitDetailView.vue')),
    meta: { ...INSPECTION_MUTATION_META },
  },
  {
    path: '/inspections/:inspectionId/unable-to-enter',
    name: 'unable-to-enter',
    component: lazyView(() => import('../views/UnableToEnterView.vue')),
    meta: { ...INSPECTION_MUTATION_META },
  },
  {
    path: '/inspections/:inspectionId/checklist/:executionId',
    name: 'checklist-execution',
    component: lazyView(() => import('../views/ChecklistExecutionView.vue')),
    meta: { ...INSPECTION_MUTATION_META },
  },
  {
    path: '/inspections/:inspectionId/deficiencies',
    name: 'deficiency-list',
    component: lazyView(() => import('../views/DeficiencyListView.vue')),
    meta: { ...INSPECTION_MUTATION_META },
  },
  {
    path: '/inspections/:inspectionId/deficiencies/new',
    name: 'create-deficiency',
    component: lazyView(() => import('../views/CreateDeficiencyView.vue')),
    meta: { ...INSPECTION_MUTATION_META },
  },
  {
    path: '/inspections/:inspectionId/deficiencies/:deficiencyId',
    name: 'deficiency-detail',
    component: lazyView(() => import('../views/DeficiencyDetailView.vue')),
    meta: { ...INSPECTION_MUTATION_META },
  },
  {
    path: '/inspections/:inspectionId/deficiencies/:deficiencyId/voc',
    name: 'voc-submission',
    component: lazyView(() => import('../views/VoCSubmissionView.vue')),
    meta: { ...INSPECTION_MUTATION_META },
  },
  {
    path: '/inspections/:inspectionId/review',
    name: 'inspection-review',
    component: lazyView(() => import('../views/InspectionReviewView.vue')),
    meta: { ...INSPECTION_MUTATION_META },
  },
  {
    path: '/user-manual',
    name: 'user-manual',
    component: lazyView(() => import('../views/UserManualView.vue')),
    /** Public: SCOs and guests can read the field guide without signing in. */
    meta: { requiresAuth: false },
  },
  {
    path: '/capture-photo',
    name: 'capture-photo',
    component: lazyView(() => import('../views/CapturePhotoView.vue')),
    meta: { ...INSPECTION_MUTATION_META },
  },
  ...devRoutes,
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// Global navigation guard
router.beforeEach((to, _from, next) => {
  // Defense in depth: block dev-only routes in production (except E2E Docker builds)
  if (
    to.meta.devOnly &&
    import.meta.env.PROD &&
    import.meta.env.VITE_ENABLE_E2E_ROUTES !== 'true'
  ) {
    console.warn('[Router] Attempted access to dev-only route in production, redirecting to home')
    next({ name: 'home' })
    return
  }

  const authStore = useAuthStore()
  const requiresAuth = to.meta.requiresAuth !== false

  if (authStore.isAuthenticated && authStore.user?.role && authStore.user.role !== 'SCO') {
    console.warn('[Router] Non-inspector role blocked from inspector app (M11-S3)')
    next({ name: 'login', query: { reason: 'access_denied' } })
    return
  }

  if (to.meta.requiresValidCertification && !hasValidCertification(authStore.user)) {
    console.warn('[Router] Inspection routes blocked — no valid certification (M-01)')
    next({ name: 'profile', query: { reason: 'cert_expired' } })
    return
  }

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

export default router
