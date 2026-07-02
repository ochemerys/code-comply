import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import {
  DEFAULT_SECURITY_HEADERS,
  securityHeadersMiddleware,
  securityHeadersValid,
  verifySecurityHeaders,
} from './security-headers.js'

describe('security headers middleware (M11-S7)', () => {
  it('emits required security headers on responses', async () => {
    const app = new Hono()
    app.use('*', securityHeadersMiddleware())
    app.get('/health', (c) => c.json({ ok: true }))

    const res = await app.request('/health')
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Frame-Options')).toBe(DEFAULT_SECURITY_HEADERS['X-Frame-Options'])
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer')
    expect(res.headers.get('Permissions-Policy')).toBe(
      DEFAULT_SECURITY_HEADERS['Permissions-Policy'],
    )
  })

  it('verifySecurityHeaders reports pass for complete header set', () => {
    const headers = new Headers(Object.entries(DEFAULT_SECURITY_HEADERS))
    const checks = verifySecurityHeaders(headers)
    expect(checks.every((c) => c.passed)).toBe(true)
    expect(securityHeadersValid(headers)).toBe(true)
  })

  it('verifySecurityHeaders reports failures for missing headers', () => {
    const headers = new Headers()
    const checks = verifySecurityHeaders(headers)
    expect(checks.some((c) => !c.passed)).toBe(true)
    expect(securityHeadersValid(headers)).toBe(false)
  })
})
