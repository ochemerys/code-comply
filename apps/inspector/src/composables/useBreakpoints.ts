import { computed } from 'vue'
import { useBreakpoints as useVueUseBreakpoints } from '@vueuse/core'

const screens = {
  tablet: 768,
  tabletL: 1024,
  desktop: 1280,
} as const

export function useBreakpoints() {
  const breakpoints = useVueUseBreakpoints(screens)
  const isTablet = breakpoints.greaterOrEqual('tablet')
  const isTabletLandscape = breakpoints.greaterOrEqual('tabletL')
  const isDesktop = breakpoints.greaterOrEqual('desktop')
  const isPhone = computed(() => !isTablet.value)

  return {
    isPhone,
    isTablet,
    isTabletLandscape,
    isDesktop,
  }
}
