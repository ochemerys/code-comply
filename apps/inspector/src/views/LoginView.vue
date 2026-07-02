<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { InspectorAccessDeniedError, useAuth } from '../composables/useAuth'
import { useConnectivity } from '../composables/useConnectivity'
import { useSsoConfig } from '../composables/useSsoConfig'

const { login, loginWithSso } = useAuth()
const { isConnectionAvailable } = useConnectivity()
const { config, isLoading: ssoConfigLoading, ssoEnabled } = useSsoConfig()
const route = useRoute()

type LoginReason = 'access_denied' | 'revoked' | 'stale' | 'idle'

const loginNotice = computed(() => {
  const reason = route.query.reason as LoginReason | undefined
  switch (reason) {
    case 'access_denied':
      return {
        testId: 'login-access-denied-notice',
        message:
          'This app is for Safety Codes Officers only. Sign in with an authorized inspector account or contact your administrator.',
      }
    case 'revoked':
      return {
        testId: 'login-revoked-notice',
        message:
          'Your certification or account access has been revoked. Local data on this device was cleared. Contact your administrator before signing in again.',
      }
    case 'stale':
      return {
        testId: 'login-stale-notice',
        message:
          'This device has not been used for an extended period. For your security, sign in again to continue.',
      }
    case 'idle':
      return {
        testId: 'login-idle-logout-notice',
        message: 'You were signed out after a period of inactivity. Please sign in again.',
      }
    default:
      return null
  }
})

const email = ref('')
const password = ref('')
const isLoading = ref(false)
const error = ref<string | null>(null)
const showPasswordLogin = ref(false)
const loginDisabled = computed(() => isLoading.value || !isConnectionAvailable.value)

const ssoReady = computed(
  () =>
    ssoEnabled.value &&
    !!config.value?.authorizationEndpoint &&
    !!config.value.clientId &&
    !ssoConfigLoading.value,
)

const showDevCredentials = computed(() => import.meta.env.DEV)

async function handleSsoLogin() {
  if (!config.value?.authorizationEndpoint || !config.value.clientId) return
  isLoading.value = true
  error.value = null
  try {
    await loginWithSso(
      config.value.authorizationEndpoint,
      config.value.clientId,
      config.value.scopes ?? ['openid', 'profile', 'email'],
    )
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not start SSO sign-in'
    isLoading.value = false
  }
}

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
  } catch (err) {
    const isNetwork =
      err instanceof TypeError &&
      (String(err.message).includes('Failed to fetch') ||
        String(err.message).includes('NetworkError'))
    if (err instanceof Error && err.name === 'CertificationRevokedError') {
      error.value =
        'Your certification or account access has been revoked. Contact your administrator before signing in again.'
    } else if (err instanceof InspectorAccessDeniedError) {
      error.value =
        'This app is for Safety Codes Officers only. Use an inspector account (e.g. inspector1@example.com after db:seed), or sign in to the Admin portal with admin@example.com.'
    } else {
      error.value = isNetwork
        ? 'Cannot reach the API. Ensure the backend is running and reachable from this browser (check your URL and network), then try again.'
        : 'Invalid email or password'
    }
    console.error('Login error:', err)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-svh flex items-center justify-center bg-bg-app px-4">
    <div class="max-w-md w-full space-y-8">
      <div class="text-center">
        <h1 class="text-3xl font-bold text-text-primary">CodeComply Field</h1>
        <p class="mt-2 text-sm text-text-secondary">
          {{ ssoReady ? 'Sign in with your organization account' : 'Sign in to your account' }}
        </p>
        <p v-if="ssoReady" class="mt-2 text-xs text-text-dim max-w-sm mx-auto leading-relaxed">
          Authentication uses OAuth 2.0 / OpenID Connect (OIDC) through your organization identity
          provider.
        </p>
      </div>

      <RouterLink
        to="/user-manual"
        class="flex items-center justify-center gap-2 w-full max-w-md mx-auto py-3 px-4 rounded-xl border-2 border-primary-200 dark:border-primary-600/80 bg-bg-surface/80 text-primary-800 dark:text-primary-200 shadow-sm hover:bg-primary-50/80 dark:hover:bg-bg-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-bg-app transition-colors"
        data-testid="login-user-manual-link"
      >
        <svg
          class="w-5 h-5 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
        <span class="text-sm font-semibold">User Manual</span>
        <span
          class="ml-1 text-xs font-medium text-primary-600/90 dark:text-primary-300/90 bg-primary-100/80 dark:bg-primary-900/40 px-2 py-0.5 rounded-full"
        >
          No sign-in
        </span>
      </RouterLink>

      <div class="card">
        <div
          v-if="loginNotice"
          class="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4"
          :data-testid="loginNotice.testId"
        >
          <p class="text-sm text-amber-800 dark:text-amber-200">
            {{ loginNotice.message }}
          </p>
        </div>

        <div
          v-if="error"
          class="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
        >
          <p class="text-sm text-red-800 dark:text-red-200">
            {{ error }}
          </p>
        </div>

        <div v-if="ssoReady" class="space-y-4">
          <button
            type="button"
            class="btn btn-primary w-full min-h-touch"
            data-testid="login-sso-button"
            :disabled="loginDisabled || isLoading"
            @click="handleSsoLogin"
          >
            <span v-if="isLoading">Redirecting to SSO…</span>
            <span v-else>Sign in with Organization SSO</span>
          </button>
          <p class="text-xs text-text-dim text-center">
            Network access is required to complete OIDC sign-in.
          </p>
          <button
            v-if="config?.devProvider"
            type="button"
            class="text-sm text-text-secondary underline w-full"
            data-testid="login-show-password-fallback"
            @click="showPasswordLogin = !showPasswordLogin"
          >
            {{
              showPasswordLogin
                ? 'Hide development password sign-in'
                : 'Development password sign-in'
            }}
          </button>
        </div>

        <form
          v-if="!ssoReady || showPasswordLogin"
          class="space-y-6"
          :class="{ 'mt-6': ssoReady && showPasswordLogin }"
          @submit.prevent="handleLogin"
        >
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
              class="input w-full"
              placeholder="you@organization.com"
              :disabled="loginDisabled"
            />
          </div>

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
              class="input w-full"
              placeholder="••••••••"
              :disabled="loginDisabled"
            />
          </div>

          <button type="submit" class="btn btn-primary w-full" :disabled="loginDisabled">
            <span v-if="isLoading">Signing in...</span>
            <span v-else>{{ ssoReady ? 'Sign in with password' : 'Sign in' }}</span>
          </button>
        </form>

        <div
          v-if="showDevCredentials && (!ssoReady || showPasswordLogin)"
          class="mt-6 rounded-lg border border-border-subtle bg-bg-elevated px-4 py-3 text-xs text-text-secondary"
          data-testid="login-dev-credentials"
        >
          <p class="font-medium text-text-primary">Development credentials (after pnpm db:seed)</p>
          <p class="mt-2 font-mono">inspector1@example.com / password123</p>
          <p class="mt-1 font-mono">inspector2@example.com / password123</p>
          <p class="mt-2 text-text-dim">
            Admin accounts (admin@example.com) sign in to the Admin portal, not this app.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
