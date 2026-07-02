import { z } from 'zod'
import { GPSCoordinatesDTOSchema } from './gps.dto.js'
import { InspectionStatusSchema } from './inspection.dto.js'

/** Summary row for addendum list on inspection record detail (A-06). */
export const AddendumSummarySchema = z.object({
  id: z.string(),
  reason: z.string(),
  createdAt: z.string().datetime(),
  createdByName: z.string().optional(),
  hasSignature: z.boolean(),
})
export type AddendumSummary = z.infer<typeof AddendumSummarySchema>

/** Full addendum for read-only detail (Part C legal integrity). */
export const AddendumDTOSchema = z.object({
  id: z.string(),
  inspectionId: z.string(),
  reason: z.string(),
  content: z.string(),
  createdById: z.string(),
  createdByName: z.string().optional(),
  createdAt: z.string().datetime(),
  signature: z.string().nullable().optional(),
})
export type AddendumDTO = z.infer<typeof AddendumDTOSchema>

export const CreateAddendumRequestSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
  content: z.string().min(1, 'Details are required'),
  signature: z.string().min(1, 'Digital signature is required'),
})
export type CreateAddendumRequest = z.infer<typeof CreateAddendumRequestSchema>

const RecordDeficiencySummarySchema = z.object({
  id: z.string(),
  description: z.string(),
  status: z.string(),
  severity: z.string().optional(),
})

/**
 * Admin read-only inspection record (FOIP / append-only browser).
 */
export const AdminInspectionRecordDetailSchema = z.object({
  inspectionId: z.string(),
  uniqueId: z.string().optional(),
  permitNumber: z.string(),
  legalLandDescription: z.string().optional(),
  address: z.string(),
  status: InspectionStatusSchema,
  scheduledDate: z.string().datetime(),
  completedDate: z.string().datetime().optional(),
  finalizedAt: z.string().datetime().optional(),
  isFinalized: z.boolean(),
  notes: z.string().optional(),
  documentHash: z.string().optional(),
  inspectorName: z.string().optional(),
  finalizedByName: z.string().optional(),
  deficiencyCount: z.number().int(),
  deficiencies: z.array(RecordDeficiencySummarySchema),
  startGps: GPSCoordinatesDTOSchema.optional(),
  finalizeGps: GPSCoordinatesDTOSchema.optional(),
  hasCertificationSnapshot: z.boolean(),
  addendums: z.array(AddendumSummarySchema),
  appendOnlyMessage: z.string(),
})
export type AdminInspectionRecordDetail = z.infer<typeof AdminInspectionRecordDetailSchema>
