import { useQuery } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'
import type { AdminInspectionRecordDetail } from '@codecomply/validators'
import { useAuthStore } from '../stores/auth'
import { api } from '@/api/client'
import { parseRpcJson } from '@/api/rpc-json'

export async function fetchAdminInspectionRecord(
  inspectionId: string,
): Promise<AdminInspectionRecordDetail> {
  const res = await api.admin.inspections[':id'].record.$get({
    param: { id: inspectionId },
  })
  if (res.status === 404) throw new Error('Inspection record not found')
  return parseRpcJson(res, `Failed to load inspection record (${res.status})`)
}

export function useAdminInspectionRecord(inspectionId: Ref<string>) {
  const auth = useAuthStore()

  return useQuery({
    queryKey: computed(() => ['admin', 'inspection-record', inspectionId.value] as const),
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      if (!inspectionId.value) throw new Error('No inspection selected')
      return fetchAdminInspectionRecord(inspectionId.value)
    },
    enabled: computed(() => auth.isAuthenticated && !!inspectionId.value),
  })
}
