import type { PermitInspection } from '@codecomply/db'
import type { ComplianceSearchResultDTO } from '@codecomply/validators'

type InspectionWithRelations = PermitInspection & {
  permit: {
    permitNumber: string
    address: string
    legalLandDesc: string | null
  } | null
  schedule: {
    assignedTo: { id: string; name: string } | null
  } | null
  inspector: { id: string; name: string } | null
  deficiencies: Array<{ id: string }>
}

export class ComplianceSearchMapper {
  static toResultDTO(row: InspectionWithRelations): ComplianceSearchResultDTO {
    const assigned = row.schedule?.assignedTo
    const finalized = row.inspector
    const inspectorId = finalized?.id ?? assigned?.id
    const inspectorName = finalized?.name ?? assigned?.name

    return {
      inspectionId: row.id,
      permitNumber: row.permit?.permitNumber ?? '',
      legalLandDescription: row.permit?.legalLandDesc ?? undefined,
      address: row.permit?.address ?? '',
      status: row.status as ComplianceSearchResultDTO['status'],
      scheduledDate: row.scheduledDate.toISOString(),
      completedDate: row.completedDate?.toISOString(),
      finalizedAt: row.finalizedAt?.toISOString(),
      inspectorId,
      inspectorName,
      deficiencyCount: row.deficiencies.length,
      hasCertificationSnapshot: row.certificationSnapshot != null,
    }
  }

  static toResultDTOs(rows: InspectionWithRelations[]): ComplianceSearchResultDTO[] {
    return rows.map((row) => ComplianceSearchMapper.toResultDTO(row))
  }
}
