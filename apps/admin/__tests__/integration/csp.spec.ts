import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  formatAdminCspContent,
  formatAdminCspHeaderContent,
  injectCspMetaIntoHtml,
  resolveAdminCspDirectives,
} from '../../src/lib/csp-policy'

const indexPath = resolve(__dirname, '../../index.html')

describe('Content-Security-Policy meta tag (NFR-A-01)', () => {
  it('index.html includes a CSP meta tag matching the admin policy', () => {
    const raw = readFileSync(indexPath, 'utf8')
    const content = formatAdminCspContent(
      resolveAdminCspDirectives({
        apiUrl: 'https://api.example.com',
        sentryDsn: 'https://key@o123.ingest.sentry.io/456',
        isDev: false,
      }),
    )
    const html = injectCspMetaIntoHtml(raw, content)
    const metaMatch = html.match(
      /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i,
    )

    expect(metaMatch).toBeTruthy()
    expect(metaMatch![1]).toBe(content)
    expect(content).toContain("default-src 'self'")
    const scriptSrc = content.match(/script-src[^;]+/)?.[0] ?? ''
    expect(scriptSrc).toBe("script-src 'self'")
    expect(scriptSrc).not.toContain('unsafe-inline')
    expect(content).toContain("font-src 'self' data:")
    expect(content).toContain("object-src 'none'")
    expect(content).toContain('https://api.example.com')
    expect(content).toContain('https://o123.ingest.sentry.io')
  })

  it('omits frame-ancestors from the meta tag (ignored when delivered via <meta>)', () => {
    const directives = resolveAdminCspDirectives({ isDev: false })
    const metaContent = formatAdminCspContent(directives)
    const headerContent = formatAdminCspHeaderContent(directives)

    expect(metaContent).not.toContain('frame-ancestors')
    // frame-ancestors is still enforced, but only via the HTTP response header.
    expect(headerContent).toContain("frame-ancestors 'none'")
  })

  it('dev policy relaxes script-src for Vite HMR', () => {
    const content = formatAdminCspContent(resolveAdminCspDirectives({ isDev: true }))
    expect(content).toContain("script-src 'self' 'unsafe-inline'")
    expect(content).toContain('ws:')
  })
})
