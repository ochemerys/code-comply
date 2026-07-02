import { z } from 'zod'

/**
 * Inspection Status Enum
 */
export const InspectionStatusSchema = z.enum([
  'SCHEDULED',
  'IN_PROGRESS',
  'PASSED',
  'FAILED',
  'CANCELLED',
])
export type InspectionStatus = z.infer<typeof InspectionStatusSchema>

/**
 * Inspection DTO - Full inspection details
 * Used for inspection detail views and API responses
 */
export const InspectionDTOSchema = z.object({
  id: z.string(),
  permitId: z.string(),
  status: InspectionStatusSchema,
  scheduledDate: z.string().datetime(),
  completedDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  assignedInspectorId: z.string().optional(),
  assignedInspectorName: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type InspectionDTO = z.infer<typeof InspectionDTOSchema>

/**
 * Validation DTOs (M8 - Finalization)
 */
export const ValidationErrorDTOSchema = z.object({
  code: z.string(),
  field: z.string(),
  message: z.string(),
})
export type ValidationErrorDTO = z.infer<typeof ValidationErrorDTOSchema>

export const ValidationWarningDTOSchema = z.object({
  code: z.string(),
  field: z.string(),
  message: z.string(),
})
export type ValidationWarningDTO = z.infer<typeof ValidationWarningDTOSchema>

export const ValidationResultDTOSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(ValidationErrorDTOSchema),
  warnings: z.array(ValidationWarningDTOSchema),
})
export type ValidationResultDTO = z.infer<typeof ValidationResultDTOSchema>

/**
 * Inspection Review DTO
 *
 * Intended for a "review before submit" screen: inspection summary + validation.
 */
export const InspectionReviewDTOSchema = z.object({
  inspection: InspectionDTOSchema,
  validation: ValidationResultDTOSchema,
})
export type InspectionReviewDTO = z.infer<typeof InspectionReviewDTOSchema>

/**
 * Inspection List DTO - Minimal fields for list views
 * Optimized for performance in list/grid displays
 */
export const InspectionListDTOSchema = z.object({
  id: z.string(),
  permitId: z.string(),
  permitNumber: z.string(),
  address: z.string(),
  status: InspectionStatusSchema,
  scheduledDate: z.string().datetime(),
  assignedInspectorName: z.string().optional(),
})
export type InspectionListDTO = z.infer<typeof InspectionListDTOSchema>

/**
 * Create Inspection DTO
 * Used for scheduling new inspections
 */
export const CreateInspectionDTOSchema = z.object({
  permitId: z.string(),
  scheduledDate: z.string().datetime(),
  notes: z.string().optional(),
  assignedInspectorId: z.string().optional(),
})
export type CreateInspectionDTO = z.infer<typeof CreateInspectionDTOSchema>

/**
 * Update Inspection DTO
 * Used for updating inspection details
 */
export const UpdateInspectionDTOSchema = z.object({
  status: InspectionStatusSchema.optional(),
  scheduledDate: z.string().datetime().optional(),
  completedDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  assignedInspectorId: z.string().optional(),
})
export type UpdateInspectionDTO = z.infer<typeof UpdateInspectionDTOSchema>

/**
 * Inspection Search Query DTO
 * Used for searching and filtering inspections
 */
export const InspectionSearchQuerySchema = z.object({
  permitId: z.string().optional(),
  status: InspectionStatusSchema.optional(),
  assignedInspectorId: z.string().optional(),
  scheduledAfter: z.string().datetime().optional(),
  scheduledBefore: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
})
export type InspectionSearchQuery = z.infer<typeof InspectionSearchQuerySchema>
