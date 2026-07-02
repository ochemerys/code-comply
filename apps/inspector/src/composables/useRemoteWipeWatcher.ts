import { onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { runRemoteWipeCheck } from '../lib/remote-wipe'
import { useAuthStore } from '../stores/auth'
import { useNetworkStore } from '../stores/network'

export const REMOTE_WIPE_VISIBILITY_RECHECK_MS = 5 * 60 * 1000

type LoginReason = 'revoked' | 'stale'

export function useRemoteWipeWatcher() {
  const authStore = useAuthStore()
  const networkStore = useNetworkStore()
  const router = useRouter()

  let hiddenAt: number | null =
    typeof document !== 'undefined' && document.visibilityState === 'hidden' ? Date.now() : null
  let graceExpiryTimer: ReturnType<typeof setTimeout> | null = null

  function redirectToLogin(reason: LoginReason): void {
    void router.replace({ path: '/login', query: { reason } }).catch((error) => {
      console.error('Remote-wipe redirect failed:', error)
    })
  }

  function clearGraceExpiryTimer(): void {
    if (graceExpiryTimer) {
      clearTimeout(graceExpiryTimer)
      graceExpiryTimer = null
    }
  }

  async function runFreshCheck(reason: string) {
    if (!authStore.isAuthenticated || !networkStore.isOnline) return null

    const result = await runRemoteWipeCheck(authStore, {
      reason,
      force: true,
    })

    if (result.wiped) {
      redirectToLogin('revoked')
    }

    return result
  }

  async function handleGraceExpiry(): Promise<void> {
    clearGraceExpiryTimer()

    if (!authStore.isAuthenticated) return

    if (!networkStore.isOnline) {
      await authStore.logout()
      redirectToLogin('stale')
      return
    }

    const result = await runRemoteWipeCheck(authStore, {
      reason: 'offline-grace-expiry',
      force: true,
    })

    if (result.wiped) {
      redirectToLogin('revoked')
      return
    }

    if (result.checked) {
      authStore.refreshOfflineGracePeriod()
      scheduleGraceExpiry()
      return
    }

    await authStore.logout()
    redirectToLogin('stale')
  }

  function scheduleGraceExpiry(): void {
    clearGraceExpiryTimer()

    const expiry = authStore.offlineGracePeriodExpiry
    if (!authStore.isAuthenticated || !expiry) return

    const delay = Math.max(expiry.getTime() - Date.now(), 0)
    graceExpiryTimer = setTimeout(() => {
      void handleGraceExpiry()
    }, delay)
  }

  function handleVisibilityChange(): void {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now()
      return
    }

    const hiddenForMs = hiddenAt === null ? 0 : Date.now() - hiddenAt
    hiddenAt = null

    if (hiddenForMs >= REMOTE_WIPE_VISIBILITY_RECHECK_MS) {
      void runFreshCheck('visibility-regain')
    }

    scheduleGraceExpiry()
  }

  watch(
    () => networkStore.isOnline,
    (isOnline, wasOnline) => {
      if (isOnline && wasOnline === false) {
        void runFreshCheck('online-transition')
      }
    },
  )

  watch(
    [() => authStore.isAuthenticated, () => authStore.offlineGracePeriodExpiry?.getTime() ?? null],
    () => scheduleGraceExpiry(),
    { immediate: true },
  )

  onMounted(() => {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }
    scheduleGraceExpiry()
  })

  onUnmounted(() => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
    clearGraceExpiryTimer()
  })
}
