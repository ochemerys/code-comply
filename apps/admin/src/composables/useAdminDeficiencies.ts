import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'
import type {
  CodeLibraryEntryDTO,
  CodeReferenceDTO,
  CreateDeficiencyDTO,
  DeficiencyDTO,
  DeficiencySeverity,
  DeficiencyStatus,
  InspectionListDTO,
  UpdateDeficiencyDTO,
  VoCDTO,
} from '@codecomply/validators'
import { useAuthStore } from '../stores/auth'
import { api } from '@/api/client'
import { parseRpcJson } from '@/api/rpc-json'
import { readApiErrorMessage } from '@/api/typed-response'

export { isSessionExpiredRedirectError } from '../utils/admin-api-fetch'

export type AdminDeficiencyFilters = {
  inspectionId: string
  status: '' | DeficiencyStatus
  severity: '' | DeficiencySeverity
  permitNumber: string
  dueDateFrom: string
  dueDateTo: string
}

export const EMPTY_DEFICIENCY_FILTERS: AdminDeficiencyFilters = {
  inspectionId: '',
  status: '',
  severity: '',
  permitNumber: '',
  dueDateFrom: '',
  dueDateTo: '',
}

export function newDeficiencyClientId(): string {
  return crypto.randomUUID()
}

export function deficiencyStatusLabel(status: DeficiencyStatus): string {
  switch (status) {
    case 'OPEN':
      return 'Open'
    case 'CLOSED':
      return 'Resolved'
    case 'VOC_SUBMITTED':
      return 'VoC pending review'
    case 'VOC_ACCEPTED':
      return 'VoC accepted'
    case 'VOC_REJECTED':
      return 'VoC rejected'
    default:
      return status
  }
}

export function applyClientDeficiencyFilters(
  rows: DeficiencyDTO[],
  filters: AdminDeficiencyFilters,
  inspectionById: Map<string, InspectionListDTO>,
): DeficiencyDTO[] {
  let out = rows

  const permit = filters.permitNumber.trim().toLowerCase()
  if (permit) {
    out = out.filter((d) => {
      const insp = inspectionById.get(d.inspectionId)
      return insp?.permitNumber?.toLowerCase().includes(permit) ?? false
    })
  }

  if (filters.dueDateFrom) {
    const from = new Date(`${filters.dueDateFrom}T00:00:00.000Z`).getTime()
    out = out.filter((d) => {
      if (!d.dueDate) return false
      return new Date(d.dueDate).getTime() >= from
    })
  }

  if (filters.dueDateTo) {
    const to = new Date(`${filters.dueDateTo}T23:59:59.999Z`).getTime()
    out = out.filter((d) => {
      if (!d.dueDate) return false
      return new Date(d.dueDate).getTime() <= to
    })
  }

  return out
}

export async function fetchAdminDeficiencies(filters: {
  inspectionId?: string
  status?: DeficiencyStatus
  severity?: DeficiencySeverity
}): Promise<DeficiencyDTO[]> {
  const res = await api.deficiencies.$get({
    query: {
      inspectionId: filters.inspectionId || undefined,
      status: filters.status,
      severity: filters.severity,
    },
  })
  return parseRpcJson(res, `Failed to load deficiencies (${res.status})`)
}

export async function fetchAdminDeficiency(id: string): Promise<DeficiencyDTO> {
  const res = await api.deficiencies[':id'].$get({ param: { id } })
  if (res.status === 404) throw new Error('Deficiency not found')
  return parseRpcJson(res, `Failed to load deficiency (${res.status})`)
}

export async function fetchDeficiencyVoC(deficiencyId: string): Promise<VoCDTO | null> {
  const res = await api.deficiencies[':id'].voc.$get({ param: { id: deficiencyId } })
  if (res.status === 404) {
    throw new Error('Deficiency not found')
  }
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res))
  }
  const data = (await res.json()) as VoCDTO | null
  return data
}

/** VoC exists only after inspector submission (or admin review lifecycle). */
export function deficiencyMayHaveVoC(status: DeficiencyStatus): boolean {
  return status === 'VOC_SUBMITTED' || status === 'VOC_ACCEPTED' || status === 'VOC_REJECTED'
}

