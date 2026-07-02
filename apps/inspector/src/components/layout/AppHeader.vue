<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuth } from '../../composables/useAuth'
import { useThemeStore } from '../../stores/theme'
import { useRouter } from 'vue-router'
import { useSyncStatus } from '../../composables/useSyncStatus'
import SyncStatusBadge from '../SyncStatusBadge.vue'
import AppBrandWordmark from './AppBrandWordmark.vue'

const { user, isAuthenticated, logout } = useAuth()
const themeStore = useThemeStore()
const router = useRouter()
const {
  status,
  pendingCount,
  failedCount,
  lastError,
  isOnline,
  isSyncing,
  triggerSync,
  retryFailed,
} = useSyncStatus()

const showUserMenu = ref(false)
const showSyncMenu = ref(false)

const syncNowDisabled = computed(() => !isOnline.value || isSyncing.value)

async function onSyncNow() {
  showSyncMenu.value = false
  await triggerSync()
}

async function onRetryFailed() {
  showSyncMenu.value = false
  await retryFailed()
}

const userInitials = computed(() => {
  if (!user.value?.name) return ''

  const nameParts = user.value.name.trim().split(/\s+/)

  if (nameParts.length === 1) {
    return nameParts[0].substring(0, 2).toUpperCase()
  }

  const firstInitial = nameParts[0].charAt(0).toUpperCase()
  const lastInitial = nameParts[nameParts.length - 1].charAt(0).toUpperCase()

  return firstInitial + lastInitial
})

function toggleUserMenu() {
  showUserMenu.value = !showUserMenu.value
  if (showUserMenu.value) showSyncMenu.value = false
}

function toggleSyncMenu() {
  showSyncMenu.value = !showSyncMenu.value
  if (showSyncMenu.value) showUserMenu.value = false
}

function goToProfile() {
  showUserMenu.value = false
  router.push('/profile')
}

async function handleLogout() {
  showUserMenu.value = false
  await logout()
}
</script>

<template>
  <header
    class="bg-bg-surface text-text-primary border-b border-border-subtle h-16 px-2 sm:px-4 tablet:px-6 shadow-sm"
  >
    <div class="flex h-full items-center gap-1 min-w-0 sm:gap-2 tablet-l:justify-end">
      <!-- Brand lives in SideNav on tablet landscape; compact single-line wordmark on phone -->
      <h1 class="tablet-l:hidden min-w-0 overflow-hidden">
        <AppBrandWordmark size="sm" />
      </h1>

      <div class="ml-auto flex flex-shrink-0 items-center gap-1 sm:gap-2 tablet:gap-4">
        <!-- Sync: status + manual sync / retry (workflow M-03) -->
        <div v-if="isAuthenticated" class="relative">
          <button
            type="button"
            data-testid="header-sync-menu-button"
            class="flex items-center gap-1 rounded-lg px-1 py-1 min-h-touch hover:bg-bg-elevated transition-colors"
            aria-label="Sync status and actions"
            aria-haspopup="true"
            :aria-expanded="showSyncMenu"
            @click="toggleSyncMenu"
          >
            <SyncStatusBadge
              :status="status"
              :pending-count="pendingCount"
              :show-count="true"
              size="md"
            />
            <svg
              class="w-4 h-4 flex-shrink-0 opacity-90"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
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
            v-if="showSyncMenu"
            data-testid="header-sync-menu"
            class="absolute right-0 mt-2 w-56 rounded-lg bg-bg-surface shadow-lg py-2 z-modal text-text-primary border border-border-subtle"
            role="menu"
          >
            <p class="px-3 text-xs text-text-secondary" role="none">
              Pending: {{ pendingCount
              }}<span v-if="failedCount > 0"> · Failed: {{ failedCount }}</span>
            </p>
            <p
              v-if="lastError"
              class="px-3 mt-1 text-xs text-red-600 dark:text-red-400 break-words"
            >
              {{ lastError }}
            </p>
            <button
              type="button"
              class="mt-2 w-full text-left px-3 py-2 text-sm hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
              role="menuitem"
              :disabled="syncNowDisabled"
              @click="onSyncNow()"
            >
              Sync now
            </button>
            <button
              v-if="failedCount > 0"
              type="button"
              class="w-full text-left px-3 py-2 text-sm hover:bg-bg-elevated"
              role="menuitem"
              :disabled="!isOnline || isSyncing"
              @click="onRetryFailed()"
            >
              Retry failed
            </button>
          </div>
        </div>

        <!-- Theme Toggle -->
        <button
          class="h-11 w-11 min-h-touch flex items-center justify-center rounded-lg hover:bg-bg-elevated transition-colors"
          aria-label="Toggle dark mode"
          @click="themeStore.toggleDarkMode()"
        >
          <svg
            v-if="!themeStore.isDark"
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
          <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        </button>

        <!-- User Menu -->
        <div v-if="isAuthenticated" class="relative">
          <button
            data-testid="user-menu-button"
            aria-label="User menu"
            class="h-11 min-h-touch flex items-center gap-2 px-2 rounded-lg hover:bg-bg-elevated transition-colors"
            @click="toggleUserMenu"
          >
            <div
              class="w-11 h-11 bg-bg-elevated text-primary-600 rounded-full border border-border-subtle flex items-center justify-center font-bold text-base"
            >
              {{ userInitials }}
            </div>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          <div
            v-if="showUserMenu"
            data-testid="user-menu"
            class="absolute right-0 mt-2 w-48 bg-bg-surface rounded-lg shadow-lg py-1 z-modal border border-border-subtle"
          >
            <div class="px-4 py-2 border-b border-border-subtle">
              <p class="text-sm font-medium text-text-primary">
                {{ user?.name }}
              </p>
              <p class="text-xs text-text-secondary">
                {{ user?.email }}
              </p>
            </div>
            <button
              data-testid="user-menu-view-profile"
              class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-bg-elevated"
              @click="goToProfile"
            >
              View Profile
            </button>
            <button
              data-testid="user-menu-sign-out"
              class="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-bg-elevated"
              @click="handleLogout"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
