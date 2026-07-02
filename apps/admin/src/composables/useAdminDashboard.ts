import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import type { AdminDashboardPayloadDTO } from '@codecomply/validators'
import { useAuthStore } from '../stores/auth'
import { api } from '@/api/client'
import { parseRpcJson } from '@/api/rpc-json'

export type DashboardStats = AdminDashboardPayloadDTO['stats']
export type RecentInspectionRow = AdminDashboardPayloadDTO['recentInspections'][number]
export type PendingAssignmentRow = AdminDashboardPayloadDTO['pendingAssignments'][number]
export type AdminDashboardPayload = AdminDashboardPayloadDTO

const REFETCH_MS = 45_000

export async function fetchAdminDashboardPayload(): Promise<AdminDashboardPayload> {
  const res = await api.admin.orders.dashboard.$get()
  return parseRpcJson(res, `Failed to load dashboard (${res.status})`)
}

export function useAdminDashboard() {
  const auth = useAuthStore()

  return useQuery({
    queryKey: ['admin', 'dashboard-home'],
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchAdminDashboardPayload()
    },
    enabled: computed(() => auth.isAuthenticated),
    refetchInterval: REFETCH_MS,
    staleTime: 10_000,
  })
}
