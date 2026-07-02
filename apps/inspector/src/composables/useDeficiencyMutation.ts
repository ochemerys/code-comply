/**
 * useDeficiencyMutation — TanStack Query mutations for deficiency CRUD with offline queue + IndexedDB.
 *
 * @see M6-S5 - Create useDeficiencyMutation Composable
 * @see M6-S15 - issueStopWorkOrder (POST stop-work, offline high-priority queue)
 * @see M6-S16 - unsafe flag uses high sync priority with Stop Work / CRITICAL
 * @see testing-strategy.md §4.4 Frontend Composable Testing
 */

import { useMutation, useQueryClient } from '@tanstack/vue-query'
import {
  DeficiencyDTOSchema,
  type CreateDeficiencyDTO,
  type DeficiencyDTO,
  type UpdateDeficiencyDTO,
} from '@codecomply/validators'
import { useAuthStore } from '@/stores/auth'
import { useNetworkStore } from '@/stores/network'
import { db } from '@/lib/db/dexie'
import { syncEngine } from '@/lib/db/sync-engine'
import { api } from '@/api/client'
import { etagFromResponse, readApiErrorMessage } from '@/api/typed-response'
import { apiFetch } from '@/utils/api-error-handler'
import { getApiBaseUrl } from '@/lib/api-base'
import { toLocalCodeReference } from '@/lib/db/sync-mutation-helpers'
import { isDeviceOffline, isNetworkFailure } from '@/lib/device-offline'
import type { LocalDeficiency } from '@/lib/db/types'

export const deficiencyQueryKey = ['deficiencies'] as const

export type CreateDeficiencyMutationInput = CreateDeficiencyDTO

export type UpdateDeficiencyMutationInput = {
  id: string
  /** ETag from last fetch / PATCH response (optional; required for strict concurrency on server) */
  ifMatch?: string
  updates: UpdateDeficiencyDTO
}

export type DeleteDeficiencyMutationInput = {
  id: string
}

export type IssueStopWorkMutationInput = {
  id: string
}

function apiPrefix(): string {
  const base = getApiBaseUrl()
  return base ? `${base}/api` : '/api'
}

function syncPriorityFromLocal(
  row: Pick<LocalDeficiency, 'isStopWork' | 'isUnsafe' | 'severity'>,
): number {
  return row.isStopWork || row.isUnsafe || row.severity === 'CRITICAL' ? 1 : 10
}

function dtoToLocal(
  dto: DeficiencyDTO,
  createdById: string,
  opts?: { etag?: string; isDirty?: boolean; syncedAt?: string },
): LocalDeficiency {
  return {
    id: dto.id,
    clientId: dto.clientId,
    inspectionId: dto.inspectionId,
    checklistItemId: dto.checklistItemId,
    createdById,
    description: dto.description,
    location: dto.location,
    severity: dto.severity,
    status: dto.status,
    codeReference: toLocalCodeReference(dto.codeReference),
    isStopWork: dto.isStopWork,
    isUnsafe: dto.isUnsafe,
    dueDate: dto.dueDate,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    isDirty: opts?.isDirty ?? false,
    etag: opts?.etag,
    syncedAt: opts?.syncedAt ?? dto.updatedAt,
  }
}

function createLocalFromCreatePayload(
  payload: CreateDeficiencyDTO,
  id: string,
  createdById: string,
  overrides?: Partial<LocalDeficiency>,
): LocalDeficiency {
  const now = new Date().toISOString()
  return {
    id,
    clientId: payload.clientId,
    inspectionId: payload.inspectionId,
    checklistItemId: payload.checklistItemId,
    createdById,
    description: payload.description,
    location: payload.location,
    severity: payload.severity,
    status: 'OPEN',
    codeReference: toLocalCodeReference(payload.codeReference),
    isStopWork: payload.isStopWork ?? false,
    isUnsafe: payload.isUnsafe ?? false,
    dueDate: payload.dueDate,
    createdAt: now,
    updatedAt: now,
    isDirty: true,
    ...overrides,
  }
}

