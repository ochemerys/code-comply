import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const viteConfig = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../vite.config.ts'),
  'utf8',
)

describe('inspector bundle splitting (M11-S8)', () => {
  it('configures manual chunks for heavy vendor libraries', () => {
    expect(viteConfig).toContain('manualChunks')
    expect(viteConfig).toContain('vendor-fabric')
  })
})
