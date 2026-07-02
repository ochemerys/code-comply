import type { Context, MiddlewareHandler } from 'hono'

/** Rate limit categories per M11-S6. */
export type RateLimitKind = 'login' | 'api' | 'upload'

export interface RateLimitConfig {
  limit: number
  windowMs: number
}

/** Default limits from M11-S6 story specification. */
export const DEFAULT_RATE_LIMITS: Record<RateLimitKind, RateLimitConfig> = {
  login: { limit: 5, windowMs: 60_000 },
  api: { limit: 100, windowMs: 60_000 },
  upload: { limit: 10, windowMs: 60_000 },
}

export interface RateLimitResult {
  limited: boolean
  limit: number
  remaining: number
  resetAt: number
}

interface WindowRecord {
  count: number
  windowStart: number
}

/** In-memory sliding-window counter store (single-process; suitable for dev/single-node). */
export class MemoryRateLimitStore {
  private buckets = new Map<string, WindowRecord>()

  increment(key: string, windowMs: number, now = Date.now()): RateLimitResult {
    const record = this.buckets.get(key)
    if (!record || now - record.windowStart >= windowMs) {
      this.buckets.set(key, { count: 1, windowStart: now })
      const resetAt = now + windowMs
      return { limited: false, limit: 0, remaining: 0, resetAt }
    }

    record.count += 1
    return {
      limited: false,
      limit: 0,
      remaining: 0,
      resetAt: record.windowStart + windowMs,
    }
  }

  getCount(key: string, windowMs: number, now = Date.now()): number {
    const record = this.buckets.get(key)
    if (!record || now - record.windowStart >= windowMs) {
      return 0
    }
    return record.count
  }

  getResetAt(key: string, windowMs: number, now = Date.now()): number {
    const record = this.buckets.get(key)
    if (!record || now - record.windowStart >= windowMs) {
      return now + windowMs
    }
    return record.windowStart + windowMs
  }

  reset(): void {
    this.buckets.clear()
  }
}

const defaultStore = new MemoryRateLimitStore()

function parseEnvLimit(kind: RateLimitKind): number | undefined {
  const envKey = `RATE_LIMIT_${kind.toUpperCase()}_MAX`
  const raw = process.env[envKey]?.trim()
  if (!raw) return undefined
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function parseEnvWindowMs(): number | undefined {
  const raw = process.env.RATE_LIMIT_WINDOW_MS?.trim()
  if (!raw) return undefined
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

/** Resolve effective rate limit config, honoring env overrides. */
export function resolveRateLimitConfig(
  kind: RateLimitKind,
  overrides?: Partial<RateLimitConfig>,
): RateLimitConfig {
  const defaults = DEFAULT_RATE_LIMITS[kind]
  const windowMs = overrides?.windowMs ?? parseEnvWindowMs() ?? defaults.windowMs
  const limit = overrides?.limit ?? parseEnvLimit(kind) ?? defaults.limit
  return { limit, windowMs }
}

/** Extract client IP from reverse-proxy headers or connection metadata. */
export function resolveClientIp(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for')
  if (forwarded) {
    const primary = forwarded.split(',')[0]?.trim()
    if (primary) return primary
  }
  const realIp = c.req.header('x-real-ip')?.trim()
  if (realIp) return realIp
  return 'unknown'
}

function buildRateLimitKeys(c: Context, kind: RateLimitKind): string[] {
  const ip = resolveClientIp(c)
  const keys = [`${kind}:ip:${ip}`]

  if (kind !== 'login') {
    const userId = c.get('userId') as string | undefined
    if (userId) {
      keys.push(`${kind}:user:${userId}`)
    }
  }

  return keys
}

/** Check and increment counters; returns limited=true when any key exceeds the limit. */
export function checkRateLimit(
  keys: string[],
  config: RateLimitConfig,
  store: MemoryRateLimitStore = defaultStore,
  now = Date.now(),
): RateLimitResult {
  for (const key of keys) {
    const current = store.getCount(key, config.windowMs, now)
    if (current >= config.limit) {
      return {
        limited: true,
        limit: config.limit,
        remaining: 0,
        resetAt: store.getResetAt(key, config.windowMs, now),
      }
    }
  }

  let maxCount = 0
  let resetAt = now + config.windowMs
  for (const key of keys) {
    store.increment(key, config.windowMs, now)
    const count = store.getCount(key, config.windowMs, now)
    maxCount = Math.max(maxCount, count)
    resetAt = Math.max(resetAt, store.getResetAt(key, config.windowMs, now))
  }

  return {
    limited: maxCount > config.limit,
    limit: config.limit,
    remaining: Math.max(0, config.limit - maxCount),
    resetAt,
  }
}

function setRateLimitHeaders(c: Context, result: RateLimitResult): void {
  c.header('X-RateLimit-Limit', String(result.limit))
  c.header('X-RateLimit-Remaining', String(result.remaining))
  c.header('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)))
}

function rateLimitExceededResponse(c: Context, result: RateLimitResult) {
  const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))
  c.header('Retry-After', String(retryAfterSeconds))
  setRateLimitHeaders(c, { ...result, remaining: 0 })
  return c.json(
    {
      error: 'Too Many Requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfterSeconds,
    },
    429,
  )
}

export interface RateLimitMiddlewareOptions {
  config?: Partial<RateLimitConfig>
  store?: MemoryRateLimitStore
}

/**
 * Rate limiting middleware factory (M11-S6).
 * Tracks limits per-IP and per-user (when userId is on context).
 */
export function rateLimitMiddleware(
  kind: RateLimitKind,
  options?: RateLimitMiddlewareOptions,
): MiddlewareHandler {
  const store = options?.store ?? defaultStore

  return async (c, next) => {
    const config = resolveRateLimitConfig(kind, options?.config)
    const keys = buildRateLimitKeys(c, kind)
    const result = checkRateLimit(keys, config, store)

    if (result.limited) {
      return rateLimitExceededResponse(c, result)
    }

    setRateLimitHeaders(c, result)
    await next()
  }
}

/** Login route limiter — 5 attempts per minute per IP (M11-S6). */
export function loginRateLimitMiddleware(options?: RateLimitMiddlewareOptions): MiddlewareHandler {
  return rateLimitMiddleware('login', options)
}

/** General API limiter — 100 requests per minute per IP and per user (M11-S6). */
export function apiRateLimitMiddleware(options?: RateLimitMiddlewareOptions): MiddlewareHandler {
  return rateLimitMiddleware('api', options)
}

/** Upload limiter — 10 uploads per minute per IP and per user (M11-S6). */
export function uploadRateLimitMiddleware(options?: RateLimitMiddlewareOptions): MiddlewareHandler {
  const limiter = rateLimitMiddleware('upload', options)
  return async (c, next) => {
    if (c.req.method !== 'POST') {
      await next()
      return
    }
    return limiter(c, next)
  }
}

/** Reset the default in-memory store (for tests). */
export function resetDefaultRateLimitStore(): void {
  defaultStore.reset()
}

/** Access the default store for unit tests. */
export function getDefaultRateLimitStore(): MemoryRateLimitStore {
  return defaultStore
}
