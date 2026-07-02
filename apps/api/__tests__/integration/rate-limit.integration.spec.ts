import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resetDefaultRateLimitStore } from '../../src/middleware/rate-limit.js'

const ROUTE_USER = `rate-limit-user-${Date.now()}`

vi.mock('../../src/middleware/auth.middleware.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/middleware/auth.middleware.js')>()
  return {
    ...actual,
    authMiddleware: vi.fn(
      async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
        c.set('userId', ROUTE_USER)
        await next()
      },
    ),
  }
})

const { app } = await import('../../src/app.js')

describe.sequential('Rate limiting integration (M11-S6)', () => {
  beforeEach(() => {
    process.env.RATE_LIMIT_LOGIN_MAX = '3'
    process.env.RATE_LIMIT_API_MAX = '4'
    process.env.RATE_LIMIT_UPLOAD_MAX = '2'
    process.env.RATE_LIMIT_WINDOW_MS = '60000'
    resetDefaultRateLimitStore()
  })

  afterEach(() => {
    resetDefaultRateLimitStore()
    delete process.env.RATE_LIMIT_LOGIN_MAX
    delete process.env.RATE_LIMIT_API_MAX
    delete process.env.RATE_LIMIT_UPLOAD_MAX
    delete process.env.RATE_LIMIT_WINDOW_MS
  })

  it('returns 429 on login after exceeding per-IP limit', async () => {
    const headers = {
      'Content-Type': 'application/json',
      'X-Forwarded-For': `login-ip-${Date.now()}`,
    }
    const body = JSON.stringify({ email: 'test@example.com', password: 'wrong-password' })

    for (let i = 0; i < 3; i++) {
      const res = await app.request('/auth/login', { method: 'POST', headers, body })
      expect(res.status).toBe(401)
    }

    const blocked = await app.request('/auth/login', { method: 'POST', headers, body })
    expect(blocked.status).toBe(429)
    const payload = (await blocked.json()) as { code: string }
    expect(payload.code).toBe('RATE_LIMIT_EXCEEDED')
    expect(blocked.headers.get('Retry-After')).toBeTruthy()
  })

  it('returns 429 on protected API routes after exceeding limit', async () => {
    const headers = { 'X-Forwarded-For': `api-ip-${Date.now()}` }

    for (let i = 0; i < 4; i++) {
      const res = await app.request('/api/permits', { headers })
      expect(res.status).not.toBe(429)
    }

    const blocked = await app.request('/api/permits', { headers })
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('X-RateLimit-Limit')).toBe('4')
  })

  it('does not rate limit the public health endpoint', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await app.request('/health')
      expect(res.status).toBe(200)
    }
  })
})
