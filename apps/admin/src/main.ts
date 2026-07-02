import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import App from './App.vue'
import router from './router'
import './style.css'
import { initSentry } from './lib/sentry'
import { createAdminQueryClient } from './lib/query-client'
import {
  configureAdminSessionExpiredRedirect,
  SessionExpiredRedirectError,
} from './utils/admin-api-fetch'

const app = createApp(App)
initSentry(app)
const pinia = createPinia()

app.use(pinia)
app.use(VueQueryPlugin, { queryClient: createAdminQueryClient() })
app.use(router)

configureAdminSessionExpiredRedirect(async () => {
  await router.replace({
    name: 'login',
    query: {
      reason: 'session_expired',
      redirect: router.currentRoute.value.fullPath,
    },
  })
  throw new SessionExpiredRedirectError()
})

// Restore session on app load
import { useAuthStore } from './stores/auth'
const authStore = useAuthStore()

// The router guard cancels the initial navigation (next(false)) while the
// session is restoring, leaving the router at the START location. Capture the
// originally requested URL so a deep-link / page reload of a protected route
// can be resumed once auth state is known (otherwise the page renders blank).
const requestedUrl = window.location.pathname + window.location.search + window.location.hash

// Restore session before mounting
authStore.restoreSession().finally(() => {
  app.mount('#app')

  if (router.currentRoute.value.matched.length === 0) {
    void router.replace(requestedUrl).catch(() => {})
  }
})
