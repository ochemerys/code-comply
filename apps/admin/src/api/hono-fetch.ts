/**
 * Bridges Hono RPC client requests through adminApiFetch (401 refresh + session redirect).
 */

import { adminApiFetch } from '@/utils/admin-api-fetch'

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

function mergeRequestInit(input: RequestInfo | URL, init?: RequestInit): RequestInit {
  if (!(input instanceof Request)) {
    return init ?? {}
  }

  const headers = new Headers(input.headers)
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value))
  }

  const method = init?.method ?? input.method
  const body =
    init?.body ??
    (method !== 'GET' && method !== 'HEAD' && input.body != null ? input.body : undefined)

  return {
    ...init,
    method,
    headers,
    body,
  }
}

/** Custom fetch for `hc()` — reuses adminApiFetch auth + silent refresh behaviour. */
export const honoAuthenticatedFetch: typeof fetch = (input, init) =>
  adminApiFetch(resolveUrl(input), mergeRequestInit(input, init))
