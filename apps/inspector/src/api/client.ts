import { hc } from 'hono/client'
import type { AppType } from '@codecomply/api/app'
import { getHonoClientBaseUrl } from '@/lib/api-base'
import { useAuthStore } from '@/stores/auth'
import { honoAuthenticatedFetch } from '@/api/hono-fetch'

type ApiClient = ReturnType<typeof hc<AppType>>

let cachedClient: ApiClient | undefined

/** Typed Hono RPC client — routes and payloads are checked against the API app type. */
export function getApiClient(): ApiClient {
  if (!cachedClient) {
    cachedClient = hc<AppType>(getHonoClientBaseUrl(), {
      fetch: honoAuthenticatedFetch,
      headers: (): Record<string, string> => {
        const token = useAuthStore().accessToken
        return token ? { Authorization: `Bearer ${token}` } : {}
      },
    })
  }
  return cachedClient
}

/**
 * Grouped route clients for endpoints with chained `.openapi()` on the API (see §3.2).
 * Add entries here as more sub-routers adopt the const-chain pattern in `apps/api`.
 */
export const api = {
  get deficiencies() {
    return getApiClient().api.deficiencies
  },
} as const
