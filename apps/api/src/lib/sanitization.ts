import DOMPurify from 'isomorphic-dompurify'
import validator from 'validator'

/** Keys whose string values are validated as email addresses (lowercase field names). */
const EMAIL_FIELD_KEYS = new Set(['email', 'recipientemail', 'to', 'from', 'replyto'])

/** Keys whose string values are validated as URLs (lowercase field names). */
const URL_FIELD_KEYS = new Set(['url', 'website', 'link', 'href', 'callbackurl', 'redirecturl'])

/** Keys whose string values are treated as file names (lowercase field names). */
const FILENAME_FIELD_KEYS = new Set(['filename', 'originalfilename'])

/** Patterns commonly used in SQL injection attempts (NFR-M-03, M11-S5). */
const SQL_INJECTION_PATTERN =
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|EXECUTE|TRUNCATE)\b)|('|"|;|--|\|\||\/\*|\*\/)/i

/** Detect path traversal in arbitrary strings. */
const PATH_TRAVERSAL_PATTERN = /(\.\.(\/|\\|%2f|%5c|%252f|%255c))|(?:^|\/|\\)\.\.(?:\/|\\|$)|\0/i

/**
 * Escape HTML in user-supplied text fields to mitigate XSS (M11-S5).
 */
export function escapeHtml(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
}

/**
 * Validate email format using validator.js (M11-S5).
 */
export function isValidEmail(input: string): boolean {
  const trimmed = input.trim()
  return trimmed.length > 0 && validator.isEmail(trimmed)
}

/**
 * Validate URL format using validator.js (M11-S5).
 */
export function isValidUrl(input: string): boolean {
  const trimmed = input.trim()
  return trimmed.length > 0 && validator.isURL(trimmed, { require_protocol: true })
}

/** Returns true when hostname is localhost, link-local, or private RFC1918 space (M11-S7 SSRF). */
export function isPrivateOrReservedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal'
  ) {
    return true
  }

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!ipv4) return false

  const octets = ipv4.slice(1, 5).map((part) => Number(part))
  if (octets.some((n) => n > 255)) return true

  const [a, b] = octets
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  return false
}

/**
 * Validate external URLs and block SSRF targets (private IPs, metadata endpoints) (M11-S7).
 */
export function isSafeExternalUrl(input: string): boolean {
  if (!isValidUrl(input)) return false
  try {
    const url = new URL(input.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    return !isPrivateOrReservedHost(url.hostname)
  } catch {
    return false
  }
}

/**
 * Sanitize a file name to a single safe basename (path traversal prevention).
 */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() || 'upload'
  const withoutTraversal = base.replace(/\.\./g, '')
  const cleaned = withoutTraversal.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180)
  return cleaned.length > 0 ? cleaned : 'upload'
}

/**
 * Validate numeric input; returns null when the value is not a finite number.
 */
export function parseSanitizedNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length === 0) return null
    if (!validator.isNumeric(trimmed, { no_symbols: false })) return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** Returns true when the string contains common SQL injection patterns. */
export function containsSqlInjection(input: string): boolean {
  return SQL_INJECTION_PATTERN.test(input)
}

/** Returns true when the string contains path traversal sequences. */
export function containsPathTraversal(input: string): boolean {
  return PATH_TRAVERSAL_PATTERN.test(input)
}

/** Strip SQL metacharacters from a string (defense in depth for free-text fields). */
export function neutralizeSqlMetacharacters(input: string): string {
  return input.replace(/['";\\]/g, '')
}

/** Returns true when an object key looks like a MongoDB/NoSQL operator. */
export function isNoSqlOperatorKey(key: string): boolean {
  return key.startsWith('$') || key.includes('.')
}

/**
 * Sanitize a single string based on field name context.
 */
export function sanitizeStringValue(value: string, fieldKey?: string): string {
  const key = fieldKey?.toLowerCase() ?? ''

  if (EMAIL_FIELD_KEYS.has(key)) {
    return isValidEmail(value) ? value.trim().toLowerCase() : ''
  }

  if (URL_FIELD_KEYS.has(key)) {
    return isSafeExternalUrl(value) ? value.trim() : ''
  }

  if (FILENAME_FIELD_KEYS.has(key)) {
    return sanitizeFilename(value)
  }

  let sanitized = escapeHtml(value.trim())
  if (containsSqlInjection(sanitized)) {
    sanitized = neutralizeSqlMetacharacters(sanitized)
  }
  if (containsPathTraversal(sanitized)) {
    sanitized = sanitized.replace(PATH_TRAVERSAL_PATTERN, '')
  }
  return sanitized
}

/**
 * Recursively sanitize JSON-like input: escape HTML, strip NoSQL operators,
 * validate typed fields, and normalize numbers (M11-S5).
 */
export function sanitizeDeep(value: unknown, fieldKey?: string): unknown {
  if (value === null || value === undefined) {
    return value
  }

  if (typeof value === 'string') {
    return sanitizeStringValue(value, fieldKey)
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDeep(item))
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (isNoSqlOperatorKey(key)) {
        continue
      }
      result[key] = sanitizeDeep(nested, key)
    }
    return result
  }

  return value
}
