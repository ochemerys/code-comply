import { z } from 'zod'
import { InspectionStageSchema } from './admin-inspection-workflow.dto.js'

/**
 * Permit Status Enum
 */
export const PermitStatusSchema = z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED'])
export type PermitStatus = z.infer<typeof PermitStatusSchema>

/** Checklist execution summary nested under permit inspection (inspector navigation). */
export const PermitInspectionChecklistExecutionRefSchema = z.object({
  id: z.string(),
  completedAt: z.string().datetime().nullable().optional(),
})
export type PermitInspectionChecklistExecutionRef = z.infer<
  typeof PermitInspectionChecklistExecutionRefSchema
>

/** Inspection row on permit detail API */
export const PermitInspectionDTOSchema = z.object({
  id: z.string(),
  status: z.string(),
  scheduledDate: z.string(),
  completedDate: z.string().optional(),
  assignedInspectorName: z.string().optional(),
  stages: z.array(InspectionStageSchema).optional(),
  checklistExecutions: z.array(PermitInspectionChecklistExecutionRefSchema).optional(),
})
export type PermitInspectionDTO = z.infer<typeof PermitInspectionDTOSchema>

/**
 * Permit DTO - Full permit details
 * Used for permit detail views and API responses
 */
export const PermitDTOSchema = z.object({
  id: z.string(),
  permitNumber: z.string(),
  address: z.string(),
  legalLandDesc: z.string().optional(),
  scope: z.string(),
  status: PermitStatusSchema,
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  /** Human-readable stage for the next scheduled inspection (inspector list/detail). */
  inspectionStageLabel: z.string().optional(),
  inspections: z.array(PermitInspectionDTOSchema).optional(),
})
export type PermitDTO = z.infer<typeof PermitDTOSchema>

/**
 * Permit List DTO - Minimal fields for list views
 * Optimized for performance in list/grid displays
 */
/** Admin triage summary — eligibility gates for assignment (A-02, A-05). */
export const PermitTriageSummarySchema = z.object({
  missingLld: z.boolean(),
  stopWorkLockedOut: z.boolean(),
  assignmentEligible: z.boolean(),
  blockReasons: z.array(z.string()),
  guidance: z.array(z.string()),
})
export type PermitTriageSummary = z.infer<typeof PermitTriageSummarySchema>

export const PermitListDTOSchema = z.object({
  id: z.string(),
  permitNumber: z.string(),
  address: z.string(),
  legalLandDesc: z.string().optional(),
  status: PermitStatusSchema,
  nextInspectionDate: z.string().datetime().optional(),
  /** Human-readable stage for the next scheduled inspection (e.g. Foundation). */
  inspectionStageLabel: z.string().optional(),
  distance: z.number().optional(), // Distance in meters from current location
  /** Client-only: permit missing on server (IndexedDB); not sent by API */
  isOrphan: z.boolean().optional(),
  triage: PermitTriageSummarySchema.optional(),
})
export type PermitListDTO = z.infer<typeof PermitListDTOSchema>

export const PermitTriageDetailDTOSchema = PermitDTOSchema.extend({
  triage: PermitTriageSummarySchema,
})
export type PermitTriageDetailDTO = z.infer<typeof PermitTriageDetailDTOSchema>

/**
 * Permit Search Query DTO
 * Used for searching and filtering permits
 */
export const PermitSearchQuerySchema = z.object({
  permitNumber: z.string().optional(),
  address: z.string().optional(),
  status: PermitStatusSchema.optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  radius: z.number().positive().optional(), // Search radius in meters
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
})
export type PermitSearchQuery = z.infer<typeof PermitSearchQuerySchema>

// ============================================================================
// Admin municipal permit sync (A-02)
// ============================================================================

export const PermitSyncStatusDTOSchema = z.object({
  lastSyncedAt: z.string().datetime().nullable(),
  status: z.enum(['idle', 'syncing', 'error', 'success']),
  lastError: z.string().optional(),
})

export type PermitSyncStatusDTO = z.infer<typeof PermitSyncStatusDTOSchema>

export const PermitSyncResultDTOSchema = z.object({
  syncedAt: z.string().datetime(),
  newPermits: z.number().int().nonnegative(),
  updatedPermits: z.number().int().nonnegative(),
  unchanged: z.number().int().nonnegative(),
})

export type PermitSyncResultDTO = z.infer<typeof PermitSyncResultDTOSchema>

/**
 * Permit GPS Search DTO
 * Specialized for GPS-based permit discovery
 */
export const PermitGPSSearchSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().positive().default(5000), // Default 5km radius
  status: PermitStatusSchema.optional(),
  limit: z.coerce.number().int().positive().max(50).default(20),
})
export type PermitGPSSearch = z.infer<typeof PermitGPSSearchSchema>

/**
 * Create Permit DTO
 * Used for creating new permits (admin only)
 */
export const CreatePermitDTOSchema = z.object({
  permitNumber: z.string().min(1),
  address: z.string().min(1),
  legalLandDesc: z.string().optional(),
  scope: z.string().min(1),
  status: PermitStatusSchema.default('ACTIVE'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
})
export type CreatePermitDTO = z.infer<typeof CreatePermitDTOSchema>

/**
 * Update Permit DTO
 * Used for updating existing permits (admin only)
 */
export const UpdatePermitDTOSchema = CreatePermitDTOSchema.partial()
export type UpdatePermitDTO = z.infer<typeof UpdatePermitDTOSchema>
