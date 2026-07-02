import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'
import type { UserDTO, UserRole } from '@codecomply/validators'
import { useAuthStore } from '../stores/auth'
import { api } from '@/api/client'
import { parseRpcJson } from '@/api/rpc-json'

export {
  SessionExpiredRedirectError,
  isSessionExpiredRedirectError,
} from '../utils/admin-api-fetch'

export type AdminUsersApiFilters = {
  role: UserRole | ''
  isActive: 'all' | 'true' | 'false'
  search: string
}

export async function fetchAdminUsers(filters: AdminUsersApiFilters): Promise<UserDTO[]> {
  const query: {
    role?: UserRole
    isActive?: boolean
    search?: string
  } = {}
  if (filters.role) query.role = filters.role
  if (filters.isActive === 'true') query.isActive = true
  if (filters.isActive === 'false') query.isActive = false
  if (filters.search.trim()) query.search = filters.search.trim()

  const res = await api.admin.users.$get({
    query: {
      role: query.role,
      isActive: query.isActive === undefined ? undefined : query.isActive ? 'true' : 'false',
      search: query.search,
    },
  })
  return parseRpcJson(res, `Failed to load users (${res.status})`)
}

export function useAdminUsersList(filters: Ref<AdminUsersApiFilters>) {
  const auth = useAuthStore()

  const queryKey = computed(() => ['admin', 'users', { ...filters.value }] as const)

  return useQuery({
    queryKey,
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchAdminUsers(filters.value)
    },
    enabled: computed(() => auth.isAuthenticated),
    placeholderData: keepPreviousData,
  })
}
