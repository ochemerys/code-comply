import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Hono } from 'hono'
import {
  DEFAULT_RATE_LIMITS,
  MemoryRateLimitStore,
  checkRateLimit,
  loginRateLimitMiddleware,
  rateLimitMiddleware,
  resolveClientIp,
  resolveRateLimitConfig,
} from './rate-limit.js'

describe('rate-limit middleware (M11-S6)', () => {
  const envSnapshot = { ...process.env }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-19T12:00:00.000Z'))
    delete process.env.RATE_LIMIT_LOGIN_MAX
    delete process.env.RATE_LIMIT_API_MAX
    delete process.env.RATE_LIMIT_UPLOAD_MAX
    delete process.env.RATE_LIMIT_WINDOW_MS
  })

  afterEach(() => {
    vi.useRealTimers()
    process.env = { ...envSnapshot }
  })

  describe('resolveRateLimitConfig', () => {
    it('returns story defaults for login, api, and upload', () => {
      expect(resolveRateLimitConfig('login')).toEqual(DEFAULT_RATE_LIMITS.login)
      expect(resolveRateLimitConfig('api')).toEqual(DEFAULT_RATE_LIMITS.api)
      expect(resolveRateLimitConfig('upload')).toEqual(DEFAULT_RATE_LIMITS.upload)
    })

    it('honors env overrides', () => {
      process.env.RATE_LIMIT_LOGIN_MAX = '3'
      process.env.RATE_LIMIT_WINDOW_MS = '30000'
      expect(resolveRateLimitConfig('login')).toEqual({ limit: 3, windowMs: 30_000 })
    })
  })

  describe('checkRateLimit', () => {
    it('allows requests under the limit', () => {
      const store = new MemoryRateLimitStore()
      const config = { limit: 3, windowMs: 60_000 }

      for (let i = 0; i < 3; i++) {
        const result = checkRateLimit(['login:ip:1.2.3.4'], config, store)
        expect(result.limited).toBe(false)
        expect(result.remaining).toBe(3 - (i + 1))
      }
    })

    it('returns limited when the limit is exceeded', () => {
      const store = new MemoryRateLimitStore()
      const config = { limit: 2, windowMs: 60_000 }
      const keys = ['login:ip:1.2.3.4']

      checkRateLimit(keys, config, store)
      checkRateLimit(keys, config, store)
      const blocked = checkRateLimit(keys, config, store)

      expect(blocked.limited).toBe(true)
      expect(blocked.remaining).toBe(0)
    })

    it('resets the counter after the window expires', () => {
      const store = new MemoryRateLimitStore()
      const config = { limit: 2, windowMs: 60_000 }
      const keys = ['login:ip:1.2.3.4']

      checkRateLimit(keys, config, store)
      checkRateLimit(keys, config, store)
      expect(checkRateLimit(keys, config, store).limited).toBe(true)

      vi.advanceTimersByTime(60_001)

      const afterReset = checkRateLimit(keys, config, store)
      expect(afterReset.limited).toBe(false)
      expect(afterReset.remaining).toBe(1)
    })
  })

  describe('loginRateLimitMiddleware', () => {
    it('returns 429 when login attempts exceed the limit', async () => {
      const store = new MemoryRateLimitStore()
      const app = new Hono()
      app.use('*', loginRateLimitMiddleware({ config: { limit: 2, windowMs: 60_000 }, store }))
      app.post('/auth/login', (c) => c.json({ ok: true }))

      const headers = { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.0.1' }

      expect(
        (await app.request('/auth/login', { method: 'POST', headers, body: '{}' })).status,
      ).toBe(200)
      expect(
        (await app.request('/auth/login', { method: 'POST', headers, body: '{}' })).status,
      ).toBe(200)

      const blocked = await app.request('/auth/login', { method: 'POST', headers, body: '{}' })
      expect(blocked.status).toBe(429)
      const body = (await blocked.json()) as { code: string; error: string }
      expect(body.code).toBe('RATE_LIMIT_EXCEEDED')
      expect(body.error).toBe('Too Many Requests')
      expect(blocked.headers.get('Retry-After')).toBeTruthy()
      expect(blocked.headers.get('X-RateLimit-Limit')).toBe('2')
    })

    it('tracks limits per IP independently', async () => {
      const store = new MemoryRateLimitStore()
      const app = new Hono()
      app.use('*', loginRateLimitMiddleware({ config: { limit: 1, windowMs: 60_000 }, store }))
      app.post('/auth/login', (c) => c.json({ ok: true }))

      const first = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'X-Forwarded-For': '10.0.0.1' },
        body: '{}',
      })
      const secondIp = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'X-Forwarded-For': '10.0.0.2' },
        body: '{}',
      })

      expect(first.status).toBe(200)
      expect(secondIp.status).toBe(200)
    })
  })

  describe('rateLimitMiddleware per-user', () => {
    it('enforces limits per user when userId is on context', async () => {
      const store = new MemoryRateLimitStore()
      const app = new Hono<{ Variables: { userId: string } }>()
      app.use('*', async (c, next) => {
        c.set('userId', 'user-a')
        await next()
      })
      app.use('*', rateLimitMiddleware('api', { config: { limit: 2, windowMs: 60_000 }, store }))
      app.get('/api/test', (c) => c.json({ ok: true }))

      expect(
        (await app.request('/api/test', { headers: { 'X-Forwarded-For': '10.0.0.1' } })).status,
      ).toBe(200)
      expect(
        (await app.request('/api/test', { headers: { 'X-Forwarded-For': '10.0.0.1' } })).status,
      ).toBe(200)

      const blocked = await app.request('/api/test', { headers: { 'X-Forwarded-For': '10.0.0.1' } })
      expect(blocked.status).toBe(429)
    })
  })

  describe('resolveClientIp', () => {
    it('prefers X-Forwarded-For', async () => {
      const app = new Hono()
      app.get('/ip', (c) => c.text(resolveClientIp(c)))

      const res = await app.request('/ip', {
        headers: { 'X-Forwarded-For': '203.0.113.1, 10.0.0.1' },
      })
      expect(await res.text()).toBe('203.0.113.1')
    })
  })
})
