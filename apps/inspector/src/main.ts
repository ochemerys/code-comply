import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import App from './App.vue'
import router from './router'
import '@codecomply/ui/style.css'
import './index.css'
import { registerServiceWorker } from './lib/service-worker'
import { useAuthStore } from './stores/auth'
import { syncEngine } from './lib/db/sync-engine'
import { createInspectorSyncMutationProcessor } from './lib/db/inspector-sync-mutation-processor'
import { checkAndHandleRemoteWipe, REMOTE_WIPE_SYNC_CACHE_TTL_MS } from './lib/remote-wipe'
import { initSentry } from './lib/sentry'

// Register service worker
registerServiceWorker()

/**
 * Restore session before installing the router so the initial navigation + guards
 * run after tokens/user are hydrated from localStorage (Vue Router can resolve
 * routes as soon as the plugin is installed).
 */
async function bootstrap() {
  const app = createApp(App)
  initSentry(app)
  const pinia = createPinia()

  app.use(pinia)
  app.use(VueQueryPlugin)

  const authStore = useAuthStore()
  syncEngine.setAuthCheck(() => authStore.isAuthenticated)
  syncEngine.setRemoteWipeCheck(() =>
    checkAndHandleRemoteWipe(authStore, {
      reason: 'sync-engine',
      cacheTtlMs: REMOTE_WIPE_SYNC_CACHE_TTL_MS,
    }),
  )
  syncEngine.setMutationProcessor(createInspectorSyncMutationProcessor())

  const restoreResult = await authStore.restoreSession()

  if (restoreResult === 'revoked') {
    const base = import.meta.env.BASE_URL || '/'
    const loginPath = `${base.replace(/\/?$/, '/')}login?reason=revoked`
    window.location.replace(loginPath)
    return
  }

  if (restoreResult === 'device_stale') {
    const base = import.meta.env.BASE_URL || '/'
    const loginPath = `${base.replace(/\/?$/, '/')}login?reason=stale`
    window.location.replace(loginPath)
    return
  }

  if (authStore.isAuthenticated) {
    const wiped = await checkAndHandleRemoteWipe(authStore, {
      reason: 'bootstrap',
      force: true,
    })
    if (wiped) {
      const base = import.meta.env.BASE_URL || '/'
      const loginPath = `${base.replace(/\/?$/, '/')}login?reason=revoked`
      window.location.replace(loginPath)
      return
    }
  }

  app.use(router)
  app.mount('#app')

  if (!import.meta.env.PROD || import.meta.env.VITE_ENABLE_E2E_ROUTES === 'true') {
    const { mountInspectorE2eBridge } = await import('./lib/e2e/browser-bridge')
    mountInspectorE2eBridge()
  }

  if (import.meta.env.DEV) {
    const w = window as unknown as { __INSPECTOR_ROUTER__: typeof router }
    w.__INSPECTOR_ROUTER__ = router
  }
}

void bootstrap().catch((err) => {
  console.error('Inspector bootstrap failed:', err)
})
