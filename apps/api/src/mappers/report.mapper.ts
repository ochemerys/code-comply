import type { ReportDTO } from '@codecomply/validators'
import type { Report } from '@codecomply/db'
import { buildReportVerifyUrl, formatUniqueReportId } from '../lib/report-verify.js'

export type ReportMapperExtras = {
  inspectionUniqueId?: string | null
}

export const ReportMapper = {
  toDTO(row: Report, extras?: ReportMapperExtras): ReportDTO {
    const uniqueReportId = formatUniqueReportId(extras?.inspectionUniqueId, row.id)
    return {
      id: row.id,
      inspectionId: row.inspectionId,
      type: row.type,
      filename: row.filename,
      storageKey: row.storageKey,
      hash: row.hash,
      generatedAt: row.generatedAt.toISOString(),
      distributedAt: row.distributedAt?.toISOString() ?? null,
      signedAt: row.signedAt?.toISOString() ?? null,
      uniqueReportId,
      verifyUrl: buildReportVerifyUrl(row.id, row.hash),
    }
  },

  toDTOs(rows: Report[], extras?: ReportMapperExtras): ReportDTO[] {
    return rows.map((r) => ReportMapper.toDTO(r, extras))
  },
}
