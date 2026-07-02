import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { app } from '../../src/app.js'

describe('CORS integration', () => {
  const envSnapshot = { ...process.env }

  beforeEach(() => {
    process.env = { ...envSnapshot }
    process.env.NODE_ENV = 'test'
    delete process.env.INSPECTOR_URL
    delete process.env.ADMIN_URL
    delete process.env.EXTRA_CORS_ORIGINS
  })

  afterEach(() => {
    process.env = { ...envSnapshot }
  })

  function preflight(origin: string) {
    return app.request('/health', {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'GET',
        'X-Forwarded-Proto': 'https',
      },
    })
  }

  it('rejects unknown Render origins', async () => {
    const res = await preflight('https://evil.onrender.com')

    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('allows configured inspector and admin origins', async () => {
    process.env.INSPECTOR_URL = 'https://inspector-pwa-staging.onrender.com'
    process.env.ADMIN_URL = 'https://admin-portal-staging.onrender.com'

    const inspector = await preflight('https://inspector-pwa-staging.onrender.com')
    const admin = await preflight('https://admin-portal-staging.onrender.com')

    expect(inspector.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://inspector-pwa-staging.onrender.com',
    )
    expect(admin.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://admin-portal-staging.onrender.com',
    )
  })

  it('allows explicitly configured extra origins', async () => {
    process.env.EXTRA_CORS_ORIGINS = 'https://preview-a.example.com, https://preview-b.example.com'

    const res = await preflight('https://preview-b.example.com')

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://preview-b.example.com')
  })

  it('allows origins when env URLs have a trailing slash', async () => {
    process.env.INSPECTOR_URL = 'https://inspector-pwa-staging.onrender.com/'

    const res = await preflight('https://inspector-pwa-staging.onrender.com')

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://inspector-pwa-staging.onrender.com',
    )
  })

  it('does not allow localhost origins in production', async () => {
    process.env.NODE_ENV = 'production'

    const res = await preflight('http://localhost:5175')

    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
})
