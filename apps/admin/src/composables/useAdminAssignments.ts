import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'
import type {
  AdminAssignmentGridDTO,
  AdminCalendarWorkloadDTO,
  AssignmentDTO,
  InspectionListDTO,
  UserDTO,
} from '@codecomply/validators'
import { useAuthStore } from '../stores/auth'
import { api } from '@/api/client'
import { parseRpcJson } from '@/api/rpc-json'
import { readApiErrorMessage } from '@/api/typed-response'

export { isSessionExpiredRedirectError } from '../utils/admin-api-fetch'

export type AssignmentWeekRange = {
  from: string
  to: string
}

function toWeekRange(weekStartIso: string): AssignmentWeekRange {
  const start = new Date(`${weekStartIso}T00:00:00.000Z`)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)
  return {
    from: weekStartIso,
    to: end.toISOString().slice(0, 10),
  }
}

export function startOfWeekMondayIso(d = new Date()): string {
  const copy = new Date(d)
  const day = copy.getDay()
  const diff = (day + 6) % 7
  copy.setDate(copy.getDate() - diff)
  copy.setHours(0, 0, 0, 0)
  return copy.toISOString().slice(0, 10)
}

export async function fetchAssignmentGrid(
  range: AssignmentWeekRange,
): Promise<AdminAssignmentGridDTO> {
  const res = await api.admin.assignments.grid.$get({ query: range })
  return parseRpcJson(res, `Failed to load assignment grid (${res.status})`)
}

export async function fetchCalendarWorkload(
  from: string,
  to: string,
): Promise<AdminCalendarWorkloadDTO> {
  const res = await api.admin.assignments.calendar.$get({
    query: { from, to },
  })
  return parseRpcJson(res, `Failed to load workload calendar (${res.status})`)
}

export async function postAssignInspection(body: {
  inspectionId: string
  userId: string
  scheduledDate?: string
}): Promise<AssignmentDTO> {
  const res = await api.admin.assignments.$post({ json: body })
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res))
  }
  return res.json() as Promise<AssignmentDTO>
}

export async function postBulkAssignInspections(
  items: Array<{ inspectionId: string; userId: string }>,
): Promise<AssignmentDTO[]> {
  const res = await api.admin.assignments.bulk.$post({ json: { items } })
  return parseRpcJson(res, `Failed to bulk assign (${res.status})`)
}

export async function fetchInspectors(): Promise<UserDTO[]> {
  const res = await api.admin.users.$get({ query: { role: 'SCO', isActive: 'true' } })
  return parseRpcJson(res, `Failed to load inspectors (${res.status})`)
}

export async function fetchBulkInspections(): Promise<InspectionListDTO[]> {
  const res = await api.inspections.$get({
    query: { status: 'SCHEDULED', limit: '100' },
  })
  return parseRpcJson(res, `Failed to load inspections (${res.status})`)
}

export function useAssignmentGrid(weekStartIso: Ref<string>) {
  const auth = useAuthStore()
  const range = computed(() => toWeekRange(weekStartIso.value))

  return useQuery({
    queryKey: computed(() => ['admin', 'assignments', 'grid', range.value] as const),
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchAssignmentGrid(range.value)
    },
    enabled: computed(() => auth.isAuthenticated),
  })
}

export type CalendarWorkloadRange = {
  from: string
  to: string
}

export function defaultCalendarWorkloadRange(): CalendarWorkloadRange {
  const now = new Date()
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))
  return { from: from.toISOString(), to: to.toISOString() }
}

export function useCalendarWorkload(visibleRange: Ref<CalendarWorkloadRange>) {
  const auth = useAuthStore()

  return useQuery({
    queryKey: computed(() => ['admin', 'assignments', 'calendar', visibleRange.value] as const),
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchCalendarWorkload(visibleRange.value.from, visibleRange.value.to)
    },
    enabled: computed(() => auth.isAuthenticated),
  })
}

export function useBulkAssignmentData() {
  const auth = useAuthStore()

  const inspectorsQuery = useQuery({
    queryKey: ['admin', 'assignments', 'inspectors'] as const,
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchInspectors()
    },
    enabled: computed(() => auth.isAuthenticated),
  })

  const inspectionsQuery = useQuery({
    queryKey: ['admin', 'assignments', 'bulk-inspections'] as const,
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchBulkInspections()
    },
    enabled: computed(() => auth.isAuthenticated),
  })

  return { inspectorsQuery, inspectionsQuery }
}

export function useAssignInspectionMutation() {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: { inspectionId: string; userId: string; scheduledDate?: string }) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return postAssignInspection(body)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'assignments'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'permits'] })
    },
  })
}

export function useBulkAssignMutation() {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (items: Array<{ inspectionId: string; userId: string }>) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return postBulkAssignInspections(items)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'assignments'] })
    },
  })
}
