<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const { login } = useAuth()
const route = useRoute()

const email = ref('')
const password = ref('')
const isLoading = ref(false)
const error = ref<string | null>(null)

const sessionExpiredNotice = computed(() =>
  route.query.reason === 'session_expired'
    ? 'Your session has expired. Please sign in again to continue.'
    : null,
)

const accessDeniedNotice = computed(() =>
  route.query.reason === 'access_denied'
    ? 'Access denied: administrator privileges are required for this portal.'
    : null,
)

const idleLogoutNotice = computed(() =>
  route.query.reason === 'idle'
    ? 'You were signed out after a period of inactivity. Please sign in again.'
    : null,
)

async function handleLogin() {
  if (!email.value || !password.value) {
    error.value = 'Please enter both email and password'
    return
  }

  isLoading.value = true
  error.value = null

  try {
    await login({
      email: email.value,
      password: password.value,
    })
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Invalid email or password'
    console.error('Login error:', err)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-bg-app">
    <div class="max-w-md w-full space-y-8 p-8 bg-bg-surface rounded-lg shadow-lg">
      <!-- Header -->
      <div class="text-center">
        <h1 class="text-3xl font-bold text-text-primary">CodeComply Admin</h1>
        <p class="mt-2 text-sm text-text-secondary">Open source inspection management</p>
      </div>

      <div
        v-if="sessionExpiredNotice"
        class="mt-6 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-900"
        data-testid="login-session-notice"
        role="status"
      >
        {{ sessionExpiredNotice }}
      </div>

      <div
        v-if="accessDeniedNotice"
        class="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        data-testid="login-access-denied-notice"
        role="alert"
      >
        {{ accessDeniedNotice }}
      </div>

      <div
        v-if="idleLogoutNotice"
        class="mt-6 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-900"
        data-testid="login-idle-logout-notice"
        role="status"
      >
        {{ idleLogoutNotice }}
      </div>

      <!-- Login Form -->
      <form class="mt-8 space-y-6" @submit.prevent="handleLogin">
        <!-- Error Message -->
        <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
          <p class="text-sm text-red-800">
            {{ error }}
          </p>
        </div>

        <!-- Email Field -->
        <div>
          <label for="email" class="block text-sm font-medium text-text-secondary mb-2">
            Email address
          </label>
          <input
            id="email"
            v-model="email"
            type="email"
            autocomplete="email"
            required
            class="w-full px-3 py-2 border border-border-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="admin@example.com"
            :disabled="isLoading"
          />
        </div>

        <!-- Password Field -->
        <div>
          <label for="password" class="block text-sm font-medium text-text-secondary mb-2">
            Password
          </label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            class="w-full px-3 py-2 border border-border-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="••••••••"
            :disabled="isLoading"
          />
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          class="w-full py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="isLoading"
        >
          <span v-if="isLoading">Signing in...</span>
          <span v-else>Sign in</span>
        </button>
      </form>

      <!-- Development Note -->
      <div class="text-center text-xs text-text-dim mt-4">
        <p>Development credentials:</p>
        <p class="font-mono mt-1">admin@example.com / admin123</p>
      </div>
    </div>
  </div>
</template>
