<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const route = useRoute()
const router = useRouter()
const { completeSsoCallback } = useAuth()

const error = ref<string | null>(null)
const isLoading = ref(true)

const code = computed(() => String(route.query.code ?? ''))
const state = computed(() => String(route.query.state ?? ''))

onMounted(async () => {
  if (!code.value || !state.value) {
    error.value = 'Missing SSO authorization response.'
    isLoading.value = false
    return
  }

  try {
    await completeSsoCallback(code.value, state.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'SSO sign-in failed'
    isLoading.value = false
  }
})

function backToLogin() {
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-svh flex items-center justify-center bg-bg-app px-4">
    <div class="max-w-md w-full card p-6 text-center space-y-4">
      <h1 class="text-xl font-semibold text-text-primary">Completing sign-in</h1>
      <p
        v-if="isLoading && !error"
        class="text-sm text-text-secondary"
        data-testid="sso-callback-loading"
      >
        Exchanging organization SSO credentials…
      </p>
      <p
        v-if="error"
        class="text-sm text-red-700 dark:text-red-300"
        role="alert"
        data-testid="sso-callback-error"
      >
        {{ error }}
      </p>
      <button
        v-if="error"
        type="button"
        class="btn btn-primary w-full"
        data-testid="sso-callback-back"
        @click="backToLogin"
      >
        Back to sign in
      </button>
    </div>
  </div>
</template>
