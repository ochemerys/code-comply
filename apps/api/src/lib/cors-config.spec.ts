import { afterEach, describe, expect, it } from 'vitest'
import { getAllowedCorsOrigins, normalizeCorsOrigin, resolveCorsOrigin } from './cors-config.js'

describe('cors-config', () => {
  const envSnapshot = { ...process.env }

  afterEach(() => {
    process.env = { ...envSnapshot }
  })

  it('normalizes trailing slashes', () => {
    expect(normalizeCorsOrigin('https://app.example.com/')).toBe('https://app.example.com')
  })

  it('matches inspector origin when INSPECTOR_URL has a trailing slash', () => {
    process.env.NODE_ENV = 'production'
    process.env.INSPECTOR_URL = 'https://inspector-pwa-staging.onrender.com/'

    expect(resolveCorsOrigin('https://inspector-pwa-staging.onrender.com')).toBe(
      'https://inspector-pwa-staging.onrender.com',
    )
    expect(getAllowedCorsOrigins().has('https://inspector-pwa-staging.onrender.com')).toBe(true)
  })

  it('rejects unknown production origins', () => {
    process.env.NODE_ENV = 'production'
    process.env.INSPECTOR_URL = 'https://inspector-pwa-staging.onrender.com'

    expect(resolveCorsOrigin('https://other.onrender.com')).toBeNull()
  })
})
