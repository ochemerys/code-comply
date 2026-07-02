import { z } from 'zod'
import { GPSCoordinatesDTOSchema } from './gps.dto.js'
import { InspectionStatusSchema } from './inspection.dto.js'
import { ReportDTOSchema } from './report.dto.js'

export const InspectionStageSchema = z.enum([
  'FOUNDATION',
  'FRAMING',
  'ROUGH_IN',
  'INSULATION',
  'FINAL',
  'OTHER',
])
export type InspectionStageDTO = z.infer<typeof InspectionStageSchema>

export const INSPECTION_STAGE_LABELS: Record<InspectionStageDTO, string> = {
  FOUNDATION: 'Foundation',
  FRAMING: 'Framing',
  ROUGH_IN: 'Rough-in',
  INSULATION: 'Insulation',
  FINAL: 'Final',
  OTHER: 'Other',
}

const dateField = z.string().datetime().optional().nullable()

export const AdminInspectionWorkflowDetailSchema = z.object({
  inspectionId: z.string(),
  permitId: z.string().optional(),
  permitNumber: z.string(),
  address: z.string(),
  status: InspectionStatusSchema,
  isFinalized: z.boolean(),
  requestedDate: dateField,
  plannedDate: dateField,
  actualDate: dateField,
  stages: z.array(InspectionStageSchema),
  otherStageDescription: z.string().optional().nullable(),
  noFurtherInspectionsRequired: z.boolean(),
  firstNotificationDate: dateField,
  secondNotificationDate: dateField,
  unableToEnterComments: z.string().optional().nullable(),
  geofenceProof: GPSCoordinatesDTOSchema.optional(),
  inspectorGpsAtAttempt: GPSCoordinatesDTOSchema.optional(),
  reInspectionFeeFlagged: z.boolean(),
  reInspectionFeeFlaggedAt: dateField,
  permitReInspectionFeeFlagged: z.boolean(),
  ownerNotificationSentAt: dateField,
  ownerNotificationEmail: z.string().optional().nullable(),
  lastSyncedAt: dateField,
  latestNoEntryReport: ReportDTOSchema.optional(),
})
export type AdminInspectionWorkflowDetail = z.infer<typeof AdminInspectionWorkflowDetailSchema>

export const UpdateAdminInspectionWorkflowSchema = z
  .object({
    requestedDate: dateField,
    plannedDate: dateField,
    actualDate: dateField,
    stages: z.array(InspectionStageSchema).optional(),
    otherStageDescription: z.string().optional().nullable(),
    noFurtherInspectionsRequired: z.boolean().optional(),
    firstNotificationDate: dateField,
    secondNotificationDate: dateField,
    unableToEnterComments: z.string().optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.stages?.includes('OTHER') && !val.otherStageDescription?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Description is required when "Other" stage is selected',
        path: ['otherStageDescription'],
      })
    }
  })
export type UpdateAdminInspectionWorkflow = z.infer<typeof UpdateAdminInspectionWorkflowSchema>

export const AdminNoEntryLetterRequestSchema = z.object({
  ownerEmail: z.string().email().optional(),
})
export type AdminNoEntryLetterRequest = z.infer<typeof AdminNoEntryLetterRequestSchema>

export const AdminNoEntryLetterResponseSchema = z.object({
  report: ReportDTOSchema,
  ownerNotificationSentAt: z.string().datetime().optional(),
  ownerNotificationEmail: z.string().email().optional(),
})
export type AdminNoEntryLetterResponse = z.infer<typeof AdminNoEntryLetterResponseSchema>

export const InspectorUnableToEnterRequestSchema = z.object({
  attemptAt: z.string().datetime(),
  comments: z.string().min(1).max(4000),
  geofenceProof: GPSCoordinatesDTOSchema,
})
export type InspectorUnableToEnterRequest = z.infer<typeof InspectorUnableToEnterRequestSchema>

export const InspectorUnableToEnterResponseSchema = z.object({
  inspectionId: z.string(),
  syncedAt: z.string().datetime(),
})
export type InspectorUnableToEnterResponse = z.infer<typeof InspectorUnableToEnterResponseSchema>

/** Inspector sync payload for legacy workflow fields (LSC-A-01–03). */
export const InspectionWorkflowSyncPayloadSchema = z.object({
  inspectionId: z.string(),
  requestedDate: z.string().datetime().optional(),
  plannedDate: z.string().datetime().optional(),
  actualDate: z.string().datetime().optional(),
  stages: z.array(InspectionStageSchema).optional(),
  otherStageDescription: z.string().optional(),
  noFurtherInspectionsRequired: z.boolean().optional(),
  unableToEnter: z
    .object({
      firstNotificationDate: z.string().datetime(),
      secondNotificationDate: z.string().datetime().optional(),
      comments: z.string().optional(),
      geofenceProof: GPSCoordinatesDTOSchema.optional(),
    })
    .optional(),
  etag: z.string().optional(),
})
export type InspectionWorkflowSyncPayload = z.infer<typeof InspectionWorkflowSyncPayloadSchema>
