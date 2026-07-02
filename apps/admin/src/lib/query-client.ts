/**
 * Single source of truth for the admin TanStack Query client.
 *
 * Centralizes server-state defaults so composables stay thin (DRY server-state
 * layer per hono-monorepo-architecture §7) and so 401-driven session-expiry
 * (surfaced as SessionExpiredRedirectError by adminApiFetch) never triggers a
 * pointless retry after the user has already been redirected to /login.
 */

import { QueryClient } from '@tanstack/vue-query'
import { isSessionExpiredRedirectError } from '@/utils/admin-api-fetch'

/** Admin list/detail data tolerates brief staleness; avoids refetch storms on nav. */
export const ADMIN_QUERY_STALE_TIME_MS = 30_000

/** Cap automatic retries; one extra attempt covers transient network blips. */
export const ADMIN_QUERY_MAX_RETRIES = 1

/**
 * Decide whether a failed query should be retried.
 * Never retry once the session has expired — the user is being redirected to
 * login, so further attempts would race the navigation and surface noise.
 */
export function shouldRetryAdminQuery(failureCount: number, error: unknown): boolean {
  if (isSessionExpiredRedirectError(error)) return false
  return failureCount < ADMIN_QUERY_MAX_RETRIES
}

/** Create the shared admin QueryClient with centralized defaults. */
export function createAdminQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: ADMIN_QUERY_STALE_TIME_MS,
        retry: shouldRetryAdminQuery,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}
