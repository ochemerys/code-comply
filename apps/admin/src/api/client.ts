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

/** Grouped route clients for admin composables. */
export const api = {
  get auth() {
    return getApiClient().auth
  },
  get admin() {
    return getApiClient().api.admin
  },
  get voc() {
    return getApiClient().api.voc
  },
  get inspections() {
    return getApiClient().api.inspections
  },
  get deficiencies() {
    return getApiClient().api.deficiencies
  },
  get reports() {
    return getApiClient().api.reports
  },
  get permits() {
    return getApiClient().api.permits
  },
  get documents() {
    return getApiClient().api.documents
  },
} as const

/** @internal Test-only reset so specs can re-init the client after mocks change. */
export function resetApiClientForTests(): void {
  cachedClient = undefined
}
