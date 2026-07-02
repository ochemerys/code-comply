import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'
import type { CertificationDTO, UserDTO } from '@codecomply/validators'
import { useAuthStore } from '../stores/auth'
import { api } from '@/api/client'
import { parseRpcJson } from '@/api/rpc-json'

export {
  SessionExpiredRedirectError,
  isSessionExpiredRedirectError,
} from '../utils/admin-api-fetch'

export type AdminPatchUserBody = {
  name?: string
  designationId?: string | null
  disciplines?: string[]
  authorities?: string[]
  certificationExpiry?: string | null
}

export async function fetchAdminUser(id: string): Promise<UserDTO> {
  const res = await api.admin.users[':id'].$get({ param: { id } })
  if (res.status === 404) throw new Error('User not found')
  return parseRpcJson(res, `Failed to load user (${res.status})`)
}

export async function patchAdminUser(id: string, body: AdminPatchUserBody): Promise<UserDTO> {
  const res = await api.admin.users[':id'].$patch({ param: { id }, json: body })
  if (res.status === 404) throw new Error('User not found')
  return parseRpcJson(res, `Failed to save user (${res.status})`)
}

export async function postAdminUserCertifications(
  id: string,
  certifications: CertificationDTO[],
): Promise<UserDTO> {
  const res = await api.admin.users[':id'].certifications.$post({
    param: { id },
    json: { certifications },
  })
  if (res.status === 404) throw new Error('User not found')
  return parseRpcJson(res, `Failed to save certifications (${res.status})`)
}

export async function postAdminUserDeactivate(id: string): Promise<UserDTO> {
  const res = await api.admin.users[':id'].deactivate.$post({ param: { id } })
  if (res.status === 404) throw new Error('User not found')
  return parseRpcJson(res, `Failed to deactivate (${res.status})`)
}

export async function postAdminUserRemoteWipe(
  id: string,
): Promise<{ message: string; requestedAt: string; userId: string }> {
  const res = await api.admin.users[':id']['remote-wipe'].$post({ param: { id } })
  if (res.status === 404) throw new Error('User not found')
  return parseRpcJson(res, `Failed to trigger remote wipe (${res.status})`)
}

export function useAdminUserDetail(userId: Ref<string>) {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  const userQuery = useQuery({
    queryKey: computed(() => ['admin', 'user', userId.value] as const),
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchAdminUser(userId.value)
    },
    enabled: computed(() => auth.isAuthenticated && !!userId.value),
  })

  const patchUser = useMutation({
    mutationFn: (body: AdminPatchUserBody) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return patchAdminUser(userId.value, body)
    },
    onSuccess: (u) => {
      queryClient.setQueryData(['admin', 'user', userId.value], u)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })

  const saveCertifications = useMutation({
    mutationFn: (certs: CertificationDTO[]) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return postAdminUserCertifications(userId.value, certs)
    },
    onSuccess: (u) => {
      queryClient.setQueryData(['admin', 'user', userId.value], u)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })

  const deactivateUser = useMutation({
    mutationFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return postAdminUserDeactivate(userId.value)
    },
    onSuccess: (u) => {
      queryClient.setQueryData(['admin', 'user', userId.value], u)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })

  const remoteWipeUser = useMutation({
    mutationFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return postAdminUserRemoteWipe(userId.value)
    },
  })

  return { userQuery, patchUser, saveCertifications, deactivateUser, remoteWipeUser }
}
