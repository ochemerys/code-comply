import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import type { AuditLogListResponse } from '@codecomply/validators'
import { useAuthStore } from '../stores/auth'
import { api } from '@/api/client'
import { parseRpcJson } from '@/api/rpc-json'

export async function fetchPermitSyncAuditLogs(limit = 5): Promise<AuditLogListResponse> {
  const res = await api.admin['audit-logs'].$get({
    query: { action: 'PERMIT_SYNC', limit: String(limit) },
  })
  return parseRpcJson(res, `Failed to load audit logs (${res.status})`)
}

export function usePermitSyncAuditLogs(limit = 5) {
  const auth = useAuthStore()

  return useQuery({
    queryKey: ['admin', 'audit-logs', 'PERMIT_SYNC', limit] as const,
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchPermitSyncAuditLogs(limit)
    },
    enabled: computed(() => auth.isAuthenticated),
  })
}
