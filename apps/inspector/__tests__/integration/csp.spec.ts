import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import {
  formatInspectorCspContent,
  injectCspMetaIntoHtml,
  resolveInspectorCspDirectives,
} from '../../src/lib/csp-policy'

const indexPath = resolve(__dirname, '../../index.html')

describe('Content-Security-Policy meta tag (NFR-M-03)', () => {
  it('index.html includes a CSP meta tag matching the inspector policy', () => {
    const raw = readFileSync(indexPath, 'utf8')
    const content = formatInspectorCspContent(
      resolveInspectorCspDirectives({
        apiUrl: 'https://api.example.com',
      }),
    )
    const html = injectCspMetaIntoHtml(raw, content)
    const doc = new JSDOM(html).window.document
    const meta = doc.querySelector('meta[http-equiv="Content-Security-Policy"]')

    expect(meta).not.toBeNull()
    expect(meta?.getAttribute('content')).toBe(content)
    expect(content).toContain("default-src 'self'")
    expect(content).toContain("script-src 'self'")
    expect(content).toContain("object-src 'none'")
    expect(content).toContain("worker-src 'self' blob:")
    expect(content).toContain("frame-ancestors 'none'")
    expect(content).toContain('https://api.example.com')
  })
})
