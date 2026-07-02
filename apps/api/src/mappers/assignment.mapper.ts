import type { InspectionSchedule } from '@codecomply/db'
import type { AssignmentDTO } from '@codecomply/validators'

export class AssignmentMapper {
  static toDTO(row: InspectionSchedule): AssignmentDTO {
    return {
      id: row.id,
      inspectionId: row.inspectionId,
      assignedToId: row.assignedToId,
      assignedDate: row.assignedDate.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }
  }

  static toDTOs(rows: InspectionSchedule[]): AssignmentDTO[] {
    return rows.map((r) => AssignmentMapper.toDTO(r))
  }
}
