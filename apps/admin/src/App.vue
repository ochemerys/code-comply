<script setup lang="ts">
import { computed, watch } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { useIdleLogout } from './composables/useIdleLogout'
import IdleLogoutDialog from './components/IdleLogoutDialog.vue'
import SessionHydrationGate from './components/SessionHydrationGate.vue'
import { shouldDeferNavigationForSession } from './router/guards/admin.guard'

const authStore = useAuthStore()
const router = useRouter()

const hydrationGateMode = computed<'loading' | 'retry' | null>(() => {
  if (authStore.isSessionHydrating) return 'loading'
  if (authStore.isSessionRestoreError) return 'retry'
  return null
})

const idleEnabled = computed(() => authStore.isAuthenticated && authStore.isAdmin)
const { showWarnDialog, staySignedIn } = useIdleLogout({ enabled: idleEnabled })

async function retrySessionRestore(): Promise<void> {
  const restored = await authStore.retryRestoreSession()
  if (restored) {
    await router.replace(router.currentRoute.value.fullPath)
  }
}

watch(
  () => authStore.sessionStatus,
  async (status, previous) => {
    if (!previous || status === 'restore_error') return
    const wasDeferred = shouldDeferNavigationForSession({
      sessionStatus: previous,
      accessToken: authStore.accessToken,
      refreshToken: authStore.refreshToken,
    })
    const isDeferred = shouldDeferNavigationForSession({
      sessionStatus: status,
      accessToken: authStore.accessToken,
      refreshToken: authStore.refreshToken,
    })
    if (wasDeferred && !isDeferred) {
      await router.replace(router.currentRoute.value.fullPath)
    }
  },
)
</script>

<template>
  <div class="min-h-screen bg-bg-app">
    <SessionHydrationGate
      v-if="hydrationGateMode"
      :mode="hydrationGateMode"
      :error-message="authStore.sessionRestoreError ?? undefined"
      @retry="retrySessionRestore"
    />
    <RouterView v-else />
    <IdleLogoutDialog v-model="showWarnDialog" @stay-signed-in="staySignedIn" />
  </div>
</template>
