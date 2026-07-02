/**
 * Browser-only API error handling (login redirect on 401).
 * Service worker code should import `apiFetch` from `./api-fetch` instead.
 */

import { useAuthStore } from '../stores/auth'
import router from '../router'

export { apiFetch } from './api-fetch'

/**
 * Handle API response errors
 * Automatically redirects to login on 401 Unauthorized
 */
export async function handleApiError(response: Response): Promise<void> {
  if (response.status !== 401 || typeof window === 'undefined') return

  console.log('[API] 401 Unauthorized - redirecting to login')

  const authStore = useAuthStore()

  await authStore.logout()

  router.push({
    name: 'login',
    query: { redirect: router.currentRoute.value.fullPath },
  })
}
