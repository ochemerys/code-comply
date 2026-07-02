import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import type {
  AdminSessionPolicy,
  AdminSsoSettings,
  AdminSsoSettingsPatch,
} from '@codecomply/validators'
import { useAuthStore } from '../stores/auth'
import { api } from '@/api/client'
import { parseRpcJson } from '@/api/rpc-json'

export async function fetchAdminSsoSettings(): Promise<AdminSsoSettings> {
  const res = await api.admin.settings.sso.$get()
  return parseRpcJson(res, `Failed to load SSO settings (${res.status})`)
}

export async function patchAdminSsoSettings(
  body: AdminSsoSettingsPatch,
): Promise<AdminSsoSettings> {
  const res = await api.admin.settings.sso.$patch({ json: body })
  return parseRpcJson(res, `Failed to save SSO settings (${res.status})`)
}

export async function fetchAdminSessionPolicy(): Promise<AdminSessionPolicy> {
  const res = await api.admin.settings['session-policy'].$get()
  return parseRpcJson(res, `Failed to load session policy (${res.status})`)
}

export function useAdminSsoSettings() {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  const ssoQuery = useQuery({
    queryKey: ['admin', 'settings', 'sso'] as const,
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchAdminSsoSettings()
    },
    enabled: computed(() => auth.isAuthenticated),
  })

  const sessionPolicyQuery = useQuery({
    queryKey: ['admin', 'settings', 'session-policy'] as const,
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchAdminSessionPolicy()
    },
    enabled: computed(() => auth.isAuthenticated),
  })

  const saveSso = useMutation({
    mutationFn: (body: AdminSsoSettingsPatch) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return patchAdminSsoSettings(body)
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['admin', 'settings', 'sso'], data)
    },
  })

  return { ssoQuery, sessionPolicyQuery, saveSso }
}
