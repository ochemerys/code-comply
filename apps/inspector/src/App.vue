<script setup lang="ts">
import { RouterView } from 'vue-router'
import { computed, onMounted, watch } from 'vue'
import { useNetworkStore } from './stores/network'
import { useThemeStore } from './stores/theme'
import { useAuthStore } from './stores/auth'
import { useIdleLogout } from './composables/useIdleLogout'
import { useRemoteWipeWatcher } from './composables/useRemoteWipeWatcher'
import { touchLastSeenAt } from './lib/auth/device-idle'
import AppShell from './components/layout/AppShell.vue'
import AsyncLoadingFallback from './components/AsyncLoadingFallback.vue'
import IdleLogoutDialog from './components/IdleLogoutDialog.vue'
import SyncStatusBanner from './components/SyncStatusBanner.vue'

const networkStore = useNetworkStore()
const themeStore = useThemeStore()
const authStore = useAuthStore()

const idleEnabled = computed(() => authStore.isAuthenticated)
const showSyncStatusBanner = computed(
  () => authStore.isAuthenticated || authStore.isOfflineGracePeriodActive,
)
const { showWarnDialog, staySignedIn } = useIdleLogout({ enabled: idleEnabled })
useRemoteWipeWatcher()

onMounted(() => {
  networkStore.initNetworkListener()
  themeStore.initTheme()
  if (authStore.isAuthenticated || authStore.isOfflineGracePeriodActive) {
    touchLastSeenAt()
  }
})

watch(showSyncStatusBanner, (shouldTrackQueue) => {
  if (shouldTrackQueue) {
    networkStore.initNetworkListener()
    return
  }

  networkStore.disposeNetworkListener()
})
</script>

<template>
  <div class="min-h-dvh bg-bg-app">
    <RouterView v-slot="{ Component, route }">
      <AppShell v-if="route.meta.appShell !== false">
        <Transition :name="(route.meta.transition as string) || 'fade'" mode="out-in">
          <Suspense>
            <component :is="Component" :key="route.path" />
            <template #fallback>
              <AsyncLoadingFallback label="Loading page…" test-id="route-loading-fallback" />
            </template>
          </Suspense>
        </Transition>
      </AppShell>

      <Transition v-else :name="(route.meta.transition as string) || 'fade'" mode="out-in">
        <Suspense>
          <component :is="Component" :key="route.path" />
          <template #fallback>
            <AsyncLoadingFallback label="Loading page…" test-id="route-loading-fallback" />
          </template>
        </Suspense>
      </Transition>
    </RouterView>

    <IdleLogoutDialog v-model="showWarnDialog" @stay-signed-in="staySignedIn" />
    <SyncStatusBanner v-if="showSyncStatusBanner" />
  </div>
</template>

<style>
/* Route Transitions - Guide §8.1: 200-300ms, ease-out */

/* Fade transition (default) */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 250ms ease-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Slide transition (for phone navigation) */
.slide-enter-active,
.slide-leave-active {
  transition:
    transform 300ms ease-out,
    opacity 250ms ease-out;
}

.slide-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.slide-leave-to {
  transform: translateX(-30%);
  opacity: 0;
}

/* Scale transition (for modals) */
.scale-enter-active,
.scale-leave-active {
  transition:
    transform 250ms ease-out,
    opacity 200ms ease-out;
}

.scale-enter-from,
.scale-leave-to {
  transform: scale(0.95);
  opacity: 0;
}
</style>
