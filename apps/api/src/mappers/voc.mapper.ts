import type { VoCDTO } from '@codecomply/validators'
import type { VoC } from '../services/voc.service.js'

export const VoCMapper = {
  toDTO(row: VoC): VoCDTO {
    return {
      id: row.id,
      deficiencyId: row.deficiencyId,
      verificationDate: row.verificationDate.toISOString(),
      sectionTitle: row.sectionTitle,
      title: row.title,
      name: row.name,
      method: row.method,
      comments: row.comments,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      reviewedById: row.reviewedById,
      status: row.status,
    }
  },

  toDTOs(rows: VoC[]): VoCDTO[] {
    return rows.map((r) => VoCMapper.toDTO(r))
  },
}
