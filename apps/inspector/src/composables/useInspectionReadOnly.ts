import { computed, type ComputedRef } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { db } from '@/lib/db/dexie'
import type { LocalInspection } from '@/lib/db/types'

export type UseInspectionReadOnlyParams = {
  inspectionId: ComputedRef<string | undefined>
}

export type UseInspectionReadOnlyReturn = {
  inspection: ComputedRef<LocalInspection | null>
  isReadOnlyAfterSync: ComputedRef<boolean>
}

/**
 * M8-S10: finalized inspections become read-only after they have been successfully synced.
 *
 * We treat `PASSED` and `FAILED` as "finalized" states in the inspector app.
 * Read-only is enforced only after a successful sync: `syncedAt` is set and `isDirty` is false.
 */
export function useInspectionReadOnly(
  params: UseInspectionReadOnlyParams,
): UseInspectionReadOnlyReturn {
  const inspectionQuery = useQuery({
    queryKey: computed(() => ['inspection', params.inspectionId.value ?? '']),
    enabled: computed(() => Boolean(params.inspectionId.value)),
    queryFn: async (): Promise<LocalInspection | null> => {
      const id = params.inspectionId.value
      if (!id) return null
      return (await db.inspections.get(id)) ?? null
    },
    staleTime: 2000,
    refetchOnWindowFocus: false,
  })

  const inspection = computed(() => inspectionQuery.data.value ?? null)

  const isReadOnlyAfterSync = computed(() => {
    const i = inspection.value
    if (!i) return false
    const isFinalized = i.status === 'PASSED' || i.status === 'FAILED'
    const hasSynced = Boolean(i.syncedAt) && i.isDirty === false
    return isFinalized && hasSynced
  })

  return { inspection, isReadOnlyAfterSync }
}
