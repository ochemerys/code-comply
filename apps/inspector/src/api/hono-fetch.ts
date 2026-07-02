/**
 * Bridges Hono RPC client requests through apiFetch (401 refresh + offline grace).
 */

import { apiFetch } from '@/utils/api-error-handler'

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

/** Custom fetch for `hc()` — reuses apiFetch auth + silent refresh behaviour. */
export const honoAuthenticatedFetch: typeof fetch = (input, init) =>
  apiFetch(resolveUrl(input), mergeRequestInit(input, init))
