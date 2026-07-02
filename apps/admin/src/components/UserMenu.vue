<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useAuth } from '../composables/useAuth'

const authStore = useAuthStore()
const { logout } = useAuth()
const showUserMenu = ref(false)

function toggleUserMenu() {
  showUserMenu.value = !showUserMenu.value
}

async function handleLogout() {
  showUserMenu.value = false
  await logout()
}
</script>

<template>
  <div v-if="authStore.isAuthenticated" class="relative">
    <button
      type="button"
      class="flex items-center space-x-3 p-2 rounded-lg hover:bg-bg-app transition-colors"
      data-testid="user-menu-trigger"
      @click="toggleUserMenu"
    >
      <div
        class="w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold text-sm"
      >
        {{ authStore.user?.name?.charAt(0).toUpperCase() }}
      </div>
      <div class="text-left hidden sm:block">
        <p class="text-sm font-medium text-text-primary">
          {{ authStore.user?.name }}
        </p>
        <p class="text-xs text-text-dim">
          {{ authStore.user?.role }}
        </p>
      </div>
      <svg
        class="w-4 h-4 text-text-dim hidden sm:block"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div
      v-if="showUserMenu"
      class="absolute right-0 mt-2 w-48 bg-bg-surface rounded-lg shadow-lg py-1 z-50 border border-border-subtle"
      data-testid="user-menu-dropdown"
    >
      <div class="px-4 py-2 border-b border-border-subtle">
        <p class="text-sm font-medium text-text-primary">
          {{ authStore.user?.name }}
        </p>
        <p class="text-xs text-text-dim">
          {{ authStore.user?.email }}
        </p>
      </div>
      <button
        type="button"
        class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-bg-app"
        data-testid="user-menu-sign-out"
        @click="handleLogout"
      >
        Sign Out
      </button>
    </div>
  </div>
</template>
