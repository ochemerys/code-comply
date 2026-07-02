import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import type { ReviewVoCDTO, VoCDTO, VoCDecision } from '@codecomply/validators'
import { useAuthStore } from '../stores/auth'
import { api } from '@/api/client'
import { parseRpcJson } from '@/api/rpc-json'
import { readApiErrorMessage } from '@/api/typed-response'

export { isSessionExpiredRedirectError } from '../utils/admin-api-fetch'

export async function fetchPendingVoCs(): Promise<VoCDTO[]> {
  const res = await api.voc.pending.$get()
  return parseRpcJson(res, `Failed to load VoC queue (${res.status})`)
}

export async function postVoCReview(vocId: string, body: ReviewVoCDTO): Promise<VoCDTO> {
  const res = await api.voc[':id'].review.$post({ param: { id: vocId }, json: body })
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res))
  }
  return res.json() as Promise<VoCDTO>
}

export function useAdminVoCPending() {
  const auth = useAuthStore()

  return useQuery({
    queryKey: ['admin', 'voc', 'pending'] as const,
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchPendingVoCs()
    },
    enabled: computed(() => auth.isAuthenticated),
  })
}

export function useAdminVoCReviewMutation() {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { vocId: string; decision: VoCDecision; comments?: string }) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      const body: ReviewVoCDTO = {
        decision: input.decision,
        ...(input.comments?.trim() ? { comments: input.comments.trim() } : {}),
      }
      return postVoCReview(input.vocId, body)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'voc', 'pending'] })
    },
  })
}
