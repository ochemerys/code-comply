import type { InspectionStatus } from '@codecomply/validators'

export const ADMIN_REPORTS_SELECTION_STORAGE_KEY = 'admin_reports_selection'

export type AdminReportsSelectionSnapshot = {
  userId: string
  inspectionId: string
  inspectionStatusFilter: InspectionStatus
}

const INSPECTION_STATUSES: InspectionStatus[] = ['IN_PROGRESS', 'SCHEDULED', 'PASSED', 'FAILED']

function isInspectionStatus(value: unknown): value is InspectionStatus {
  return typeof value === 'string' && INSPECTION_STATUSES.includes(value as InspectionStatus)
}

export function loadAdminReportsSelection(
  userId: string | undefined,
): AdminReportsSelectionSnapshot | null {
  if (!userId || typeof localStorage === 'undefined') return null

  try {
    const raw = localStorage.getItem(ADMIN_REPORTS_SELECTION_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<AdminReportsSelectionSnapshot>
    if (parsed.userId !== userId) return null
    if (typeof parsed.inspectionId !== 'string' || !parsed.inspectionId) return null
    if (!isInspectionStatus(parsed.inspectionStatusFilter)) return null

    return {
      userId: parsed.userId,
      inspectionId: parsed.inspectionId,
      inspectionStatusFilter: parsed.inspectionStatusFilter,
    }
  } catch {
    return null
  }
}

export function saveAdminReportsSelection(snapshot: AdminReportsSelectionSnapshot): void {
  if (typeof localStorage === 'undefined') return
  if (!snapshot.userId || !snapshot.inspectionId) return

  localStorage.setItem(ADMIN_REPORTS_SELECTION_STORAGE_KEY, JSON.stringify(snapshot))
}

export function clearAdminReportsSelection(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(ADMIN_REPORTS_SELECTION_STORAGE_KEY)
}
