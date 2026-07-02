import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'
import type {
  AdminInspectionWorkflowDetail,
  AdminNoEntryLetterRequest,
  AdminNoEntryLetterResponse,
  UpdateAdminInspectionWorkflow,
} from '@codecomply/validators'
import { useAuthStore } from '../stores/auth'
import { api } from '@/api/client'
import { parseRpcJson } from '@/api/rpc-json'
import { readApiErrorMessage } from '@/api/typed-response'

export { isSessionExpiredRedirectError } from '../utils/admin-api-fetch'

export async function fetchAdminInspectionWorkflow(
  inspectionId: string,
): Promise<AdminInspectionWorkflowDetail> {
  const res = await api.admin.inspections[':id'].workflow.$get({ param: { id: inspectionId } })
  return parseRpcJson(res, `Failed to load inspection workflow (${res.status})`)
}

export async function patchAdminInspectionWorkflow(
  inspectionId: string,
  body: UpdateAdminInspectionWorkflow,
): Promise<AdminInspectionWorkflowDetail> {
  const res = await api.admin.inspections[':id'].workflow.$patch({
    param: { id: inspectionId },
    json: body,
  })
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res))
  }
  return res.json() as Promise<AdminInspectionWorkflowDetail>
}

export async function postAdminNoEntryLetter(
  inspectionId: string,
  body: AdminNoEntryLetterRequest,
): Promise<AdminNoEntryLetterResponse> {
  const res = await api.admin.inspections[':id']['no-entry-letter'].$post({
    param: { id: inspectionId },
    json: body,
  })
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res))
  }
  return res.json() as Promise<AdminNoEntryLetterResponse>
}

export function useAdminInspectionWorkflow(inspectionId: Ref<string>) {
  const auth = useAuthStore()

  return useQuery({
    queryKey: computed(() => ['admin', 'inspection-workflow', inspectionId.value] as const),
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchAdminInspectionWorkflow(inspectionId.value)
    },
    enabled: computed(() => auth.isAuthenticated && !!inspectionId.value),
  })
}

export function useUpdateInspectionWorkflowMutation(inspectionId: Ref<string>) {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: UpdateAdminInspectionWorkflow) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return patchAdminInspectionWorkflow(inspectionId.value, body)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'inspection-workflow', inspectionId.value],
      })
    },
  })
}

export function useNoEntryLetterMutation(inspectionId: Ref<string>) {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: AdminNoEntryLetterRequest) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return postAdminNoEntryLetter(inspectionId.value, body)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'inspection-workflow', inspectionId.value],
      })
    },
  })
}

export function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

export function fromDateInput(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  return new Date(`${trimmed}T12:00:00.000Z`).toISOString()
}
