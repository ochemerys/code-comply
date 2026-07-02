import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'
import type {
  PermitListDTO,
  PermitStatus,
  PermitSyncResultDTO,
  PermitSyncStatusDTO,
  PermitTriageDetailDTO,
} from '@codecomply/validators'
import { useAuthStore } from '../stores/auth'
import { api } from '@/api/client'
import { parseRpcJson } from '@/api/rpc-json'
import { readApiErrorMessage } from '@/api/typed-response'

export { isSessionExpiredRedirectError } from '../utils/admin-api-fetch'

export type AdminPermitFilters = {
  permitNumber: string
  address: string
  status: PermitStatus | ''
}

export async function fetchAdminPermits(filters: AdminPermitFilters): Promise<PermitListDTO[]> {
  const res = await api.permits.$get({
    query: {
      permitNumber: filters.permitNumber.trim() || undefined,
      address: filters.address.trim() || undefined,
      status: filters.status || undefined,
      limit: '100',
    },
  })
  return parseRpcJson(res, `Failed to load permits (${res.status})`)
}

export async function fetchPermitSyncStatus(): Promise<PermitSyncStatusDTO> {
  const res = await api.admin.permits['sync-status'].$get()
  return parseRpcJson(res, `Failed to load sync status (${res.status})`)
}

export async function postPermitSync(): Promise<PermitSyncResultDTO> {
  const res = await api.admin.permits.sync.$post()
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res))
  }
  return res.json() as Promise<PermitSyncResultDTO>
}

export async function fetchAdminPermitTriageDetail(
  permitId: string,
): Promise<PermitTriageDetailDTO> {
  const res = await api.admin.permits[':id'].$get({ param: { id: permitId } })
  return parseRpcJson(res, `Failed to load permit (${res.status})`)
}

export function useAdminPermitsList(filters: Ref<AdminPermitFilters>) {
  const auth = useAuthStore()

  return useQuery({
    queryKey: computed(() => ['admin', 'permits', 'list', { ...filters.value }] as const),
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchAdminPermits(filters.value)
    },
    enabled: computed(() => auth.isAuthenticated),
  })
}

export function usePermitSyncStatus() {
  const auth = useAuthStore()

  return useQuery({
    queryKey: ['admin', 'permits', 'sync-status'] as const,
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchPermitSyncStatus()
    },
    enabled: computed(() => auth.isAuthenticated),
  })
}

export function useAdminPermitTriageDetail(permitId: Ref<string>) {
  const auth = useAuthStore()

  return useQuery({
    queryKey: computed(() => ['admin', 'permits', 'detail', permitId.value] as const),
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      if (!permitId.value.trim()) throw new Error('Permit id required')
      return fetchAdminPermitTriageDetail(permitId.value)
    },
    enabled: computed(() => auth.isAuthenticated && !!permitId.value.trim()),
  })
}

export function usePermitSyncMutation() {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return postPermitSync()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'permits'] })
    },
  })
}
