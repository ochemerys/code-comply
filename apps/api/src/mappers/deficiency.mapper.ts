import type { Deficiency } from '@codecomply/db'
import type { CodeReferenceDTO, DeficiencyDTO } from '@codecomply/validators'

/**
 * Maps Prisma deficiency rows to public API DTOs.
 */
export class DeficiencyMapper {
  static toDTO(entity: Deficiency): DeficiencyDTO {
    const ref = entity.codeReference
    let codeReference: CodeReferenceDTO | undefined
    if (
      ref &&
      typeof ref === 'object' &&
      !Array.isArray(ref) &&
      'code' in ref &&
      'section' in ref
    ) {
      const o = ref as Record<string, unknown>
      codeReference = {
        id: typeof o.id === 'string' ? o.id : undefined,
        code: String(o.code),
        section: String(o.section),
        title: typeof o.title === 'string' ? o.title : undefined,
      }
    }

    return {
      id: entity.id,
      clientId: entity.clientId,
      inspectionId: entity.inspectionId,
      checklistItemId: entity.checklistItemId ?? undefined,
      description: entity.description,
      location: entity.location ?? undefined,
      severity: entity.severity,
      status: entity.status,
      codeReference,
      isStopWork: entity.isStopWork,
      isUnsafe: entity.isUnsafe,
      dueDate: entity.dueDate?.toISOString(),
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    }
  }

  static toDTOs(entities: Deficiency[]): DeficiencyDTO[] {
    return entities.map((e) => this.toDTO(e))
  }
}
