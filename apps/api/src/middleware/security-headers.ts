import type { MiddlewareHandler } from 'hono'

/** Standard HTTP security headers (M11-S7, OWASP A05). */
export const DEFAULT_SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(self), payment=()',
} as const

export type SecurityHeaderName = keyof typeof DEFAULT_SECURITY_HEADERS

export interface SecurityHeaderVerification {
  name: SecurityHeaderName
  expected: string
  actual: string | null
  passed: boolean
}

/** Verify that a response includes required security headers. */
export function verifySecurityHeaders(
  headers: Headers,
  expected: Record<string, string> = DEFAULT_SECURITY_HEADERS,
): SecurityHeaderVerification[] {
  return (Object.entries(expected) as [SecurityHeaderName, string][]).map(([name, value]) => {
    const actual = headers.get(name)
    return {
      name,
      expected: value,
      actual,
      passed: actual === value,
    }
  })
}

/** Returns true when all required security headers are present with expected values. */
export function securityHeadersValid(headers: Headers): boolean {
  return verifySecurityHeaders(headers).every((check) => check.passed)
}

/**
 * Emits defense-in-depth HTTP security headers on every response (M11-S7).
 * Complements CSP frame-ancestors and HSTS from security middleware.
 */
export function securityHeadersMiddleware(
  headerValues: Record<string, string> = DEFAULT_SECURITY_HEADERS,
): MiddlewareHandler {
  return async (c, next) => {
    for (const [name, value] of Object.entries(headerValues)) {
      c.header(name, value)
    }
    await next()
  }
}
