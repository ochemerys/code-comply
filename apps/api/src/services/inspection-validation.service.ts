import { prisma } from '@codecomply/db'
import type { Prisma } from '@codecomply/db'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationError {
  code: string
  field: string
  message: string
}

export interface ValidationWarning {
  code: string
  field: string
  message: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

/**
 * Shape of a single stored checklist response (parsed from JSON).
 * Mirrors the `StoredResponse` used by ChecklistService.
 */
interface StoredResponse {
  itemId: string
  result: 'PASS' | 'FAIL' | 'NA'
  codeReference?: { code: string; section: string }
  notes?: string
  timestamp: string
}

interface TemplateItem {
  id?: unknown
  required?: boolean
  requiresPhoto?: boolean
  [key: string]: unknown
}

/**
 * The hydrated inspection payload that `validate()` operates on.
 * Fetched internally via `loadInspection()`.
 */
interface InspectionData {
  id: string
  status: string
  notes: string | null
  checklistExecutions: Array<{
    id: string
    responses: Prisma.JsonValue
    template: {
      id: string
      items: Prisma.JsonValue
    }
  }>
  deficiencies: Array<{
    id: string
    checklistItemId: string | null
    photos: Array<{ id: string }>
  }>
  photos: Array<{
    id: string
    deficiencyId: string | null
  }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseTemplateItems(itemsJson: Prisma.JsonValue): TemplateItem[] {
  if (!Array.isArray(itemsJson)) return []
  return itemsJson as TemplateItem[]
}

function templateItemIds(items: TemplateItem[]): string[] {
  return items
    .map((i) => i.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
}

function parseResponses(raw: Prisma.JsonValue | null | undefined): StoredResponse[] {
  if (raw == null) return []
  if (!Array.isArray(raw)) return []
  const out: StoredResponse[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    if (typeof r.itemId !== 'string') continue
    if (r.result !== 'PASS' && r.result !== 'FAIL' && r.result !== 'NA') continue
    out.push({
      itemId: r.itemId,
      result: r.result as StoredResponse['result'],
      codeReference: r.codeReference as StoredResponse['codeReference'],
      notes: typeof r.notes === 'string' ? r.notes : undefined,
      timestamp: typeof r.timestamp === 'string' ? r.timestamp : '',
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * InspectionValidationService
 *
 * Validates an inspection for submission readiness (M8-S1 / M-06 Finalization).
 *
 * Validation rules:
 *  1. All required checklist items must be answered
 *  2. Failed items with `requiresPhoto` flag must have at least one photo
 *  3. Outcome must be selected (inspection status is PASSED or FAILED)
 *  4. Digital signature must be captured (stored in notes field as marker)
 *  5. GPS coordinates must be captured at finalization (stored in notes)
 */
export class InspectionValidationService {
  /**
   * Validate a full inspection for submission readiness.
   *
   * @param inspectionId - The ID of the inspection to validate
   * @returns ValidationResult indicating whether the inspection is ready for submission
   */
  async validate(inspectionId: string): Promise<ValidationResult> {
    const inspection = await this.loadInspection(inspectionId)

    if (!inspection) {
      return {
        isValid: false,
        errors: [
          {
            code: 'INSPECTION_NOT_FOUND',
            field: 'inspectionId',
            message: 'Inspection not found',
          },
        ],
        warnings: [],
      }
    }

    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    this.validateAllItemsAnswered(inspection, errors, warnings)
    this.validateRequiredPhotos(inspection, errors, warnings)
    this.validateOutcomeSelected(inspection, errors)
    this.validateSignaturePresent(inspection, errors)
    this.validateGPSCaptured(inspection, errors, warnings)

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Validate an inspection for finalization when some required artifacts are provided
   * as part of the finalize request body (e.g. outcome/signature/GPS) but may not yet
   * be persisted in the inspection record.
   */
  async validateForFinalize(
    inspectionId: string,
    input: {
      outcome?: 'PASSED' | 'FAILED'
      signature?: string | null
      gpsCaptured?: boolean
    },
  ): Promise<ValidationResult> {
    const inspection = await this.loadInspection(inspectionId)

    if (!inspection) {
      return {
        isValid: false,
        errors: [
          {
            code: 'INSPECTION_NOT_FOUND',
            field: 'inspectionId',
            message: 'Inspection not found',
          },
        ],
        warnings: [],
      }
    }

    const derived: InspectionData = {
      ...inspection,
      status: input.outcome ?? inspection.status,
      notes: this.deriveNotesForFinalize(inspection.notes, input),
    }

    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    this.validateAllItemsAnswered(derived, errors, warnings)
    this.validateRequiredPhotos(derived, errors, warnings)
    this.validateOutcomeSelected(derived, errors)
    this.validateSignaturePresent(derived, errors)
    this.validateGPSCaptured(derived, errors, warnings)

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  private deriveNotesForFinalize(
    existingNotes: string | null,
    input: { signature?: string | null; gpsCaptured?: boolean },
  ): string | null {
    const base = existingNotes ?? ''
    const needsSignatureMarker = input.signature != null && input.signature.length > 0
    const needsGpsMarker = input.gpsCaptured === true

    if (!needsSignatureMarker && !needsGpsMarker) return existingNotes

    const parts: string[] = [base]
    if (needsSignatureMarker && !base.includes('[SIGNATURE_CAPTURED]')) {
      parts.push('[SIGNATURE_CAPTURED]')
    }
    if (needsGpsMarker && !base.includes('[FINALIZATION_GPS]')) {
      parts.push('[FINALIZATION_GPS]')
    }

    const joined = parts.filter((p) => p.trim().length > 0).join('\n')
    return joined.length > 0 ? joined : null
  }

  /**
   * Rule 1: All checklist template items must have a response.
   */
  private validateAllItemsAnswered(
    inspection: InspectionData,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    if (inspection.checklistExecutions.length === 0) {
      errors.push({
        code: 'NO_CHECKLIST',
        field: 'checklistExecutions',
        message: 'No checklist execution found for this inspection',
      })
      return
    }

    for (const execution of inspection.checklistExecutions) {
      const items = parseTemplateItems(execution.template.items)
      const allIds = templateItemIds(items)

      if (allIds.length === 0) continue

      const responses = parseResponses(execution.responses)
      const answeredIds = new Set(responses.map((r) => r.itemId))

      const unanswered = allIds.filter((id) => !answeredIds.has(id))

      if (unanswered.length > 0) {
        errors.push({
          code: 'UNANSWERED_ITEMS',
          field: `checklistExecutions.${execution.id}`,
          message: `${unanswered.length} checklist item(s) have not been answered`,
        })
      }
    }
  }

  /**
   * Rule 2: Failed checklist items that require a photo must have at least one photo attached.
   *
   * Photos may be linked to the inspection directly or through a deficiency
   * that references the same checklist item.
   */
  private validateRequiredPhotos(
    inspection: InspectionData,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    for (const execution of inspection.checklistExecutions) {
      const items = parseTemplateItems(execution.template.items)
      const responses = parseResponses(execution.responses)

      const failedResponses = responses.filter((r) => r.result === 'FAIL')

      for (const response of failedResponses) {
        const templateItem = items.find(
          (item) => typeof item.id === 'string' && item.id === response.itemId,
        )

        const requiresPhoto = templateItem?.requiresPhoto !== false

        if (!requiresPhoto) continue

        const deficiencyForItem = inspection.deficiencies.find(
          (d) => d.checklistItemId === response.itemId,
        )

        const hasDeficiencyPhoto = deficiencyForItem != null && deficiencyForItem.photos.length > 0
        const hasDirectPhoto = inspection.photos.some(
          (p) => p.deficiencyId != null && p.deficiencyId === deficiencyForItem?.id,
        )

        if (!hasDeficiencyPhoto && !hasDirectPhoto) {
          errors.push({
            code: 'MISSING_PHOTO',
            field: `checklistItem.${response.itemId}`,
            message: `Failed checklist item "${response.itemId}" requires a photo`,
          })
        }
      }
    }
  }

  /**
   * Rule 3: An outcome must be selected before finalization.
   *
   * The inspection status must be either PASSED or FAILED (the two terminal
   * outcomes). IN_PROGRESS or SCHEDULED inspections cannot be submitted.
   */
  private validateOutcomeSelected(inspection: InspectionData, errors: ValidationError[]): void {
    const validOutcomes = ['PASSED', 'FAILED']

    if (!validOutcomes.includes(inspection.status)) {
      errors.push({
        code: 'NO_OUTCOME',
        field: 'status',
        message: 'Inspection outcome must be selected (Acceptable or Refused)',
      })
    }
  }

  /**
   * Rule 4: A digital signature must be present.
   *
   * The signature is stored as a marker in the inspection notes field.
   * We look for the `[SIGNATURE_CAPTURED]` marker.
   */
  private validateSignaturePresent(inspection: InspectionData, errors: ValidationError[]): void {
    const hasSignature =
      inspection.notes != null && inspection.notes.includes('[SIGNATURE_CAPTURED]')

    if (!hasSignature) {
      errors.push({
        code: 'MISSING_SIGNATURE',
        field: 'signature',
        message: 'Digital signature must be captured before submission',
      })
    }
  }

  /**
   * Rule 5: GPS coordinates must be captured at finalization time.
   *
   * We look for the `[FINALIZATION_GPS]` marker in the notes field, which
   * the finalization flow appends when GPS is recorded.
   */
  private validateGPSCaptured(
    inspection: InspectionData,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    const hasGPS = inspection.notes != null && inspection.notes.includes('[FINALIZATION_GPS]')

    if (!hasGPS) {
      errors.push({
        code: 'MISSING_GPS',
        field: 'gpsCoordinates',
        message: 'GPS coordinates must be captured at finalization',
      })
    }
  }

  /**
   * Load the full inspection entity with all nested data required for validation.
   */
  private async loadInspection(inspectionId: string): Promise<InspectionData | null> {
    const inspection = await prisma.permitInspection.findUnique({
      where: { id: inspectionId },
      include: {
        checklistExecutions: {
          include: {
            template: true,
          },
        },
        deficiencies: {
          include: {
            photos: {
              select: { id: true },
            },
          },
        },
        photos: {
          select: {
            id: true,
            deficiencyId: true,
          },
        },
      },
    })

    if (!inspection) return null

    return {
      id: inspection.id,
      status: inspection.status,
      notes: inspection.notes,
      checklistExecutions: inspection.checklistExecutions.map((exec) => ({
        id: exec.id,
        responses: exec.responses,
        template: {
          id: exec.template.id,
          items: exec.template.items,
        },
      })),
      deficiencies: inspection.deficiencies.map((d) => ({
        id: d.id,
        checklistItemId: d.checklistItemId,
        photos: d.photos,
      })),
      photos: inspection.photos.map((p) => ({
        id: p.id,
        deficiencyId: p.deficiencyId,
      })),
    }
  }
}

export const inspectionValidationService = new InspectionValidationService()
