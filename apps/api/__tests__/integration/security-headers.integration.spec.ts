import { describe, it, expect, afterEach } from 'vitest'
import { app } from '../../src/app.js'
import { DEFAULT_HSTS_HEADER } from '../../src/middleware/security.js'

import { DEFAULT_SECURITY_HEADERS } from '../../src/middleware/security-headers.js'

describe('Security headers integration (M11-S1, M11-S2, M11-S7)', () => {
  afterEach(() => {
    delete process.env.HSTS_ENABLED
    delete process.env.TLS_ENFORCE
  })

  it('includes CSP on public health endpoint', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)

    const csp =
      res.headers.get('Content-Security-Policy') ??
      res.headers.get('Content-Security-Policy-Report-Only')
    expect(csp).toBeTruthy()
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("worker-src 'self' blob:")
    expect(csp).toContain("base-uri 'self'")
    expect(res.headers.get('Referrer-Policy')).toBe(DEFAULT_SECURITY_HEADERS['Referrer-Policy'])
    expect(res.headers.get('Permissions-Policy')).toBe(
      DEFAULT_SECURITY_HEADERS['Permissions-Policy'],
    )
  })

  it('includes standard security headers (M11-S7)', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    for (const [name, value] of Object.entries(DEFAULT_SECURITY_HEADERS)) {
      expect(res.headers.get(name)).toBe(value)
    }
  })

  it('includes HSTS when request is HTTPS via proxy header (M11-S2)', async () => {
    process.env.HSTS_ENABLED = 'true'
    const res = await app.request('/health', {
      headers: { 'X-Forwarded-Proto': 'https' },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('Strict-Transport-Security')).toBe(DEFAULT_HSTS_HEADER)
  })

  it('rejects plain HTTP when TLS enforcement is enabled (M11-S2)', async () => {
    process.env.TLS_ENFORCE = 'true'
    const res = await app.request('/health')
    expect(res.status).toBe(403)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe('TLS_REQUIRED')
  })

  it('includes CSP on OpenAPI documentation route', async () => {
    const res = await app.request('/openapi.json', {
      headers: { 'X-Forwarded-Proto': 'https' },
    })
    expect(res.status).toBe(200)

    const csp =
      res.headers.get('Content-Security-Policy') ??
      res.headers.get('Content-Security-Policy-Report-Only')
    expect(csp).toContain("form-action 'self'")
  })
})
