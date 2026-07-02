import type { Context, MiddlewareHandler } from 'hono'
import type { SecureVersion } from 'node:tls'

/** CSP directive names used by the API security middleware (M11-S1). */
export type CspDirectiveName =
  | 'default-src'
  | 'script-src'
  | 'style-src'
  | 'img-src'
  | 'connect-src'
  | 'worker-src'
  | 'object-src'
  | 'frame-ancestors'
  | 'base-uri'
  | 'form-action'

export type CspDirectives = Record<CspDirectiveName, string>

/** Default CSP directives per M11-S1 acceptance criteria. */
export const DEFAULT_CSP_DIRECTIVES: CspDirectives = {
  'default-src': "'self'",
  'script-src': "'self'",
  'style-src': "'self' 'unsafe-inline'",
  'img-src': "'self' data: blob: https:",
  'connect-src': "'self'",
  'worker-src': "'self' blob:",
  'object-src': "'none'",
  'frame-ancestors': "'none'",
  'base-uri': "'self'",
  'form-action': "'self'",
}

/** HSTS header per M11-S2 (Render terminates TLS at the edge). */
export const DEFAULT_HSTS_HEADER = 'max-age=31536000; includeSubDomains; preload'

/** Minimum TLS version for direct Node HTTPS listeners (M11-S2). */
export const MIN_TLS_VERSION: SecureVersion = 'TLSv1.2'

export interface TlsMiddlewareOptions {
  /** Override HSTS header value. */
  hstsHeader?: string
  /** Force HSTS on/off regardless of environment. */
  enableHsts?: boolean
  /** Force TLS requirement on/off regardless of environment. */
  enforceTls?: boolean
}

export interface SecurityMiddlewareOptions {
  /** When true, emit Content-Security-Policy-Report-Only instead of enforcing. */
  reportOnly?: boolean
  /** Optional URI for CSP violation reports. */
  reportUri?: string
  /** Override individual CSP directives. */
  directives?: Partial<CspDirectives>
  /** TLS / HSTS options (M11-S2). */
  tls?: TlsMiddlewareOptions
}

const CSP_DIRECTIVE_ORDER: CspDirectiveName[] = [
  'default-src',
  'script-src',
  'style-src',
  'img-src',
  'connect-src',
  'worker-src',
  'object-src',
  'frame-ancestors',
  'base-uri',
  'form-action',
]

function parseExtraConnectSources(): string[] {
  const extra = process.env.CSP_CONNECT_SRC?.trim()
  if (!extra) return []
  return extra.split(/\s+/).filter(Boolean)
}

function buildConnectSrc(base: string): string {
  const sources = new Set(base.split(/\s+/).filter(Boolean))
  for (const url of [
    process.env.INSPECTOR_URL,
    process.env.ADMIN_URL,
    process.env.API_PUBLIC_URL,
    ...parseExtraConnectSources(),
  ]) {
    if (url) sources.add(url)
  }
  return [...sources].join(' ')
}

/** Resolve effective CSP directives, merging defaults with env-aware connect-src. */
export function resolveCspDirectives(overrides?: Partial<CspDirectives>): CspDirectives {
  const connectBase = overrides?.['connect-src'] ?? DEFAULT_CSP_DIRECTIVES['connect-src']
  return {
    ...DEFAULT_CSP_DIRECTIVES,
    ...overrides,
    'connect-src': buildConnectSrc(connectBase),
  }
}

/** Serialize CSP directives into a header value. */
export function formatCspHeader(directives: CspDirectives, reportUri?: string): string {
  const parts = CSP_DIRECTIVE_ORDER.map((name) => `${name} ${directives[name]}`)
  if (reportUri) {
    parts.push(`report-uri ${reportUri}`)
  }
  return parts.join('; ')
}

function resolveReportOnly(options?: SecurityMiddlewareOptions): boolean {
  if (options?.reportOnly !== undefined) return options.reportOnly
  if (process.env.CSP_REPORT_ONLY === 'true') return true
  if (process.env.CSP_REPORT_ONLY === 'false') return false
  return process.env.NODE_ENV !== 'production'
}

function resolveReportUri(options?: SecurityMiddlewareOptions): string | undefined {
  const uri = options?.reportUri ?? process.env.CSP_REPORT_URI?.trim()
  return uri || undefined
}

