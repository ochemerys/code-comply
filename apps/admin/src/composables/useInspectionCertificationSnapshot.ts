import { useQuery } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'
import type { InspectionCertificationSnapshot } from '@codecomply/validators'
import { useAuthStore } from '../stores/auth'
import { api } from '@/api/client'
import { parseRpcJson } from '@/api/rpc-json'

export async function fetchInspectionCertificationSnapshot(
  inspectionId: string,
): Promise<InspectionCertificationSnapshot> {
  const res = await api.admin.inspections[':id']['certification-snapshot'].$get({
    param: { id: inspectionId },
  })
  if (res.status === 404) throw new Error('Inspection not found')
  return parseRpcJson(res, `Failed to load certification snapshot (${res.status})`)
}

export function useInspectionCertificationSnapshot(
  inspectionId: Ref<string | null>,
  enabled: Ref<boolean>,
) {
  const auth = useAuthStore()

  return useQuery({
    queryKey: computed(() => ['admin', 'inspection', inspectionId.value, 'cert-snapshot'] as const),
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      if (!inspectionId.value) throw new Error('No inspection selected')
      return fetchInspectionCertificationSnapshot(inspectionId.value)
    },
    enabled: computed(() => auth.isAuthenticated && !!inspectionId.value && enabled.value),
  })
}
