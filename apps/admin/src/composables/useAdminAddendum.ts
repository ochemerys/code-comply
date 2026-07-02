import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'
import type { AddendumDTO, CreateAddendumRequest } from '@codecomply/validators'
import { useAuthStore } from '../stores/auth'
import { api } from '@/api/client'
import { parseRpcJson } from '@/api/rpc-json'

export async function fetchAdminAddendum(
  inspectionId: string,
  addendumId: string,
): Promise<AddendumDTO> {
  const res = await api.admin.inspections[':id'].addendums[':addendumId'].$get({
    param: { id: inspectionId, addendumId },
  })
  if (res.status === 404) throw new Error('Addendum not found')
  return parseRpcJson(res, `Failed to load addendum (${res.status})`)
}

export async function createAdminAddendum(
  inspectionId: string,
  body: CreateAddendumRequest,
): Promise<AddendumDTO> {
  const res = await api.admin.inspections[':id'].addendum.$post({
    param: { id: inspectionId },
    json: body,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const message =
      typeof err === 'object' && err && 'error' in err && typeof err.error === 'string'
        ? err.error
        : `Failed to create addendum (${res.status})`
    throw new Error(message)
  }
  return parseRpcJson(res, `Failed to create addendum (${res.status})`)
}

export function useAdminAddendumDetail(inspectionId: Ref<string>, addendumId: Ref<string | null>) {
  const auth = useAuthStore()

  return useQuery({
    queryKey: computed(() => ['admin', 'addendum', inspectionId.value, addendumId.value] as const),
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      if (!inspectionId.value || !addendumId.value) throw new Error('No addendum selected')
      return fetchAdminAddendum(inspectionId.value, addendumId.value)
    },
    enabled: computed(() => auth.isAuthenticated && !!inspectionId.value && !!addendumId.value),
  })
}

export function useAdminCreateAddendum(inspectionId: Ref<string>) {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: CreateAddendumRequest) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      if (!inspectionId.value) throw new Error('No inspection selected')
      return createAdminAddendum(inspectionId.value, body)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'inspection-record', inspectionId.value],
      })
    },
  })
}
