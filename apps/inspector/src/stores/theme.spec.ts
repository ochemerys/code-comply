import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useThemeStore } from './theme'

describe('theme store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    document.documentElement.removeAttribute('data-contrast')
  })

  it('applies normal contrast by default', () => {
    const themeStore = useThemeStore()

    themeStore.initTheme()

    expect(themeStore.isHighContrast).toBe(false)
    expect(document.documentElement.dataset.contrast).toBe('normal')
  })

  it('toggles and persists outdoor mode', async () => {
    const themeStore = useThemeStore()

    themeStore.toggleHighContrast()
    await nextTick()

    expect(themeStore.isHighContrast).toBe(true)
    expect(document.documentElement.dataset.contrast).toBe('high')

    setActivePinia(createPinia())
    const rehydratedThemeStore = useThemeStore()

    expect(rehydratedThemeStore.isHighContrast).toBe(true)
  })

  it('sets outdoor mode from explicit UI state', () => {
    const themeStore = useThemeStore()

    themeStore.setHighContrast(true)
    expect(document.documentElement.dataset.contrast).toBe('high')

    themeStore.setHighContrast(false)
    expect(document.documentElement.dataset.contrast).toBe('normal')
  })
})
