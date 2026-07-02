import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'
import type {
  AdminChecklistTemplateCreateBody,
  AdminChecklistTemplateDetailDTO,
  AdminChecklistTemplateListItemDTO,
  AdminChecklistTemplateUpdateBody,
  ChecklistTemplateDTO,
} from '@codecomply/validators'
import { useAuthStore } from '../stores/auth'
import { api } from '@/api/client'
import { parseRpcJson } from '@/api/rpc-json'
import { readApiErrorMessage } from '@/api/typed-response'

export { isSessionExpiredRedirectError } from '../utils/admin-api-fetch'

export type AdminChecklistTemplateFilters = {
  discipline: string
  search: string
  includeInactive: boolean
}

export async function fetchAdminChecklistTemplates(
  filters: AdminChecklistTemplateFilters,
): Promise<AdminChecklistTemplateListItemDTO[]> {
  const res = await api.admin['checklist-templates'].$get({
    query: {
      discipline: filters.discipline.trim() || undefined,
      search: filters.search.trim() || undefined,
      includeInactive: filters.includeInactive ? 'true' : undefined,
    },
  })
  return parseRpcJson(res, `Failed to load checklist templates (${res.status})`)
}

export async function fetchAdminChecklistTemplate(
  id: string,
): Promise<AdminChecklistTemplateDetailDTO> {
  const res = await api.admin['checklist-templates'][':id'].$get({ param: { id } })
  return parseRpcJson(res, `Failed to load checklist template (${res.status})`)
}

export async function createAdminChecklistTemplate(
  body: AdminChecklistTemplateCreateBody,
): Promise<AdminChecklistTemplateDetailDTO> {
  const res = await api.admin['checklist-templates'].$post({ json: body })
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res))
  }
  return res.json() as Promise<AdminChecklistTemplateDetailDTO>
}

export async function updateAdminChecklistTemplate(
  id: string,
  body: AdminChecklistTemplateUpdateBody,
): Promise<AdminChecklistTemplateDetailDTO> {
  const res = await api.admin['checklist-templates'][':id'].$put({ param: { id }, json: body })
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res))
  }
  return res.json() as Promise<AdminChecklistTemplateDetailDTO>
}

export async function publishAdminChecklistTemplate(id: string): Promise<ChecklistTemplateDTO> {
  const res = await api.admin['checklist-templates'][':id'].publish.$post({ param: { id } })
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res))
  }
  return res.json() as Promise<ChecklistTemplateDTO>
}

export async function createAdminChecklistTemplateVersion(
  id: string,
  body?: Partial<AdminChecklistTemplateUpdateBody>,
): Promise<AdminChecklistTemplateDetailDTO> {
  const res = await api.admin['checklist-templates'][':id']['new-version'].$post({
    param: { id },
    json: body ?? {},
  })
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res))
  }
  return res.json() as Promise<AdminChecklistTemplateDetailDTO>
}

export async function archiveAdminChecklistTemplate(id: string): Promise<ChecklistTemplateDTO> {
  const res = await api.admin['checklist-templates'][':id'].archive.$post({ param: { id } })
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res))
  }
  return res.json() as Promise<ChecklistTemplateDTO>
}

export function useAdminChecklistTemplatesList(filters: Ref<AdminChecklistTemplateFilters>) {
  const auth = useAuthStore()

  return useQuery({
    queryKey: computed(
      () => ['admin', 'checklist-templates', 'list', { ...filters.value }] as const,
    ),
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchAdminChecklistTemplates(filters.value)
    },
    enabled: computed(() => auth.isAuthenticated),
  })
}

export function useAdminChecklistTemplateDetail(id: Ref<string>) {
  const auth = useAuthStore()

  return useQuery({
    queryKey: computed(() => ['admin', 'checklist-templates', 'detail', id.value] as const),
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchAdminChecklistTemplate(id.value)
    },
    enabled: computed(() => auth.isAuthenticated && !!id.value),
  })
}

export function useCreateChecklistTemplateMutation() {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: AdminChecklistTemplateCreateBody) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return createAdminChecklistTemplate(body)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'checklist-templates'] })
    },
  })
}

export function useUpdateChecklistTemplateMutation() {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: AdminChecklistTemplateUpdateBody }) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return updateAdminChecklistTemplate(id, body)
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'checklist-templates'] })
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'checklist-templates', 'detail', vars.id],
      })
    },
  })
}

export function usePublishChecklistTemplateMutation() {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return publishAdminChecklistTemplate(id)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'checklist-templates'] })
    },
  })
}

export function useNewChecklistTemplateVersionMutation() {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string
      body?: Partial<AdminChecklistTemplateUpdateBody>
    }) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return createAdminChecklistTemplateVersion(id, body)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'checklist-templates'] })
    },
  })
}

export function useArchiveChecklistTemplateMutation() {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return archiveAdminChecklistTemplate(id)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'checklist-templates'] })
    },
  })
}
