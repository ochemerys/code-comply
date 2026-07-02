<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { usePushSubscription } from '../composables/usePushSubscription'
import { useThemeStore } from '../stores/theme'

const route = useRoute()
const { user, logout } = useAuth()
const themeStore = useThemeStore()

const certExpiredNotice = computed(
  () =>
    route.query.reason === 'cert_expired' &&
    'Your certifications are expired or missing. You cannot start or update inspections until your credentials are renewed.',
)
const {
  isSupported,
  isSubscribed,
  isLoading,
  errorMessage,
  refreshSubscriptionState,
  enable,
  disable,
} = usePushSubscription()

onMounted(() => {
  void refreshSubscriptionState()
})

async function onPushToggle(event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  if (checked) {
    await enable()
  } else {
    await disable()
  }
  await refreshSubscriptionState()
}

function onOutdoorModeToggle(event: Event) {
  themeStore.setHighContrast((event.target as HTMLInputElement).checked)
}

async function handleLogout() {
  await logout()
}
</script>

<template>
  <div class="flex flex-col">
    <main class="max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <div class="space-y-6">
        <div
          v-if="certExpiredNotice"
          class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4"
          data-testid="profile-cert-expired-notice"
        >
          <p class="text-sm text-amber-800 dark:text-amber-200">
            {{ certExpiredNotice }}
          </p>
        </div>

        <!-- User Info Card -->
        <div class="card">
          <div class="flex items-center space-x-4">
            <div
              class="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center text-white text-2xl font-bold"
            >
              {{ user?.name?.charAt(0).toUpperCase() }}
            </div>
            <div class="flex-1">
              <h2 class="text-xl font-semibold text-text-primary">
                {{ user?.name }}
              </h2>
              <p class="text-sm text-text-secondary">
                {{ user?.email }}
              </p>
              <p class="text-xs text-text-dim mt-1">Role: {{ user?.role }}</p>
            </div>
          </div>
        </div>

        <!-- Certifications Card -->
        <div v-if="user?.certifications && user.certifications.length > 0" class="card">
          <h3 class="text-lg font-semibold text-text-primary mb-4">Certifications</h3>
          <div class="space-y-3">
            <div
              v-for="cert in user.certifications"
              :key="cert.id"
              class="flex items-center justify-between p-3 bg-bg-elevated rounded-lg"
            >
              <div>
                <p class="font-medium text-text-primary">{{ cert.discipline }} Certification</p>
                <p class="text-sm text-text-secondary">
                  {{ cert.authority }}
                </p>
                <p class="text-xs text-text-dim">
                  Issued: {{ new Date(cert.issuedDate).toLocaleDateString() }}
                </p>
              </div>
              <span
                class="px-3 py-1 text-xs font-medium rounded-full"
                :class="
                  cert.status === 'ACTIVE'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                "
              >
                {{ cert.status === 'ACTIVE' ? 'Active' : cert.status }}
              </span>
            </div>
          </div>
        </div>

        <!-- Disciplines Card -->
        <div v-if="user?.disciplines && user.disciplines.length > 0" class="card">
          <h3 class="text-lg font-semibold text-text-primary mb-4">Disciplines</h3>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="discipline in user.disciplines"
              :key="discipline"
              class="px-3 py-1 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 text-sm font-medium rounded-full"
            >
              {{ discipline }}
            </span>
          </div>
        </div>

        <!-- Push notifications (hidden when PushManager is unavailable, e.g. iOS Safari tab) -->
        <div v-if="isSupported" class="card">
          <h3 class="text-lg font-semibold text-text-primary mb-2">Push notifications</h3>
          <p class="text-sm text-text-secondary mb-4">
            Get alerts for new assignments. On iOS, install the app to your home screen (iOS 16.4+)
            for Web Push to work.
          </p>
          <label class="flex items-center justify-between gap-4">
            <span class="text-sm text-text-primary">Enable push notifications</span>
            <input
              type="checkbox"
              class="h-5 w-5 rounded border-border-subtle text-primary-600 focus:ring-primary-500"
              :checked="isSubscribed"
              :disabled="isLoading"
              @change="onPushToggle"
            />
          </label>
          <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400 mt-2" role="alert">
            {{ errorMessage }}
          </p>
        </div>

        <!-- Display Settings -->
        <div class="card">
          <h3 class="text-lg font-semibold text-text-primary mb-2">Display settings</h3>
          <label class="flex items-center justify-between gap-4">
            <span>
              <span class="block text-sm font-medium text-text-primary">Outdoor mode</span>
              <span class="block text-sm text-text-secondary">
                Boost contrast for bright sunlight.
              </span>
            </span>
            <input
              type="checkbox"
              class="h-5 w-5 rounded border-border-subtle text-primary-600 focus:ring-primary-500"
              :checked="themeStore.isHighContrast"
              data-testid="outdoor-mode-toggle"
              @change="onOutdoorModeToggle"
            />
          </label>
        </div>

        <!-- Last Login -->
        <div class="card">
          <h3 class="text-lg font-semibold text-text-primary mb-2">Account Information</h3>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-text-secondary">Last Login:</span>
              <span class="text-text-primary">
                {{ user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'N/A' }}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-text-secondary">Account Created:</span>
              <span class="text-text-primary">
                {{ user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Logout Button -->
        <button class="btn btn-secondary w-full" @click="handleLogout">Sign Out</button>
      </div>
    </main>
  </div>
</template>
