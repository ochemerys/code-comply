import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import type { AdminInspectionMonitorPayloadDTO } from '@codecomply/validators'
import { useAuthStore } from '../stores/auth'
import { api } from '@/api/client'
import { parseRpcJson } from '@/api/rpc-json'

export type InspectionSyncStatus = 'SYNCED' | 'SYNCING' | 'OFFLINE'

export type InspectionMonitorRow = AdminInspectionMonitorPayloadDTO['inspections'][number]

export type InspectionMonitorPayload = AdminInspectionMonitorPayloadDTO

export const INSPECTION_MONITOR_REFETCH_MS = 30_000

export async function fetchInspectionMonitorPayload(): Promise<InspectionMonitorPayload> {
  const res = await api.admin.orders['inspection-monitor'].$get()
  return parseRpcJson(res, `Failed to load inspection monitor (${res.status})`)
}

export function useInspectionMonitor() {
  const auth = useAuthStore()

  return useQuery({
    queryKey: ['admin', 'inspection-monitor'],
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchInspectionMonitorPayload()
    },
    enabled: computed(() => auth.isAuthenticated),
    refetchInterval: INSPECTION_MONITOR_REFETCH_MS,
    staleTime: 10_000,
  })
}
