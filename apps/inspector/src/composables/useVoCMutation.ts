/**
 * useVoCMutation — submit Verification of Compliance for a deficiency (M10-S13).
 *
 * Online: POST /api/deficiencies/:id/voc and refresh local deficiency status.
 * Offline: optimistically mark VOC_SUBMITTED and queue deficiency.voc.submit for sync.
 */

import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { SubmitVoCDTO, VoCDTO } from '@codecomply/validators'
import { useNetworkStore } from '@/stores/network'
import { db } from '@/lib/db/dexie'
import { syncEngine } from '@/lib/db/sync-engine'
import { apiFetch } from '@/utils/api-error-handler'
import { getApiBaseUrl } from '@/lib/api-base'
import type { LocalDeficiency } from '@/lib/db/types'
import { deficiencyQueryKey } from '@/composables/useDeficiencyMutation'

export type SubmitVoCMutationInput = {
  deficiencyId: string
  payload: SubmitVoCDTO
}

function apiPrefix(): string {
  const base = getApiBaseUrl()
  return base ? `${base}/api` : '/api'
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const j = JSON.parse(text) as { error?: string; message?: string }
    return j.message || j.error || text || `Request failed (${res.status})`
  } catch {
    return text || `Request failed (${res.status})`
  }
}

function applyVoCSubmitted(prev: LocalDeficiency): LocalDeficiency {
  const now = new Date().toISOString()
  return {
    ...prev,
    status: 'VOC_SUBMITTED',
    updatedAt: now,
    isDirty: true,
  }
}

export interface UseVoCMutationReturn {
  submitVoC: ReturnType<typeof useMutation<LocalDeficiency, Error, SubmitVoCMutationInput>>
}

export function useVoCMutation(): UseVoCMutationReturn {
  const queryClient = useQueryClient()
  const networkStore = useNetworkStore()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: deficiencyQueryKey })
  }

  const submitVoC = useMutation({
    mutationFn: async ({
      deficiencyId,
      payload,
    }: SubmitVoCMutationInput): Promise<LocalDeficiency> => {
      const prev = await db.deficiencies.get(deficiencyId)
      if (!prev) {
        throw new Error(`Deficiency ${deficiencyId} not found`)
      }

      if (!networkStore.isOnline) {
        const row = applyVoCSubmitted(prev)
        await db.deficiencies.put(row)
        await syncEngine.queueMutation('deficiency.voc.submit', { deficiencyId, payload }, 5)
        return row
      }

      const optimistic = applyVoCSubmitted(prev)
      const optimisticUpdatedAt = optimistic.updatedAt
      await db.deficiencies.put(optimistic)

      try {
        const res = await apiFetch(
          `${apiPrefix()}/deficiencies/${encodeURIComponent(deficiencyId)}/voc`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
        )
        if (!res.ok) {
          throw new Error(await readErrorMessage(res))
        }
        const _voc = (await res.json()) as VoCDTO
        const synced: LocalDeficiency = {
          ...optimistic,
          isDirty: false,
          syncedAt: _voc.submittedAt ?? new Date().toISOString(),
        }
        await db.deficiencies.put(synced)
        return synced
      } catch (e) {
        const current = await db.deficiencies.get(deficiencyId)
        if (current?.updatedAt === optimisticUpdatedAt) {
          await db.deficiencies.put(prev)
        }
        throw e
      }
    },
    onSettled: () => invalidate(),
  })

  return { submitVoC }
}
