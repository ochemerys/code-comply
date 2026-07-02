import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'
import type {
  AdminCodeLibraryCreateBody,
  AdminCodeLibraryUpdateBody,
  CodeLibraryEntryDTO,
} from '@codecomply/validators'
import { useAuthStore } from '../stores/auth'
import { api } from '@/api/client'
import { parseRpcJson } from '@/api/rpc-json'
import { readApiErrorMessage } from '@/api/typed-response'

export { isSessionExpiredRedirectError } from '../utils/admin-api-fetch'

export type AdminCodeLibraryFilters = {
  query: string
  type: string
}

export async function fetchAdminCodeLibrary(
  filters: AdminCodeLibraryFilters,
): Promise<CodeLibraryEntryDTO[]> {
  const res = await api.admin['code-library'].$get({
    query: {
      q: filters.query.trim() || undefined,
      type: filters.type.trim() || undefined,
    },
  })
  return parseRpcJson(res, `Failed to load code library (${res.status})`)
}

export async function createAdminCodeLibraryEntry(
  body: AdminCodeLibraryCreateBody,
): Promise<CodeLibraryEntryDTO> {
  const res = await api.admin['code-library'].$post({ json: body })
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res))
  }
  return res.json() as Promise<CodeLibraryEntryDTO>
}

export async function updateAdminCodeLibraryEntry(
  id: string,
  body: AdminCodeLibraryUpdateBody,
): Promise<CodeLibraryEntryDTO> {
  const res = await api.admin['code-library'][':id'].$put({ param: { id }, json: body })
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res))
  }
  return res.json() as Promise<CodeLibraryEntryDTO>
}

export function useAdminCodeLibraryList(filters: Ref<AdminCodeLibraryFilters>) {
  const auth = useAuthStore()

  return useQuery({
    queryKey: computed(() => ['admin', 'code-library', 'list', { ...filters.value }] as const),
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchAdminCodeLibrary(filters.value)
    },
    enabled: computed(() => auth.isAuthenticated),
  })
}

export function useCreateCodeLibraryEntryMutation() {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: AdminCodeLibraryCreateBody) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return createAdminCodeLibraryEntry(body)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'code-library'] })
    },
  })
}

export function useUpdateCodeLibraryEntryMutation() {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: AdminCodeLibraryUpdateBody }) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return updateAdminCodeLibraryEntry(id, body)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'code-library'] })
    },
  })
}
