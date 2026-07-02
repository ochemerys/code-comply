import { defineStore } from 'pinia'
import { watch } from 'vue'
import { useStorage } from '@vueuse/core'

export const useThemeStore = defineStore('theme', () => {
  const isDark = useStorage('theme-dark-mode', false)
  const isHighContrast = useStorage('outdoor-mode', false)

  const initTheme = () => {
    applyTheme()
  }

  const toggleDarkMode = () => {
    isDark.value = !isDark.value
  }

  const toggleHighContrast = () => {
    isHighContrast.value = !isHighContrast.value
    applyTheme()
  }

  const setHighContrast = (enabled: boolean) => {
    isHighContrast.value = enabled
    applyTheme()
  }

  const applyTheme = () => {
    if (isDark.value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    document.documentElement.dataset.contrast = isHighContrast.value ? 'high' : 'normal'
  }

  // Watch for changes
  watch([isDark, isHighContrast], () => {
    applyTheme()
  })

  return {
    isDark,
    isHighContrast,
    initTheme,
    toggleDarkMode,
    toggleHighContrast,
    setHighContrast,
  }
})
