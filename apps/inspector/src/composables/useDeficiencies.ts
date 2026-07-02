/**
 * useDeficiencies — TanStack Query list + IndexedDB merge (online fetch, offline cache).
 *
 * @see M6-S6 - Create useDeficiencies Composable
 * @see testing-strategy.md §4.4 Frontend Composable Testing
 */

import { computed, toValue, type ComputedRef, type MaybeRefOrGetter, type Ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { DeficiencyDTOSchema, type DeficiencyDTO } from '@codecomply/validators'
import { useAuthStore } from '@/stores/auth'
import { useNetworkStore } from '@/stores/network'
import { db } from '@/lib/db/dexie'
import { apiFetch } from '@/utils/api-error-handler'
import { getApiBaseUrl } from '@/lib/api-base'
import type { LocalDeficiency, DeficiencySeverity, DeficiencyStatus } from '@/lib/db/types'
import { deficiencyQueryKey } from './useDeficiencyMutation'

/** List row type for consumers (local cache / server sync shape). */
export type Deficiency = LocalDeficiency

function apiPrefix(): string {
  const base = getApiBaseUrl()
  return base ? `${base}/api` : '/api'
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const j = JSON.parse(text) as { error?: string; message?: string }
    return j.message || j.error || text || `Request failed (${res.status})`
  } catch {
    return text || `Request failed (${res.status})`
  }
}

function dtoToLocal(dto: DeficiencyDTO, createdById: string): LocalDeficiency {
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
    codeReference: dto.codeReference,
    isStopWork: dto.isStopWork,
    isUnsafe: dto.isUnsafe,
    dueDate: dto.dueDate,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    isDirty: false,
    syncedAt: dto.updatedAt,
  }
}

/**
 * Prefer server rows, but keep dirty / pending-offline rows and locals missing from the server payload.
 */
export function mergeDeficiencyLists(
  server: LocalDeficiency[],
  local: LocalDeficiency[],
  inspectionId?: string,
): LocalDeficiency[] {
  const locals = inspectionId ? local.filter((l) => l.inspectionId === inspectionId) : [...local]

  const byId = new Map<string, LocalDeficiency>()

  for (const s of server) {
    byId.set(s.id, s)
  }

  for (const l of locals) {
    if (l.isDirty) {
      byId.set(l.id, l)
      continue
    }
    if (l.id.startsWith('offline-')) {
      byId.set(l.id, l)
      continue
    }
    if (!byId.has(l.id)) {
      byId.set(l.id, l)
    }
  }

  return [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

async function persistCleanServerRows(
  rows: LocalDeficiency[],
  localById: Map<string, LocalDeficiency>,
): Promise<void> {
  for (const row of rows) {
    const existing = localById.get(row.id)
    if (existing?.isDirty) continue
    const toStore: LocalDeficiency =
      existing?.checklistItemId && !row.checklistItemId
        ? { ...row, checklistItemId: existing.checklistItemId }
        : row
    await db.deficiencies.put(toStore)
  }
}

export interface UseDeficienciesOptions {
  /** When set, restricts merge + API query to this inspection. */
  inspectionId?: MaybeRefOrGetter<string | undefined>
}

export interface UseDeficienciesReturn {
  deficiencies: ComputedRef<Deficiency[]>
  openCount: ComputedRef<number>
  criticalCount: ComputedRef<number>
  isLoading: Ref<boolean>
  error: Ref<Error | null>
  refresh: () => Promise<void>
  filterByStatus: (status: DeficiencyStatus) => Deficiency[]
  filterBySeverity: (severity: DeficiencySeverity) => Deficiency[]
}

export function useDeficiencies(options: UseDeficienciesOptions = {}): UseDeficienciesReturn {
  const authStore = useAuthStore()
  const networkStore = useNetworkStore()

  const inspectionIdComputed = computed(() => toValue(options.inspectionId))

  const query = useQuery({
    queryKey: computed(() => [...deficiencyQueryKey, 'list', inspectionIdComputed.value ?? 'all']),
    queryFn: async (): Promise<LocalDeficiency[]> => {
      const userId = authStore.user?.id ?? 'offline-user'
      const inspId = inspectionIdComputed.value
      const allLocal = await db.deficiencies.toArray()
      const localById = new Map(allLocal.map((r) => [r.id, r]))

      if (!networkStore.isOnline) {
        return mergeDeficiencyLists([], allLocal, inspId)
      }

      const params = new URLSearchParams()
      if (inspId) params.set('inspectionId', inspId)

      const url = `${apiPrefix()}/deficiencies${params.size ? `?${params}` : ''}`
      const res = await apiFetch(url)
      if (!res.ok) {
        throw new Error(await readErrorMessage(res))
      }

      const dtos = DeficiencyDTOSchema.array().parse(await res.json())
      const serverMapped: LocalDeficiency[] = dtos.map((d) => {
        const base = dtoToLocal(d, userId)
        const existing = localById.get(d.id)
        if (existing?.checklistItemId && !base.checklistItemId) {
          return { ...base, checklistItemId: existing.checklistItemId }
        }
        return base
      })

      await persistCleanServerRows(serverMapped, localById)
      return mergeDeficiencyLists(serverMapped, allLocal, inspId)
    },
  })

  const deficiencies = computed(() => query.data.value ?? [])

  const openCount = computed(() => deficiencies.value.filter((d) => d.status === 'OPEN').length)

  const criticalCount = computed(
    () => deficiencies.value.filter((d) => d.severity === 'CRITICAL').length,
  )

  const filterByStatus = (status: DeficiencyStatus) =>
    deficiencies.value.filter((d) => d.status === status)

  const filterBySeverity = (severity: DeficiencySeverity) =>
    deficiencies.value.filter((d) => d.severity === severity)

  return {
    deficiencies,
    openCount,
    criticalCount,
    isLoading: query.isPending,
    error: query.error,
    refresh: () => query.refetch().then(() => undefined),
    filterByStatus,
    filterBySeverity,
  }
}