export async function createAdminDeficiency(body: CreateDeficiencyDTO): Promise<DeficiencyDTO> {
  const res = await api.deficiencies.$post({ json: body })
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res))
  }
  return res.json() as Promise<DeficiencyDTO>
}

export async function updateAdminDeficiency(
  id: string,
  body: UpdateDeficiencyDTO,
): Promise<DeficiencyDTO> {
  const res = await api.deficiencies[':id'].$patch({ param: { id }, json: body })
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res))
  }
  return res.json() as Promise<DeficiencyDTO>
}

export async function deleteAdminDeficiency(id: string): Promise<void> {
  const res = await api.deficiencies[':id'].$delete({ param: { id } })
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res))
  }
}

export async function searchAdminCodeReferences(query: string): Promise<CodeReferenceDTO[]> {
  const q = query.trim()
  if (!q) return []
  const res = await api.admin['code-library'].$get({ query: { q } })
  const entries = await parseRpcJson<CodeLibraryEntryDTO[]>(
    res,
    `Failed to search codes (${res.status})`,
  )
  return entries.map((entry) => ({
    id: entry.id,
    code: entry.code,
    section: entry.section,
    title: entry.title,
  }))
}

export async function fetchAdminInspectionsForDeficiencies(): Promise<InspectionListDTO[]> {
  const res = await api.inspections.$get({ query: { limit: '100' } })
  return parseRpcJson(res, `Failed to load inspections (${res.status})`)
}

export function useAdminDeficienciesList(
  filters: Ref<AdminDeficiencyFilters>,
  inspections: Ref<InspectionListDTO[] | undefined>,
) {
  const auth = useAuthStore()

  return useQuery({
    queryKey: computed(() => ['admin', 'deficiencies', 'list', { ...filters.value }] as const),
    queryFn: async () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      const rows = await fetchAdminDeficiencies({
        inspectionId: filters.value.inspectionId.trim() || undefined,
        status: filters.value.status || undefined,
        severity: filters.value.severity || undefined,
      })
      const map = new Map((inspections.value ?? []).map((i) => [i.id, i]))
      return applyClientDeficiencyFilters(rows, filters.value, map)
    },
    enabled: computed(() => auth.isAuthenticated),
  })
}

export function useAdminInspectionsForDeficiencies() {
  const auth = useAuthStore()

  return useQuery({
    queryKey: ['admin', 'deficiencies', 'inspections'] as const,
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchAdminInspectionsForDeficiencies()
    },
    enabled: computed(() => auth.isAuthenticated),
  })
}

export function useAdminDeficiencyDetail(id: Ref<string>) {
  const auth = useAuthStore()

  return useQuery({
    queryKey: computed(() => ['admin', 'deficiencies', 'detail', id.value] as const),
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      if (!id.value) throw new Error('No deficiency selected')
      return fetchAdminDeficiency(id.value)
    },
    enabled: computed(() => auth.isAuthenticated && !!id.value),
  })
}

export function useDeficiencyVoC(deficiencyId: Ref<string>, fetchWhen?: Ref<boolean | undefined>) {
  const auth = useAuthStore()

  return useQuery({
    queryKey: computed(() => ['admin', 'deficiencies', 'voc', deficiencyId.value] as const),
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      if (!deficiencyId.value) throw new Error('No deficiency selected')
      return fetchDeficiencyVoC(deficiencyId.value)
    },
    enabled: computed(
      () => auth.isAuthenticated && !!deficiencyId.value && (fetchWhen?.value ?? true),
    ),
  })
}

export function useCreateDeficiencyMutation() {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: CreateDeficiencyDTO) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return createAdminDeficiency(body)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'deficiencies'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'inspection-record'] })
    },
  })
}

export function useUpdateDeficiencyMutation(deficiencyId: Ref<string>) {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: UpdateDeficiencyDTO) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      if (!deficiencyId.value) throw new Error('No deficiency selected')
      return updateAdminDeficiency(deficiencyId.value, body)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'deficiencies'] })
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'deficiencies', 'detail', deficiencyId.value],
      })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'inspection-record'] })
    },
  })
}

export function useDeleteDeficiencyMutation() {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return deleteAdminDeficiency(id)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'deficiencies'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'inspection-record'] })
    },
  })
}
