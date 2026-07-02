import { z } from 'zod'
import { InspectionStatusSchema } from './inspection.dto.js'

/**
 * FOIP compliance search query (M10-S16).
 * Admin-only advanced search for inspection records.
 */
export const ComplianceSearchOutcomeSchema = z.enum(['PASSED', 'FAILED'])
export type ComplianceSearchOutcome = z.infer<typeof ComplianceSearchOutcomeSchema>

export const ComplianceSearchQuerySchema = z.object({
  legalLandDescription: z.string().optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'dateFrom must be YYYY-MM-DD')
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'dateTo must be YYYY-MM-DD')
    .optional(),
  inspectorId: z.string().optional(),
  permitNumber: z.string().optional(),
  status: InspectionStatusSchema.optional(),
  outcome: ComplianceSearchOutcomeSchema.optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
  offset: z.coerce.number().int().nonnegative().default(0),
})
export type ComplianceSearchQuery = z.infer<typeof ComplianceSearchQuerySchema>

export const ComplianceSearchResultDTOSchema = z.object({
  inspectionId: z.string(),
  permitNumber: z.string(),
  legalLandDescription: z.string().optional(),
  address: z.string(),
  status: InspectionStatusSchema,
  scheduledDate: z.string().datetime(),
  completedDate: z.string().datetime().optional(),
  finalizedAt: z.string().datetime().optional(),
  inspectorId: z.string().optional(),
  inspectorName: z.string().optional(),
  deficiencyCount: z.number().int(),
  /** True when a legal certification snapshot was captured at finalization. */
  hasCertificationSnapshot: z.boolean().optional(),
})
export type ComplianceSearchResultDTO = z.infer<typeof ComplianceSearchResultDTOSchema>

export const ComplianceSearchResponseSchema = z.object({
  results: z.array(ComplianceSearchResultDTOSchema),
  total: z.number().int(),
  searchAuditId: z.string().optional(),
})
export type ComplianceSearchResponse = z.infer<typeof ComplianceSearchResponseSchema>
