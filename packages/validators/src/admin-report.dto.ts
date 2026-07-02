import { z } from 'zod'
import { DistributionKindSchema } from './report.dto.js'

export const ReportDistributionRecipientSchema = z.enum([
  'owner',
  'contractor',
  'inspector',
  'custom',
])
export type ReportDistributionRecipientDTO = z.infer<typeof ReportDistributionRecipientSchema>

export const DistributeReportDTOSchema = z.object({
  reportId: z.string().min(1),
  recipients: z.array(ReportDistributionRecipientSchema).min(1),
  customEmails: z.array(z.string().email()).optional(),
})
export type DistributeReportDTO = z.infer<typeof DistributeReportDTOSchema>

export const ReportDistributionResultSchema = z.object({
  reportId: z.string(),
  status: z.enum(['sent', 'failed']),
  messageId: z.string().optional(),
  error: z.string().optional(),
  distributedAt: z.string().datetime().nullable(),
})
export type ReportDistributionResultDTO = z.infer<typeof ReportDistributionResultSchema>

export const ReportVerifyResponseSchema = z.object({
  valid: z.boolean(),
  reportId: z.string(),
  uniqueReportId: z.string(),
  type: z.string(),
  hash: z.string(),
  generatedAt: z.string().datetime(),
  message: z.string().optional(),
})
export type ReportVerifyResponseDTO = z.infer<typeof ReportVerifyResponseSchema>

export const ReportDistributionStatusSchema = z.object({
  reportId: z.string(),
  distributedAt: z.string().datetime().nullable(),
  lastDistribution: z
    .object({
      kind: DistributionKindSchema,
      status: z.enum(['sent', 'failed', 'skipped']),
      messageId: z.string().optional(),
      error: z.string().optional(),
      at: z.string().datetime(),
    })
    .nullable()
    .optional(),
})
export type ReportDistributionStatusDTO = z.infer<typeof ReportDistributionStatusSchema>
