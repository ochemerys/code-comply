import type { PermitInspection, Permit, Deficiency } from '@codecomply/db'
import type { InspectionDTO, InspectionListDTO } from '@codecomply/validators'

/**
 * Inspection Mapper
 *
 * Transforms Prisma PermitInspection entities to DTOs.
 * Isolates database schema changes from API consumers.
 *
 * Responsibilities:
 * - Entity → DTO transformation
 * - Field mapping and formatting
 * - Null/undefined handling
 */
export class InspectionMapper {
  /**
   * Map PermitInspection entity to full InspectionDTO
   *
   * @param entity - Prisma PermitInspection entity
   * @returns InspectionDTO
   */
  static toDTO(
    entity: PermitInspection & {
      permit?: Permit | null
      schedule?: {
        assignedTo?: {
          id: string
          name: string
        }
      } | null
      deficiencies?: Deficiency[]
    },
  ): InspectionDTO {
    return {
      id: entity.id,
      permitId: entity.permitId || '',
      status: entity.status,
      scheduledDate: entity.scheduledDate.toISOString(),
      completedDate: entity.completedDate?.toISOString(),
      notes: entity.notes || undefined,
      assignedInspectorId: entity.schedule?.assignedTo?.id,
      assignedInspectorName: entity.schedule?.assignedTo?.name,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    }
  }

  /**
   * Map PermitInspection entity to minimal InspectionListDTO
   *
   * Optimized for list views with minimal data.
   *
   * @param entity - Prisma PermitInspection entity
   * @returns InspectionListDTO
   */
  static toListDTO(
    entity: PermitInspection & {
      permit?: Permit | null
      schedule?: {
        assignedTo?: {
          id: string
          name: string
        }
      } | null
    },
  ): InspectionListDTO {
    return {
      id: entity.id,
      permitId: entity.permitId || '',
      permitNumber: entity.permit?.permitNumber || 'N/A',
      address: entity.permit?.address || 'N/A',
      status: entity.status,
      scheduledDate: entity.scheduledDate.toISOString(),
      assignedInspectorName: entity.schedule?.assignedTo?.name,
    }
  }

  /**
   * Map array of PermitInspection entities to InspectionDTOs
   *
   * @param entities - Array of Prisma PermitInspection entities
   * @returns Array of InspectionDTOs
   */
  static toDTOs(
    entities: Array<
      PermitInspection & {
        permit?: Permit | null
        schedule?: {
          assignedTo?: {
            id: string
            name: string
          }
        } | null
        deficiencies?: Deficiency[]
      }
    >,
  ): InspectionDTO[] {
    return entities.map((entity) => this.toDTO(entity))
  }

  /**
   * Map array of PermitInspection entities to InspectionListDTOs
   *
   * @param entities - Array of Prisma PermitInspection entities
   * @returns Array of InspectionListDTOs
   */
  static toListDTOs(
    entities: Array<
      PermitInspection & {
        permit?: Permit | null
        schedule?: {
          assignedTo?: {
            id: string
            name: string
          }
        } | null
      }
    >,
  ): InspectionListDTO[] {
    return entities.map((entity) => this.toListDTO(entity))
  }
}
