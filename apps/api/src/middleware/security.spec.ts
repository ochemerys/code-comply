import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import {
  DEFAULT_CSP_DIRECTIVES,
  DEFAULT_HSTS_HEADER,
  MIN_TLS_VERSION,
  contentSecurityPolicy,
  formatCspHeader,
  isSecureRequest,
  nodeTlsServerOptions,
  requireTls,
  resolveCspDirectives,
  resolveHstsHeader,
  securityMiddleware,
  shouldEnforceTls,
  strictTransportSecurity,
} from './security.js'

describe('security middleware (M11-S1)', () => {
  const envSnapshot = { ...process.env }

  beforeEach(() => {
    delete process.env.CSP_REPORT_ONLY
    delete process.env.CSP_REPORT_URI
    delete process.env.CSP_CONNECT_SRC
    delete process.env.INSPECTOR_URL
    delete process.env.ADMIN_URL
    delete process.env.API_PUBLIC_URL
    delete process.env.HSTS_ENABLED
    delete process.env.HSTS_HEADER
    delete process.env.TLS_ENFORCE
    process.env.NODE_ENV = 'test'
  })

  afterEach(() => {
    process.env = { ...envSnapshot }
  })

  describe('resolveCspDirectives', () => {
    it('returns default directives from story specification', () => {
      const directives = resolveCspDirectives()
      expect(directives['default-src']).toBe("'self'")
      expect(directives['script-src']).toBe("'self'")
      expect(directives['style-src']).toBe("'self' 'unsafe-inline'")
      expect(directives['img-src']).toBe("'self' data: blob: https:")
      expect(directives['frame-ancestors']).toBe("'none'")
      expect(directives['form-action']).toBe("'self'")
    })

    it('merges configured frontend URLs into connect-src', () => {
      process.env.INSPECTOR_URL = 'http://localhost:3000'
      process.env.ADMIN_URL = 'http://localhost:3001'
      const directives = resolveCspDirectives()
      expect(directives['connect-src']).toContain("'self'")
      expect(directives['connect-src']).toContain('http://localhost:3000')
      expect(directives['connect-src']).toContain('http://localhost:3001')
    })

    it('merges CSP_CONNECT_SRC into connect-src', () => {
      process.env.CSP_CONNECT_SRC = 'https://api.example.com wss://realtime.example.com'
      const directives = resolveCspDirectives()
      expect(directives['connect-src']).toContain('https://api.example.com')
      expect(directives['connect-src']).toContain('wss://realtime.example.com')
    })
  })

  describe('formatCspHeader', () => {
    it('serializes directives in stable order', () => {
      const header = formatCspHeader(DEFAULT_CSP_DIRECTIVES)
      expect(header).toContain("default-src 'self'")
      expect(header).toContain("script-src 'self'")
      expect(header).toContain("style-src 'self' 'unsafe-inline'")
      expect(header).toContain("img-src 'self' data: blob: https:")
      expect(header).toContain("worker-src 'self' blob:")
      expect(header).toContain("object-src 'none'")
      expect(header).toContain("base-uri 'self'")
      expect(header).toContain("frame-ancestors 'none'")
      expect(header).toContain("form-action 'self'")
    })

    it('appends report-uri when provided', () => {
      const header = formatCspHeader(DEFAULT_CSP_DIRECTIVES, 'https://reports.example.com/csp')
      expect(header).toContain('report-uri https://reports.example.com/csp')
    })
  })

  describe('contentSecurityPolicy', () => {
    function appWithCsp(options?: Parameters<typeof contentSecurityPolicy>[0]) {
      const app = new Hono()
      app.use('*', contentSecurityPolicy(options))
      app.get('/health', (c) => c.json({ status: 'ok' }))
      return app
    }

    it('sets Content-Security-Policy in production mode', async () => {
      const app = appWithCsp({ reportOnly: false })
      const res = await app.request('/health')
      expect(res.headers.get('Content-Security-Policy')).toContain("script-src 'self'")
      expect(res.headers.get('Content-Security-Policy-Report-Only')).toBeNull()
    })

    it('uses report-only header when configured for testing', async () => {
      const app = appWithCsp({ reportOnly: true, reportUri: 'https://reports.example.com/csp' })
      const res = await app.request('/health')
      const reportOnly = res.headers.get('Content-Security-Policy-Report-Only')
      expect(reportOnly).toContain("script-src 'self'")
      expect(reportOnly).toContain('report-uri https://reports.example.com/csp')
      expect(res.headers.get('Content-Security-Policy')).toBeNull()
    })

    it('respects CSP_REPORT_ONLY env when options omit reportOnly', async () => {
      process.env.CSP_REPORT_ONLY = 'false'
      process.env.NODE_ENV = 'development'
      const app = appWithCsp()
      const res = await app.request('/health')
      expect(res.headers.get('Content-Security-Policy')).toBeTruthy()
    })

    it('uses CSP_REPORT_URI from environment', async () => {
      process.env.CSP_REPORT_URI = 'https://reports.example.com/env'
      const app = appWithCsp({ reportOnly: true })
      const res = await app.request('/health')
      expect(res.headers.get('Content-Security-Policy-Report-Only')).toContain(
        'report-uri https://reports.example.com/env',
      )
    })

    it('restricts script sources to self (XSS / inline script mitigation)', async () => {
      const app = appWithCsp({ reportOnly: false })
      const res = await app.request('/health')
      const csp = res.headers.get('Content-Security-Policy') ?? ''
      const scriptSrc = csp.match(/script-src[^;]+/)?.[0] ?? ''
      expect(scriptSrc).toMatch(/script-src 'self'/)
      expect(scriptSrc).not.toContain('unsafe-inline')
      expect(scriptSrc).not.toContain('unsafe-eval')
    })

    it('restricts style, image, and frame sources', async () => {
      const app = appWithCsp({ reportOnly: false })
      const res = await app.request('/health')
      const csp = res.headers.get('Content-Security-Policy') ?? ''
      expect(csp).toContain("style-src 'self' 'unsafe-inline'")
      expect(csp).toContain("img-src 'self' data: blob: https:")
      expect(csp).toContain("object-src 'none'")
      expect(csp).toContain("worker-src 'self' blob:")
      expect(csp).toContain("base-uri 'self'")
      expect(csp).toContain("frame-ancestors 'none'")
    })
  })

  describe('securityMiddleware', () => {
    it('delegates to contentSecurityPolicy', async () => {
      const app = new Hono()
      app.use('*', securityMiddleware({ reportOnly: false }))
      app.get('/', (c) => c.text('ok'))
      const res = await app.request('/')
      expect(res.headers.get('Content-Security-Policy')).toBeTruthy()
    })

    it('sets HSTS when HTTPS is detected via X-Forwarded-Proto', async () => {
      const app = new Hono()
      app.use('*', securityMiddleware({ tls: { enableHsts: true } }))
      app.get('/', (c) => c.text('ok'))
      const res = await app.request('/', {
        headers: { 'X-Forwarded-Proto': 'https' },
      })
      expect(res.headers.get('Strict-Transport-Security')).toBe(DEFAULT_HSTS_HEADER)
    })
  })

  describe('TLS / HSTS (M11-S2)', () => {
    it('resolveHstsHeader returns default in production', () => {
      process.env.NODE_ENV = 'production'
      expect(resolveHstsHeader()).toBe(DEFAULT_HSTS_HEADER)
    })

    it('resolveHstsHeader is disabled in non-production by default', () => {
      process.env.NODE_ENV = 'development'
      expect(resolveHstsHeader()).toBeUndefined()
    })

    it('resolveHstsHeader respects HSTS_ENABLED=true in development', () => {
      process.env.NODE_ENV = 'development'
      process.env.HSTS_ENABLED = 'true'
      expect(resolveHstsHeader()).toBe(DEFAULT_HSTS_HEADER)
    })

    it('shouldEnforceTls is true in production by default', () => {
      process.env.NODE_ENV = 'production'
      expect(shouldEnforceTls()).toBe(true)
    })

    it('shouldEnforceTls is false in test/development by default', () => {
      process.env.NODE_ENV = 'development'
      expect(shouldEnforceTls()).toBe(false)
    })

    it('nodeTlsServerOptions enforces TLS 1.2 minimum', () => {
      expect(nodeTlsServerOptions()).toEqual({
        minVersion: MIN_TLS_VERSION,
        maxVersion: 'TLSv1.3',
      })
    })

    it('isSecureRequest detects X-Forwarded-Proto https', async () => {
      const app = new Hono()
      app.get('/', (c) => c.json({ secure: isSecureRequest(c) }))
      const res = await app.request('/', { headers: { 'X-Forwarded-Proto': 'https' } })
      expect((await res.json()).secure).toBe(true)
    })

    it('isSecureRequest detects plain HTTP proxy header', async () => {
      const app = new Hono()
      app.get('/', (c) => c.json({ secure: isSecureRequest(c) }))
      const res = await app.request('/', { headers: { 'X-Forwarded-Proto': 'http' } })
      expect((await res.json()).secure).toBe(false)
    })

    it('requireTls rejects non-HTTPS when enforcement enabled', async () => {
      const app = new Hono()
      app.use('*', requireTls({ enforceTls: true }))
      app.get('/health', (c) => c.json({ status: 'ok' }))
      const res = await app.request('/health')
      expect(res.status).toBe(403)
      const body = (await res.json()) as { code: string }
      expect(body.code).toBe('TLS_REQUIRED')
    })

    it('requireTls allows HTTPS via X-Forwarded-Proto', async () => {
      const app = new Hono()
      app.use('*', requireTls({ enforceTls: true }))
      app.get('/health', (c) => c.json({ status: 'ok' }))
      const res = await app.request('/health', {
        headers: { 'X-Forwarded-Proto': 'https' },
      })
      expect(res.status).toBe(200)
    })

    it('strictTransportSecurity sets HSTS only on secure requests', async () => {
      const app = new Hono()
      app.use('*', strictTransportSecurity({ enableHsts: true }))
      app.get('/health', (c) => c.json({ status: 'ok' }))

      const insecure = await app.request('/health')
      expect(insecure.headers.get('Strict-Transport-Security')).toBeNull()

      const secure = await app.request('/health', {
        headers: { 'X-Forwarded-Proto': 'https' },
      })
      expect(secure.headers.get('Strict-Transport-Security')).toBe(DEFAULT_HSTS_HEADER)
    })
  })
})
