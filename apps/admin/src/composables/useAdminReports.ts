import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'
import type {
  DeficiencyDTO,
  DistributeReportDTO,
  GenerateReportDTO,
  InspectionListDTO,
  InspectionStatus,
  ReportDTO,
  ReportDistributionResultDTO,
  ReportDownloadUrlDTO,
  ReportTypeDTO,
} from '@codecomply/validators'
import { useAuthStore } from '../stores/auth'
import { api } from '@/api/client'
import { parseRpcJson } from '@/api/rpc-json'
import { readApiErrorMessage } from '@/api/typed-response'

export { isSessionExpiredRedirectError } from '../utils/admin-api-fetch'

export type ReportTypeOption = {
  label: string
  value: ReportTypeDTO
  needsDeficiency?: boolean
  /** When set, only deficiencies flagged stop work / unsafe are listed. */
  stopWorkOnly?: boolean
  disabled?: boolean
  disabledReason?: string
}

/** Story report types mapped to API `ReportTypeDTO` (M10-S15). */
export const ADMIN_REPORT_TYPE_OPTIONS: ReportTypeOption[] = [
  { label: 'Inspection Report', value: 'INSPECTION' },
  { label: 'Deficiency Report', value: 'DEFICIENCY', needsDeficiency: true },
  { label: 'No Entry Letter', value: 'NO_ENTRY' },
  { label: 'Stop Work Order', value: 'STOP_WORK', needsDeficiency: true, stopWorkOnly: true },
]

export function reportTypeLabel(type: ReportTypeDTO): string {
  return ADMIN_REPORT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type
}

export async function fetchAdminInspections(filters: {
  status?: InspectionStatus
  limit?: number
}): Promise<InspectionListDTO[]> {
  const res = await api.inspections.$get({
    query: {
      status: filters.status,
      limit: String(filters.limit ?? 100),
    },
  })
  return parseRpcJson(res, `Failed to load inspections (${res.status})`)
}

export async function fetchInspectionDeficiencies(inspectionId: string): Promise<DeficiencyDTO[]> {
  const res = await api.deficiencies.$get({ query: { inspectionId } })
  return parseRpcJson(res, `Failed to load deficiencies (${res.status})`)
}

export async function fetchInspectionReports(inspectionId: string): Promise<ReportDTO[]> {
  const res = await api.inspections[':id'].reports.$get({ param: { id: inspectionId } })
  return parseRpcJson(res, `Failed to load reports (${res.status})`)
}

export async function postGenerateReport(body: GenerateReportDTO): Promise<ReportDTO> {
  const res = await api.reports.generate.$post({ json: body })
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res))
  }
  return res.json() as Promise<ReportDTO>
}

export async function fetchReportDownloadUrl(reportId: string): Promise<ReportDownloadUrlDTO> {
  const res = await api.reports[':id'].download.$get({
    param: { id: reportId },
    query: { format: 'pdf' },
  })
  return parseRpcJson(res, `Failed to get download URL (${res.status})`)
}

export type ReportDistributionContacts = {
  ownerEmail: string
  contractorEmail: string
  inspectorEmail?: string
}

export async function fetchReportDistributionContacts(
  inspectionId: string,
): Promise<ReportDistributionContacts> {
  const res = await api.admin.reports.contacts[':inspectionId'].$get({
    param: { inspectionId },
  })
  return parseRpcJson(res, `Failed to load distribution contacts (${res.status})`)
}

export async function postDistributeReport(
  body: DistributeReportDTO,
): Promise<ReportDistributionResultDTO> {
  const res = await api.admin.reports.distribute.$post({ json: body })
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res))
  }
  return res.json() as Promise<ReportDistributionResultDTO>
}

export function useAdminInspectionsForReports(statusFilter: Ref<InspectionStatus>) {
  const auth = useAuthStore()

  return useQuery({
    queryKey: computed(() => ['admin', 'reports', 'inspections', statusFilter.value] as const),
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchAdminInspections({ status: statusFilter.value, limit: 100 })
    },
    enabled: computed(() => auth.isAuthenticated),
  })
}

export function useInspectionDeficienciesForReports(inspectionId: Ref<string>) {
  const auth = useAuthStore()

  return useQuery({
    queryKey: computed(() => ['admin', 'reports', 'deficiencies', inspectionId.value] as const),
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchInspectionDeficiencies(inspectionId.value)
    },
    enabled: computed(() => auth.isAuthenticated && !!inspectionId.value),
  })
}

export function useInspectionReportHistory(inspectionId: Ref<string>) {
  const auth = useAuthStore()

  return useQuery({
    queryKey: computed(() => ['admin', 'reports', 'history', inspectionId.value] as const),
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchInspectionReports(inspectionId.value)
    },
    enabled: computed(() => auth.isAuthenticated && !!inspectionId.value),
  })
}

export function useGenerateReportMutation(inspectionId: Ref<string>) {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: GenerateReportDTO) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return postGenerateReport(body)
    },
    onSuccess: () => {
      if (inspectionId.value) {
        void queryClient.invalidateQueries({
          queryKey: ['admin', 'reports', 'history', inspectionId.value],
        })
      }
    },
  })
}

export function useReportDownloadMutation() {
  const auth = useAuthStore()

  return useMutation({
    mutationFn: async (reportId: string) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchReportDownloadUrl(reportId)
    },
  })
}

export function useReportDistributionContacts(inspectionId: Ref<string>) {
  const auth = useAuthStore()

  return useQuery({
    queryKey: computed(() => ['admin', 'reports', 'contacts', inspectionId.value] as const),
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchReportDistributionContacts(inspectionId.value)
    },
    enabled: computed(() => auth.isAuthenticated && !!inspectionId.value),
  })
}

export function useDistributeReportMutation(inspectionId: Ref<string>) {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: DistributeReportDTO) => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return postDistributeReport(body)
    },
    onSuccess: () => {
      if (inspectionId.value) {
        void queryClient.invalidateQueries({
          queryKey: ['admin', 'reports', 'history', inspectionId.value],
        })
      }
    },
  })
}