function applyUpdates(prev: LocalDeficiency, updates: UpdateDeficiencyDTO): LocalDeficiency {
  const { codeReference, ...rest } = updates
  return {
    ...prev,
    ...rest,
    ...(codeReference !== undefined ? { codeReference: toLocalCodeReference(codeReference) } : {}),
    updatedAt: new Date().toISOString(),
  }
}

export interface UseDeficiencyMutationReturn {
  createDeficiency: ReturnType<
    typeof useMutation<LocalDeficiency, Error, CreateDeficiencyMutationInput>
  >
  updateDeficiency: ReturnType<
    typeof useMutation<LocalDeficiency, Error, UpdateDeficiencyMutationInput>
  >
  deleteDeficiency: ReturnType<typeof useMutation<void, Error, DeleteDeficiencyMutationInput>>
  issueStopWorkOrder: ReturnType<
    typeof useMutation<LocalDeficiency, Error, IssueStopWorkMutationInput>
  >
}

export function useDeficiencyMutation(): UseDeficiencyMutationReturn {
  const queryClient = useQueryClient()
  const networkStore = useNetworkStore()
  const authStore = useAuthStore()

  const createdById = () => authStore.user?.id ?? 'offline-user'

  const isOffline = () => isDeviceOffline(networkStore.isOnline)

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: deficiencyQueryKey })
  }

  const createDeficiency = useMutation({
    mutationFn: async (payload: CreateDeficiencyMutationInput): Promise<LocalDeficiency> => {
      const userId = createdById()
      if (isOffline()) {
        const localId = `offline-${payload.clientId}`
        const row = createLocalFromCreatePayload(payload, localId, userId)
        await db.deficiencies.put(row)
        await syncEngine.queueMutation('deficiency.create', { ...row }, syncPriorityFromLocal(row))
        return row
      }

      const optimisticId = `optimistic-${payload.clientId}`
      const optimistic = createLocalFromCreatePayload(payload, optimisticId, userId, {
        isDirty: true,
      })
      await db.deficiencies.put(optimistic)

      try {
        const res = await api.deficiencies.$post({ json: payload })
        if (!res.ok) {
          throw new Error(await readApiErrorMessage(res))
        }
        const dto = DeficiencyDTOSchema.parse(await res.json())
        await db.deficiencies.delete(optimisticId)
        const synced = dtoToLocal(dto, userId, {
          etag: etagFromResponse(res),
          isDirty: false,
          syncedAt: dto.updatedAt,
        })
        if (payload.checklistItemId) {
          synced.checklistItemId = payload.checklistItemId
        }
        await db.deficiencies.put(synced)
        return synced
      } catch (e) {
        await db.deficiencies.delete(optimisticId).catch(() => {})
        throw e
      }
    },
    onSettled: () => invalidate(),
  })

  const updateDeficiency = useMutation({
    mutationFn: async ({
      id,
      ifMatch,
      updates,
    }: UpdateDeficiencyMutationInput): Promise<LocalDeficiency> => {
      const userId = createdById()
      const prev = await db.deficiencies.get(id)
      if (!prev) {
        throw new Error(`Deficiency ${id} not found`)
      }

      if (isOffline()) {
        const merged = applyUpdates(prev, updates)
        const row: LocalDeficiency = { ...merged, isDirty: true }
        await db.deficiencies.put(row)
        await syncEngine.queueMutation('deficiency.update', { ...row }, syncPriorityFromLocal(row))
        return row
      }

      const optimistic = applyUpdates(prev, updates)
      const optimisticUpdatedAt = optimistic.updatedAt
      await db.deficiencies.put({ ...optimistic, isDirty: true })

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (ifMatch) {
        headers['If-Match'] = ifMatch.startsWith('"') ? ifMatch : `"${ifMatch}"`
      } else if (prev.etag) {
        headers['If-Match'] = `"${prev.etag}"`
      }

      try {
        const res = await apiFetch(`${apiPrefix()}/deficiencies/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(updates),
        })
        if (!res.ok) {
          throw new Error(await readApiErrorMessage(res))
        }
        const dto = DeficiencyDTOSchema.parse(await res.json())
        const synced = dtoToLocal(dto, userId, {
          etag: etagFromResponse(res) ?? prev.etag,
          isDirty: false,
          syncedAt: dto.updatedAt,
        })
        if (prev.checklistItemId) {
          synced.checklistItemId = prev.checklistItemId
        }
        await db.deficiencies.put(synced)
        return synced
      } catch (e) {
        const current = await db.deficiencies.get(id)
        if (current?.updatedAt === optimisticUpdatedAt) {
          await db.deficiencies.put(prev)
        }
        throw e
      }
    },
    onSettled: () => invalidate(),
  })

  const withNetworkTimeout = <T>(promise: Promise<T>, ms = 3_000): Promise<T> =>
    Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new TypeError('Failed to fetch')), ms)
      }),
    ])

  const queueOfflineStopWork = async (prev: LocalDeficiency): Promise<LocalDeficiency> => {
    const merged: LocalDeficiency = {
      ...prev,
      isStopWork: true,
      updatedAt: new Date().toISOString(),
      isDirty: true,
    }
    await db.deficiencies.put(merged)
    await syncEngine.queueMutation('deficiency.update', { ...merged }, 1)
    return merged
  }

  const issueStopWorkOrder = useMutation({
    // Run offline queue path even when Playwright / navigator reports offline (default networkMode pauses).
    networkMode: 'always',
    mutationFn: async ({ id }: IssueStopWorkMutationInput): Promise<LocalDeficiency> => {
      const userId = createdById()
      const prev = await db.deficiencies.get(id)
      if (!prev) {
        throw new Error(`Deficiency ${id} not found`)
      }
      if (prev.isStopWork) {
        return prev
      }

      if (isOffline()) {
        return queueOfflineStopWork(prev)
      }

      try {
        const stopRes = await withNetworkTimeout(
          apiFetch(`${apiPrefix()}/deficiencies/${encodeURIComponent(id)}/stop-work`, {
            method: 'POST',
          }),
        )
        if (!stopRes.ok) {
          throw new Error(await readApiErrorMessage(stopRes))
        }

        const getRes = await withNetworkTimeout(
          apiFetch(`${apiPrefix()}/deficiencies/${encodeURIComponent(id)}`),
        )
        if (!getRes.ok) {
          throw new Error(await readApiErrorMessage(getRes))
        }
        const dto = DeficiencyDTOSchema.parse(await getRes.json())
        const synced = dtoToLocal(dto, userId, {
          etag: etagFromResponse(getRes),
          isDirty: false,
          syncedAt: dto.updatedAt,
        })
        if (prev.checklistItemId) {
          synced.checklistItemId = prev.checklistItemId
        }
        await db.deficiencies.put(synced)
        return synced
      } catch (error) {
        if (isOffline() || isNetworkFailure(error)) {
          return queueOfflineStopWork(prev)
        }
        throw error
      }
    },
    onSettled: () => invalidate(),
  })

  const deleteDeficiency = useMutation({
    mutationFn: async ({ id }: DeleteDeficiencyMutationInput): Promise<void> => {
      const row = await db.deficiencies.get(id)
      if (!row) {
        throw new Error(`Deficiency ${id} not found`)
      }

      if (isOffline()) {
        await db.deficiencies.delete(id)
        if (row.syncedAt) {
          await syncEngine.queueMutation(
            'deficiency.delete',
            { clientId: row.clientId, id: row.id },
            syncPriorityFromLocal(row),
          )
        }
        return
      }

      await db.deficiencies.delete(id)
      try {
        const res = await apiFetch(`${apiPrefix()}/deficiencies/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        })
        if (!res.ok) {
          throw new Error(await readApiErrorMessage(res))
        }
      } catch (e) {
        if (!(await db.deficiencies.get(id))) {
          await db.deficiencies.put(row)
        }
        throw e
      }
    },
    onSettled: () => invalidate(),
  })

  return {
    createDeficiency,
    updateDeficiency,
    deleteDeficiency,
    issueStopWorkOrder,
  }
}
