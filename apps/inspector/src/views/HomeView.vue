<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useThemeStore } from '../stores/theme'
import { useConnectivity } from '../composables/useConnectivity'
import { usePWAInstall } from '../composables/usePWAInstall'
import { usePushSubscription } from '../composables/usePushSubscription'

const router = useRouter()
const themeStore = useThemeStore()
const { isConnectionAvailable } = useConnectivity()
const { canInstall, promptInstall } = usePWAInstall()
const { isSupported, canEnable, isLoading, enable, refreshSubscriptionState } =
  usePushSubscription()

const isInstalled = ref(false)
const showInstructions = ref(false)
const displayModeLabel = computed(() => {
  if (themeStore.isHighContrast) return 'Outdoor mode'
  if (themeStore.isDark) return 'Dark mode'

  return 'Standard mode'
})
const connectivityLabel = computed(() => (isConnectionAvailable.value ? 'Online' : 'Offline'))
const connectivityIndicatorClass = computed(() =>
  isConnectionAvailable.value ? 'bg-green-500' : 'bg-red-500',
)

onMounted(() => {
  // Check if app is already installed
  isInstalled.value =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  void refreshSubscriptionState()
})

async function handleEnableNotifications() {
  await enable()
  await refreshSubscriptionState()
}

const goToPermits = () => {
  router.push('/permits')
}

const goToUserManual = () => {
  router.push('/user-manual')
}

const toggleInstructions = () => {
  showInstructions.value = !showInstructions.value
}
</script>

<template>
  <div class="flex flex-col">
    <!-- PWA Install Prompt -->
    <div
      v-if="canInstall"
      class="bg-primary-100 dark:bg-primary-900 border-b border-primary-200 dark:border-primary-800 px-4 py-3"
    >
      <div class="flex items-center justify-between">
        <div class="flex-1">
          <p class="text-sm font-medium text-primary-900 dark:text-primary-100">
            Install this app on your device
          </p>
          <p class="text-xs text-primary-700 dark:text-primary-300 mt-1">
            Access it quickly from your home screen
          </p>
        </div>
        <button
          class="ml-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          @click="promptInstall"
        >
          Install
        </button>
      </div>
    </div>

    <main class="p-4">
      <div class="max-w-md tablet:max-w-2xl mx-auto space-y-4">
        <div class="card">
          <h2 class="text-xl font-semibold mb-4">Welcome</h2>
          <p class="text-text-secondary mb-6">
            Start managing your inspections with offline-first capabilities.
          </p>

          <!-- Installation Instructions (only show if not installed) -->
          <div
            v-if="!isInstalled"
            class="mb-6 border border-primary-200 dark:border-primary-700 rounded-lg overflow-hidden"
          >
            <button
              class="w-full px-4 py-3 bg-primary-50 dark:bg-primary-900/30 text-left flex items-center justify-between hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
              @click="toggleInstructions"
            >
              <div class="flex items-center space-x-2">
                <svg
                  class="w-5 h-5 text-primary-600 dark:text-primary-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                <span class="font-medium text-primary-900 dark:text-primary-100">
                  How to Install on Mobile
                </span>
              </div>
              <svg
                :class="{ 'rotate-180': showInstructions }"
                class="w-5 h-5 text-primary-600 dark:text-primary-400 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            <div
              v-if="showInstructions"
              class="px-4 py-3 bg-bg-surface border-t border-primary-200 dark:border-primary-700"
            >
              <div class="space-y-4 text-sm">
                <!-- iOS Safari Instructions -->
                <div>
                  <h4
                    class="font-semibold text-primary-900 dark:text-primary-100 mb-2 flex items-center"
                  >
                    <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
                      />
                    </svg>
                    iOS (Safari)
                  </h4>
                  <ol class="list-decimal list-inside space-y-1 text-text-secondary ml-6">
                    <li>Tap the <strong>Share</strong> button (square with arrow pointing up)</li>
                    <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
                    <li>Tap <strong>"Add"</strong> in the top right corner</li>
                    <li>The app icon will appear on your home screen</li>
                  </ol>
                </div>

                <!-- Android Chrome Instructions -->
                <div>
                  <h4
                    class="font-semibold text-primary-900 dark:text-primary-100 mb-2 flex items-center"
                  >
                    <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
                      />
                    </svg>
                    Android (Chrome)
                  </h4>
                  <ol class="list-decimal list-inside space-y-1 text-text-secondary ml-6">
                    <li>Tap the <strong>menu</strong> button (three dots in top right)</li>
                    <li>
                      Tap <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong>
                    </li>
                    <li>Tap <strong>"Add"</strong> or <strong>"Install"</strong> to confirm</li>
                    <li>The app icon will appear on your home screen</li>
                  </ol>
                </div>

                <p class="text-xs text-text-dim italic pt-2 border-t border-border-subtle">
                  💡 Once installed, you can use the app offline and access it like a native app
                  from your home screen.
                </p>
              </div>
            </div>
          </div>

          <div v-if="isSupported && canEnable" class="mb-4">
            <button
              class="btn btn-secondary w-full"
              type="button"
              :disabled="isLoading"
              @click="handleEnableNotifications"
            >
              Enable notifications
            </button>
          </div>

          <div class="space-y-3">
            <button class="btn btn-primary w-full" @click="goToPermits">
              <svg
                class="w-5 h-5 mr-2 inline-block"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Permits & inspections
            </button>
            <button class="btn btn-secondary w-full" @click="goToUserManual">
              Field guide (Help)
            </button>
          </div>
        </div>

        <div class="card">
          <h3 class="font-semibold mb-2">Status</h3>
          <div class="space-y-2">
            <div class="flex items-center space-x-2">
              <div :class="connectivityIndicatorClass" class="w-3 h-3 rounded-full" />
              <span class="text-sm text-text-secondary">
                {{ connectivityLabel }}
              </span>
            </div>
            <div class="flex items-center space-x-2">
              <div
                :class="themeStore.isHighContrast ? 'bg-primary-500' : 'bg-yellow-500'"
                class="w-3 h-3 rounded-full"
              />
              <span class="text-sm text-text-secondary">
                {{ displayModeLabel }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
