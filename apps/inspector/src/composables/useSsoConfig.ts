import { ref, computed, onMounted } from 'vue'
import type { SsoPublicConfig } from '@codecomply/validators'
import { getApiBaseUrl } from '@/lib/api-base'

export function ssoCallbackRedirectUri(): string {
  const base = import.meta.env.BASE_URL || '/'
  const path = `${base.replace(/\/?$/, '')}/login/sso-callback`
  return new URL(path, window.location.origin).href
}

export function useSsoConfig() {
  const config = ref<SsoPublicConfig | null>(null)
  const isLoading = ref(true)
  const error = ref<string | null>(null)

  onMounted(async () => {
    try {
      const apiBase = getApiBaseUrl()
      const prefix = apiBase ? `${apiBase}/auth` : '/auth'
      const res = await fetch(`${prefix}/sso/config`, { cache: 'no-store' })
      if (!res.ok) {
        throw new Error(`Failed to load SSO config (${res.status})`)
      }
      config.value = (await res.json()) as SsoPublicConfig
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load SSO config'
      config.value = { enabled: false }
    } finally {
      isLoading.value = false
    }
  })

  const ssoEnabled = computed(() => config.value?.enabled === true)

  return {
    config,
    isLoading,
    error,
    ssoEnabled,
  }
}
