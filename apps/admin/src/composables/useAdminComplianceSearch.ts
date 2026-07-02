import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'
import type { ComplianceSearchQuery, ComplianceSearchResponse } from '@codecomply/validators'
import { useAuthStore } from '../stores/auth'
import { api } from '@/api/client'
import { parseRpcJson } from '@/api/rpc-json'

export {
  SessionExpiredRedirectError,
  isSessionExpiredRedirectError,
} from '../utils/admin-api-fetch'

export type ComplianceSearchCriteria = {
  legalLandDescription: string
  dateFrom: string
  dateTo: string
  inspectorId: string
  permitNumber: string
  status: ComplianceSearchQuery['status'] | ''
  outcome: ComplianceSearchQuery['outcome'] | ''
}

export const EMPTY_COMPLIANCE_SEARCH_CRITERIA: ComplianceSearchCriteria = {
  legalLandDescription: '',
  dateFrom: '',
  dateTo: '',
  inspectorId: '',
  permitNumber: '',
  status: '',
  outcome: '',
}

function criteriaToQuery(criteria: ComplianceSearchCriteria): ComplianceSearchQuery {
  const query: ComplianceSearchQuery = { limit: 100, offset: 0 }
  const land = criteria.legalLandDescription.trim()
  const from = criteria.dateFrom.trim()
  const to = criteria.dateTo.trim()
  const inspector = criteria.inspectorId.trim()
  const permit = criteria.permitNumber.trim()

  if (land) query.legalLandDescription = land
  if (from) query.dateFrom = from
  if (to) query.dateTo = to
  if (inspector) query.inspectorId = inspector
  if (permit) query.permitNumber = permit
  if (criteria.status) query.status = criteria.status
  if (criteria.outcome) query.outcome = criteria.outcome

  return query
}

export async function fetchComplianceSearch(
  criteria: ComplianceSearchCriteria,
): Promise<ComplianceSearchResponse> {
  const query = criteriaToQuery(criteria)
  const res = await api.admin['compliance-search'].$get({
    query: {
      legalLandDescription: query.legalLandDescription,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      inspectorId: query.inspectorId,
      permitNumber: query.permitNumber,
      status: query.status,
      outcome: query.outcome,
      limit: String(query.limit),
      offset: String(query.offset),
    },
  })
  return parseRpcJson(res, `Compliance search failed (${res.status})`)
}

export function exportComplianceResultsCsv(
  results: ComplianceSearchResponse['results'],
  filename = 'compliance-search-export.csv',
): void {
  const headers = [
    'Inspection ID',
    'Permit Number',
    'Legal Land Description',
    'Address',
    'Status',
    'Scheduled Date',
    'Completed Date',
    'Finalized At',
    'Inspector',
    'Deficiency Count',
  ]

  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`

  const rows = results.map((row) =>
    [
      row.inspectionId,
      row.permitNumber,
      row.legalLandDescription ?? '',
      row.address,
      row.status,
      row.scheduledDate,
      row.completedDate ?? '',
      row.finalizedAt ?? '',
      row.inspectorName ?? '',
      String(row.deficiencyCount),
    ]
      .map(escape)
      .join(','),
  )

  const csv = [headers.map(escape).join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

export function useComplianceSearch(
  criteria: Ref<ComplianceSearchCriteria>,
  enabled: Ref<boolean>,
) {
  const auth = useAuthStore()

  const queryKey = computed(() => ['admin', 'compliance-search', { ...criteria.value }] as const)

  return useQuery({
    queryKey,
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchComplianceSearch(criteria.value)
    },
    enabled: computed(() => auth.isAuthenticated && enabled.value),
    placeholderData: keepPreviousData,
  })
}

export async function fetchAdminInspectorsForSearch(): Promise<
  Array<{ id: string; name: string }>
> {
  const res = await api.admin.users.$get({
    query: { role: 'SCO', isActive: 'true' },
  })
  const users = await parseRpcJson<Array<{ id: string; name: string }>>(
    res,
    `Failed to load inspectors (${res.status})`,
  )
  return users.map((u) => ({ id: u.id, name: u.name }))
}

export function useAdminInspectorsForSearch() {
  const auth = useAuthStore()

  return useQuery({
    queryKey: ['admin', 'inspectors-for-search'] as const,
    queryFn: () => {
      if (!auth.isAuthenticated) throw new Error('Not authenticated')
      return fetchAdminInspectorsForSearch()
    },
    enabled: computed(() => auth.isAuthenticated),
    staleTime: 60_000,
  })
}
