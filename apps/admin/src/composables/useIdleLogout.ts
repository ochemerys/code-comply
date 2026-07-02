import { ref, watch, type Ref } from 'vue'
import { useEventListener, useIdle } from '@vueuse/core'
import { getIdleLogoutConfig } from '../lib/idle-logout-config'
import { useAuth } from './useAuth'

export interface UseIdleLogoutOptions {
  enabled: Ref<boolean>
}

function isTabActive(): boolean {
  return typeof document === 'undefined' || !document.hidden
}

/**
 * NFR-A-01 idle auto-logout: warn then hard logout; timers reset when the tab is hidden.
 */
export function useIdleLogout(options: UseIdleLogoutOptions) {
  const config = getIdleLogoutConfig()
  const { logout } = useAuth()
  const showWarnDialog = ref(false)

  const warnIdle = useIdle(config.warnAfterMs, { listenForVisibilityChange: false })
  const logoutIdle = useIdle(config.logoutAfterMs, { listenForVisibilityChange: false })

  function resetTimers() {
    warnIdle.reset()
    logoutIdle.reset()
    showWarnDialog.value = false
  }

  useEventListener(document, 'visibilitychange', () => {
    if (document.hidden) {
      showWarnDialog.value = false
    } else if (options.enabled.value) {
      resetTimers()
    }
  })

  watch(
    options.enabled,
    (enabled) => {
      if (!enabled) {
        resetTimers()
      }
    },
    { immediate: true },
  )

  watch(warnIdle.idle, (idle) => {
    if (idle && options.enabled.value && isTabActive()) {
      showWarnDialog.value = true
    }
  })

  watch(logoutIdle.idle, (idle) => {
    if (idle && options.enabled.value && isTabActive()) {
      showWarnDialog.value = false
      void logout({ reason: 'idle' })
    }
  })

  watch(warnIdle.lastActive, () => {
    showWarnDialog.value = false
  })

  function staySignedIn() {
    resetTimers()
  }

  return {
    showWarnDialog,
    staySignedIn,
  }
}