/** Whether HSTS should be emitted for this deployment. */
export function resolveHstsHeader(options?: TlsMiddlewareOptions): string | undefined {
  if (options?.enableHsts === false) return undefined
  const header = options?.hstsHeader ?? process.env.HSTS_HEADER?.trim() ?? DEFAULT_HSTS_HEADER
  if (options?.enableHsts === true) return header
  if (process.env.HSTS_ENABLED === 'false') return undefined
  if (process.env.HSTS_ENABLED === 'true' || process.env.NODE_ENV === 'production') {
    return header
  }
  return undefined
}

/** Whether plain HTTP requests should be rejected (production / explicit opt-in). */
export function shouldEnforceTls(options?: TlsMiddlewareOptions): boolean {
  if (options?.enforceTls === true) return true
  if (options?.enforceTls === false) return false
  if (process.env.TLS_ENFORCE === 'true') return true
  if (process.env.TLS_ENFORCE === 'false') return false
  return process.env.NODE_ENV === 'production'
}

/** Detect HTTPS from the request URL or reverse-proxy headers (Render, etc.). */
export function isSecureRequest(c: Context): boolean {
  const forwarded = c.req.header('x-forwarded-proto')
  if (forwarded) {
    const primary = forwarded.split(',')[0]?.trim().toLowerCase()
    if (primary === 'https') return true
    if (primary === 'http') return false
  }
  try {
    return new URL(c.req.url).protocol === 'https:'
  } catch {
    return false
  }
}

/** Node.js HTTPS server options enforcing TLS 1.2+ (direct TLS termination). */
export function nodeTlsServerOptions(): {
  minVersion: SecureVersion
  maxVersion: SecureVersion
} {
  return {
    minVersion: MIN_TLS_VERSION,
    maxVersion: 'TLSv1.3',
  }
}

/**
 * Content Security Policy middleware — restricts script, style, image, and frame sources
 * to mitigate XSS and clickjacking (NFR-M-03, M11-S1).
 */
export function contentSecurityPolicy(options?: SecurityMiddlewareOptions): MiddlewareHandler {
  const directives = resolveCspDirectives(options?.directives)
  const reportOnly = resolveReportOnly(options)
  const reportUri = resolveReportUri(options)
  const headerValue = formatCspHeader(directives, reportUri)
  const headerName = reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy'

  return async (c, next) => {
    c.header(headerName, headerValue)
    await next()
  }
}

/**
 * Strict-Transport-Security middleware (M11-S2).
 * Emitted only on HTTPS responses so local HTTP dev is unaffected.
 */
export function strictTransportSecurity(options?: TlsMiddlewareOptions): MiddlewareHandler {
  return async (c, next) => {
    const hstsHeader = resolveHstsHeader(options)
    if (hstsHeader && isSecureRequest(c)) {
      c.header('Strict-Transport-Security', hstsHeader)
    }
    await next()
  }
}

/**
 * Rejects non-HTTPS requests in production (M11-S2).
 * Render and similar platforms set X-Forwarded-Proto=https for TLS-terminated traffic.
 */
export function requireTls(options?: TlsMiddlewareOptions): MiddlewareHandler {
  return async (c, next) => {
    if (shouldEnforceTls(options) && !isSecureRequest(c)) {
      return c.json(
        {
          error: 'HTTPS is required. TLS 1.2 or higher must be used for all connections.',
          code: 'TLS_REQUIRED',
        },
        403,
      )
    }
    await next()
  }
}

/** Global security middleware: TLS enforcement, HSTS, and CSP (M11-S1, M11-S2). */
export function securityMiddleware(options?: SecurityMiddlewareOptions): MiddlewareHandler {
  const tlsOpts = options?.tls
  const cspMw = contentSecurityPolicy(options)

  return async (c, next) => {
    if (shouldEnforceTls(tlsOpts) && !isSecureRequest(c)) {
      return c.json(
        {
          error: 'HTTPS is required. TLS 1.2 or higher must be used for all connections.',
          code: 'TLS_REQUIRED',
        },
        403,
      )
    }

    const hstsHeader = resolveHstsHeader(tlsOpts)
    if (hstsHeader && isSecureRequest(c)) {
      c.header('Strict-Transport-Security', hstsHeader)
    }

    return cspMw(c, next)
  }
}
