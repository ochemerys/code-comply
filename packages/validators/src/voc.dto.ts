import { z } from 'zod'

export const VoCMethodSchema = z.enum([
  'WRITTEN_ASSURANCE',
  'SITE_VISIT',
  'VERBAL_ASSURANCE',
  'OTHER',
])
export type VoCMethod = z.infer<typeof VoCMethodSchema>

export const VoCStatusSchema = z.enum(['PENDING', 'ACCEPTED', 'REJECTED'])
export type VoCStatus = z.infer<typeof VoCStatusSchema>

export const VoCDecisionSchema = z.enum(['ACCEPTED', 'REJECTED'])
export type VoCDecision = z.infer<typeof VoCDecisionSchema>

/** Payload for inspector VoC submission (M10-S6). */
export const SubmitVoCDTOSchema = z.object({
  verificationDate: z.string().datetime(),
  sectionTitle: z.string().min(1),
  title: z.string().min(1),
  name: z.string().min(1),
  method: VoCMethodSchema,
  comments: z.string().optional(),
})
export type SubmitVoCDTO = z.infer<typeof SubmitVoCDTOSchema>

/** API-facing VoC record (aligns with Prisma VerificationOfCompliance). */
export const VoCDTOSchema = z.object({
  id: z.string(),
  deficiencyId: z.string(),
  verificationDate: z.string().datetime(),
  sectionTitle: z.string(),
  title: z.string(),
  name: z.string(),
  method: VoCMethodSchema,
  comments: z.string().nullable().optional(),
  submittedAt: z.string().datetime().nullable().optional(),
  reviewedAt: z.string().datetime().nullable().optional(),
  reviewedById: z.string().nullable().optional(),
  status: VoCStatusSchema,
})
export type VoCDTO = z.infer<typeof VoCDTOSchema>

/** Admin review payload (M10-S10). */
export const ReviewVoCDTOSchema = z.object({
  decision: VoCDecisionSchema,
  comments: z.string().optional(),
})
export type ReviewVoCDTO = z.infer<typeof ReviewVoCDTOSchema>
