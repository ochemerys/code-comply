import { ref, watch, type Ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { handleApiError } from '@/utils/api-error-handler'
import { db } from '@/lib/db'
import type { PermitDTO } from '@codecomply/validators'
import type { LocalPermit, LocalInspection } from '@/lib/db/types'
import { getApiBaseUrl } from '@/lib/api-base'

/**
 * Inspection item as returned by API permit detail or built from local inspections.
 */
export interface PermitDetailInspection {
  id: string
  status: string
  scheduledDate: string
  completedDate?: string
  assignedInspectorName?: string
  stages?: Array<'FOUNDATION' | 'FRAMING' | 'ROUGH_IN' | 'INSULATION' | 'FINAL' | 'OTHER'>
  /** From API permit detail; omitted for purely local/offline rows */
  checklistExecutions?: Array<{ id: string; completedAt?: string | null }>
}

/**
 * Permit detail composable (M4-S11).
 * Fetches full permit from API when online; falls back to cached permit + local inspections when offline.
 */
export interface UsePermitDetailReturn {
  permit: Ref<PermitDTO | null>
  isLoading: Ref<boolean>
  error: Ref<Error | null>
  isOffline: Ref<boolean>
  refresh: () => Promise<void>
}

function localPermitToDTO(p: LocalPermit, inspections?: PermitDetailInspection[]): PermitDTO {
  return {
    id: p.id,
    permitNumber: p.permitNumber,
    address: p.address,
    legalLandDesc: p.legalLandDesc,
    scope: '—',
    status: p.status,
    latitude: undefined,
    longitude: undefined,
    createdAt: '',
    updatedAt: p.updatedAt,
    inspectionStageLabel: p.inspectionStageLabel,
    inspections,
  }
}

function localInspectionToDetail(i: LocalInspection): PermitDetailInspection {
  return {
    id: i.id,
    status: i.status,
    scheduledDate: i.scheduledDate,
    completedDate: i.completedDate,
    assignedInspectorName: undefined,
  }
}

export function usePermitDetail(permitId: Ref<string | undefined>): UsePermitDetailReturn {
  const permit = ref<PermitDTO | null>(null)
  const isLoading = ref(true)
  const error = ref<Error | null>(null)
  const isOffline = ref(false)
  const authStore = useAuthStore()

  async function loadFromApi(id: string): Promise<PermitDTO | null> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (authStore.accessToken) {
      headers['Authorization'] = `Bearer ${authStore.accessToken}`
    }
    const base = getApiBaseUrl()
    const prefix = base ? `${base}/api` : '/api'
    const res = await fetch(`${prefix}/permits/${id}`, { method: 'GET', headers })
    if (res.status === 401) {
      await handleApiError(res)
      throw new Error('Unauthorized - please log in')
    }
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Failed to load permit: ${res.status}`)
    return res.json() as Promise<PermitDTO>
  }

  async function loadFromCache(id: string): Promise<PermitDTO | null> {
    const local = await db.permits.get(id)
    if (!local) return null
    const inspections = await db.inspections.where('permitId').equals(id).toArray()
    const schedule: PermitDetailInspection[] = inspections
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
      .map(localInspectionToDetail)
    return localPermitToDTO(local, schedule)
  }

  async function refresh(): Promise<void> {
    const id = permitId.value
    if (!id) {
      permit.value = null
      isLoading.value = false
      return
    }
    isLoading.value = true
    error.value = null
    isOffline.value = false
    try {
      if (navigator.onLine) {
        try {
          const data = await loadFromApi(id)
          // If API returns null (404), try cache before giving up
          if (data === null) {
            const cached = await loadFromCache(id)
            if (cached) {
              isOffline.value = true
              permit.value = cached
            } else {
              permit.value = null
            }
          } else {
            permit.value = data
          }
        } catch (e) {
          // Network error or other API error - try cache
          isOffline.value = true
          permit.value = await loadFromCache(id)
          if (!permit.value) throw e
        }
      } else {
        isOffline.value = true
        permit.value = await loadFromCache(id)
      }
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
      permit.value = null
    } finally {
      isLoading.value = false
    }
  }

  watch(
    permitId,
    (id) => {
      if (id) refresh()
      else {
        permit.value = null
        isLoading.value = false
        error.value = null
      }
    },
    { immediate: true },
  )

  return {
    permit,
    isLoading,
    error,
    isOffline,
    refresh,
  }
}
