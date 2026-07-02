import {
  INSPECTION_STAGE_LABELS,
  type InspectionStageDTO,
} from './admin-inspection-workflow.dto.js'

/** Human-readable labels for one or more workflow stages (e.g. "Foundation"). */
export function formatInspectionStageLabels(stages: InspectionStageDTO[]): string {
  return stages.map((stage) => INSPECTION_STAGE_LABELS[stage]).join(', ')
}

/** Primary stage label for list/detail when stages exist; undefined when empty. */
export function primaryInspectionStageLabel(
  stages: InspectionStageDTO[] | undefined | null,
): string | undefined {
  if (!stages?.length) return undefined
  return formatInspectionStageLabels(stages)
}
