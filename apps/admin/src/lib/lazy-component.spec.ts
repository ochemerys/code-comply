import { describe, it, expect, vi } from 'vitest'
import { defineComponent } from 'vue'
import { defineLazyComponent, lazyView } from './lazy-component'

describe('defineLazyComponent (M11-S8)', () => {
  it('returns a Vue async component with a loader', () => {
    const loader = vi.fn(async () => ({
      __esModule: true,
      default: defineComponent({ template: '<div data-testid="lazy-stub" />' }),
    }))

    const Lazy = defineLazyComponent(loader)

    expect(Lazy).toBeTruthy()
    expect(typeof (Lazy as { __asyncLoader?: unknown }).__asyncLoader).toBe('function')
  })

  it('registers the provided loader function', async () => {
    const loader = vi.fn(async () => ({
      __esModule: true,
      default: defineComponent({ template: '<div />' }),
    }))

    defineLazyComponent(loader)
    expect(loader).not.toHaveBeenCalled()
  })
})

describe('lazyView (M11-S8)', () => {
  it('returns the dynamic import loader unchanged', () => {
    const loader = async () => ({
      __esModule: true,
      default: defineComponent({ template: '<div />' }),
    })
    expect(lazyView(loader)).toBe(loader)
  })
})
