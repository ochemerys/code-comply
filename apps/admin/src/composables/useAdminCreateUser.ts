import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { AdminCreateUserBody, AdminCreateUserResponse } from '@codecomply/validators'
import { useAuthStore } from '../stores/auth'
import { api } from '@/api/client'
import { parseRpcJson } from '@/api/rpc-json'

export async function postAdminCreateUser(
  body: AdminCreateUserBody,
): Promise<AdminCreateUserResponse> {
  const res = await api.admin.users.$post({ json: body })
  if (res.status === 409) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      typeof err === 'object' && err && 'message' in err
        ? String((err as { message: string }).message)
        : 'Email already registered',
    )
  }
  if (res.status === 400) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      typeof err === 'object' && err && 'message' in err
        ? String((err as { message: string }).message)
        : 'Invalid user data',
    )
  }
  return parseRpcJson(res, `Failed to create user (${res.status})`)
}

export function useAdminCreateUser() {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: AdminCreateUserBody) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return postAdminCreateUser(body)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
}
