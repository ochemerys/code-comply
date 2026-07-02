import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'
import type {
  AdminOrderAlertListItemDTO,
  AdminOrderDetailDTO,
  AdminOrderOverrideLockOutBody,
  AdminOrdersSummaryDTO,
} from '@codecomply/validators'
import { useAuthStore } from '../stores/auth'
import { api } from '@/api/client'
import { parseRpcJson } from '@/api/rpc-json'
import { readApiErrorMessage } from '@/api/typed-response'

export { isSessionExpiredRedirectError } from '../utils/admin-api-fetch'

export const ADMIN_ORDERS_POLL_MS = 25_000

export async function fetchAdminOrders(): Promise<AdminOrderAlertListItemDTO[]> {
  const res = await api.admin.orders.$get()
  return parseRpcJson(res, `Failed to load orders (${res.status})`)
}

export async function fetchAdminOrdersSummary(): Promise<AdminOrdersSummaryDTO> {
  const res = await api.admin.orders.summary.$get()
  return parseRpcJson(res, `Failed to load order summary (${res.status})`)
}

export async function fetchAdminOrderDetail(deficiencyId: string): Promise<AdminOrderDetailDTO> {
  const res = await api.admin.orders[':deficiencyId'].$get({ param: { deficiencyId } })
  return parseRpcJson(res, `Failed to load order (${res.status})`)
}

export async function overrideAdminOrderLockOut(
  deficiencyId: string,
  body: AdminOrderOverrideLockOutBody,
): Promise<{ lockedOut: boolean }> {
  const res = await api.admin.orders[':deficiencyId']['override-lockout'].$post({
    param: { deficiencyId },
    json: body,
  })
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res))
  }
  return res.json() as Promise<{ lockedOut: boolean }>
}

export function useAdminOrders() {
  const auth = useAuthStore()

  return useQuery({
    queryKey: ['admin', 'orders'],
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchAdminOrders()
    },
    enabled: computed(() => auth.isAuthenticated),
    refetchInterval: ADMIN_ORDERS_POLL_MS,
    staleTime: 10_000,
  })
}

export function useAdminOrdersSummary() {
  const auth = useAuthStore()

  return useQuery({
    queryKey: ['admin', 'orders', 'summary'],
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchAdminOrdersSummary()
    },
    enabled: computed(() => auth.isAuthenticated),
    refetchInterval: ADMIN_ORDERS_POLL_MS,
    staleTime: 10_000,
  })
}

export function useAdminOrderDetail(deficiencyId: Ref<string>) {
  const auth = useAuthStore()

  return useQuery({
    queryKey: computed(() => ['admin', 'orders', 'detail', deficiencyId.value]),
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchAdminOrderDetail(deficiencyId.value)
    },
    enabled: computed(() => auth.isAuthenticated && deficiencyId.value.length > 0),
  })
}

export function useAdminOrderLockOutOverride() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      deficiencyId,
      body,
    }: {
      deficiencyId: string
      body: AdminOrderOverrideLockOutBody
    }) => overrideAdminOrderLockOut(deficiencyId, body),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] })
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'orders', 'detail', variables.deficiencyId],
      })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard-home'] })
    },
  })
}
