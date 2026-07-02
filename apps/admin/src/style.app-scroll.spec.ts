import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * M9-S1-B1: With html/body overflow hidden (global shell), #app must scroll
 * so short viewports can reach full login (and other tall) content.
 */
const stylePath = join(dirname(fileURLToPath(import.meta.url)), 'style.css')

describe('style.css app scroll root (M9-S1-B1)', () => {
  it('declares #app as vertical scroll container', () => {
    const css = readFileSync(stylePath, 'utf-8')
    const appRule = css.match(/#app\s*\{[^}]+\}/s)
    expect(appRule?.[0] ?? '').toMatch(/overflow-y:\s*auto/)
    expect(appRule?.[0] ?? '').toMatch(/height:\s*100%/)
  })
})
