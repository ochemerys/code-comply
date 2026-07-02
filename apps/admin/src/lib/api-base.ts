/**
 * Base URL for browser → API requests.
 *
 * In Vite dev, an empty string means same-origin; `vite.config.ts` proxies `/auth` and `/api`
 * to the Hono server on port 4000.
 */
export function getApiBaseUrl(): string {
  const explicit = import.meta.env.VITE_API_URL

  if (import.meta.env.MODE === 'test') {
    return explicit || 'http://localhost:4000'
  }

  if (import.meta.env.DEV) {
    const isDefaultLocal =
      explicit === undefined ||
      explicit === '' ||
      explicit === 'http://localhost:4000' ||
      explicit === 'http://127.0.0.1:4000'
    if (isDefaultLocal) return ''
  }

  return explicit || 'http://localhost:4000'
}

/** Base URL for `hono/client` (absolute origin when using the dev proxy). */
export function getHonoClientBaseUrl(): string {
  if (import.meta.env.MODE === 'test') {
    return import.meta.env.VITE_API_URL || 'http://localhost:4000'
  }
  const base = getApiBaseUrl()
  if (base) return base
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return 'http://localhost:4000'
}
