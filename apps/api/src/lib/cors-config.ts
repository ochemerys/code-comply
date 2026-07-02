/**
 * CORS allowlist for browser clients (Inspector PWA, Admin portal).
 *
 * @see apps/api/src/app.ts
 * @see README.md — Render deployment (INSPECTOR_URL / ADMIN_URL)
 */

/** Strip whitespace and trailing slashes so env vars match browser `Origin` headers. */
export function normalizeCorsOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '')
}

export function parseExtraCorsOrigins(): string[] {
  return (process.env.EXTRA_CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => normalizeCorsOrigin(value))
    .filter(Boolean)
}

export function getAllowedCorsOrigins(): Set<string> {
  return new Set(
    [process.env.INSPECTOR_URL, process.env.ADMIN_URL, ...parseExtraCorsOrigins()]
      .filter((value): value is string => Boolean(value))
      .map(normalizeCorsOrigin),
  )
}

/**
 * Resolves whether a request `Origin` may access the API with credentials.
 * Returns the origin string to echo in `Access-Control-Allow-Origin`, or null to deny.
 */
export function resolveCorsOrigin(requestOrigin: string | undefined): string | undefined | null {
  if (!requestOrigin) return requestOrigin

  const normalized = normalizeCorsOrigin(requestOrigin)

  if (process.env.NODE_ENV !== 'production' && normalized.startsWith('http://localhost:')) {
    return requestOrigin
  }

  if (getAllowedCorsOrigins().has(normalized)) {
    return requestOrigin
  }

  return null
}

/** Logs misconfiguration that causes browser "CORS header missing" on login. */
export function logCorsConfiguration(): void {
  const inspector = process.env.INSPECTOR_URL?.trim()
  const admin = process.env.ADMIN_URL?.trim()
  const nodeEnv = process.env.NODE_ENV ?? 'development'

  if (nodeEnv === 'development' || nodeEnv === 'test') return

  if (!inspector) {
    console.warn(
      '[CORS] INSPECTOR_URL is not set — browser login from the Inspector PWA will fail until it matches the static site origin (e.g. https://inspector-pwa-staging.onrender.com)',
    )
  }
  if (!admin) {
    console.warn(
      '[CORS] ADMIN_URL is not set — browser login from the Admin portal will fail until it matches the static site origin',
    )
  }

  const allowed = [...getAllowedCorsOrigins()]
  if (allowed.length > 0) {
    console.log(`[CORS] Allowed browser origins: ${allowed.join(', ')}`)
  }
}
