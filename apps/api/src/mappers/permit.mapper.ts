import type { Permit, PermitInspection } from '@codecomply/db'
import type { PermitDTO, PermitListDTO, PermitTriageSummary } from '@codecomply/validators'
import { primaryInspectionStageLabel } from '@codecomply/validators'
import type { InspectionStageDTO } from '@codecomply/validators'

/**
 * Permit Mapper
 *
 * Transforms Prisma Permit entities to DTOs.
 * Isolates database schema changes from API consumers.
 *
 * Responsibilities:
 * - Entity → DTO transformation
 * - Field mapping and formatting
 * - Null/undefined handling
 */
export class PermitMapper {
  private static workflowStages(
    workflow?: { stages: string[] } | null,
  ): InspectionStageDTO[] | undefined {
    if (!workflow?.stages?.length) return undefined
    return workflow.stages as InspectionStageDTO[]
  }

  private static nextScheduledInspection(
    inspections?: Array<
      PermitInspection & {
        workflow?: { stages: string[] } | null
      }
    >,
  ) {
    return inspections
      ?.filter((i) => i.status === 'SCHEDULED')
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())[0]
  }
  /**
   * Map Permit entity to full PermitDTO
   *
   * @param entity - Prisma Permit entity
   * @returns PermitDTO
   */
  static toDTO(
    entity: Permit & {
      inspections?: Array<
        PermitInspection & {
          schedule?: {
            assignedTo?: {
              id: string
              name: string
            }
          } | null
          workflow?: { stages: string[] } | null
          checklistExecutions?: Array<{
            id: string
            completedAt: Date | null
          }>
        }
      >
    },
  ): PermitDTO {
    return {
      id: entity.id,
      permitNumber: entity.permitNumber,
      address: entity.address,
      legalLandDesc: entity.legalLandDesc || undefined,
      scope: entity.scope,
      status: entity.status,
      latitude: entity.latitude || undefined,
      longitude: entity.longitude || undefined,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      inspectionStageLabel: primaryInspectionStageLabel(
        this.workflowStages(this.nextScheduledInspection(entity.inspections)?.workflow),
      ),
      inspections: entity.inspections?.map((inspection) => ({
        id: inspection.id,
        status: inspection.status,
        scheduledDate: inspection.scheduledDate.toISOString(),
        completedDate: inspection.completedDate?.toISOString(),
        assignedInspectorName: inspection.schedule?.assignedTo?.name,
        stages: this.workflowStages(inspection.workflow),
        checklistExecutions: inspection.checklistExecutions?.map((ex) => ({
          id: ex.id,
          completedAt: ex.completedAt ? ex.completedAt.toISOString() : null,
        })),
      })),
    }
  }

  /**
   * Map Permit entity to minimal PermitListDTO
   *
   * Optimized for list views with minimal data.
   *
   * @param entity - Prisma Permit entity
   * @param distance - Optional distance in meters from current location
   * @returns PermitListDTO
   */
  static toListDTO(
    entity: Permit & {
      inspections?: Array<
        PermitInspection & {
          workflow?: { stages: string[] } | null
        }
      >
    },
    distance?: number,
    triage?: PermitTriageSummary,
  ): PermitListDTO {
    const nextInspection = this.nextScheduledInspection(entity.inspections)

    return {
      id: entity.id,
      permitNumber: entity.permitNumber,
      address: entity.address,
      legalLandDesc: entity.legalLandDesc || undefined,
      status: entity.status,
      nextInspectionDate: nextInspection?.scheduledDate.toISOString(),
      inspectionStageLabel: primaryInspectionStageLabel(
        this.workflowStages(nextInspection?.workflow),
      ),
      distance,
      triage,
    }
  }

  /**
   * Map array of Permit entities to PermitDTOs
   *
   * @param entities - Array of Prisma Permit entities
   * @returns Array of PermitDTOs
   */
  static toDTOs(
    entities: Array<
      Permit & {
        inspections?: Array<
          PermitInspection & {
            schedule?: {
              assignedTo?: {
                id: string
                name: string
              }
            } | null
            checklistExecutions?: Array<{
              id: string
              completedAt: Date | null
            }>
          }
        >
      }
    >,
  ): PermitDTO[] {
    return entities.map((entity) => this.toDTO(entity))
  }

  /**
   * Map array of Permit entities to PermitListDTOs
   *
   * @param entities - Array of Prisma Permit entities
   * @returns Array of PermitListDTOs
   */
  static toListDTOs(
    entities: Array<
      Permit & {
        inspections?: Array<PermitInspection>
        distance?: number
      }
    >,
    triageByPermitId?: Map<string, PermitTriageSummary>,
  ): PermitListDTO[] {
    return entities.map((entity) =>
      this.toListDTO(entity, entity.distance, triageByPermitId?.get(entity.id)),
    )
  }
}
