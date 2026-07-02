import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const routerSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'index.ts'), 'utf8')

describe('admin router lazy routes (M11-S8)', () => {
  it('uses lazyView for every route component', () => {
    const lazyViewCount = (routerSource.match(/lazyView\(\(\) => import\(/g) ?? []).length
    const bareImportCount = (routerSource.match(/component: \(\) => import\(/g) ?? []).length

    expect(lazyViewCount).toBeGreaterThanOrEqual(10)
    expect(bareImportCount).toBe(0)
  })

  it('does not statically import view components in the router module', () => {
    expect(routerSource).not.toMatch(/from '\.\.\/views\//)
    expect(routerSource).not.toMatch(/from "\.\.\/views\//)
  })
})
