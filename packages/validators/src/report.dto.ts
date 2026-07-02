import { z } from 'zod'

export const ReportTypeSchema = z.enum(['INSPECTION', 'DEFICIENCY', 'NO_ENTRY', 'STOP_WORK'])
export type ReportTypeDTO = z.infer<typeof ReportTypeSchema>

export const DistributionKindSchema = z.enum([
  'inspection-report',
  'deficiency-notice',
  'stop-work-order',
  'voc-decision',
])
export type DistributionKindDTO = z.infer<typeof DistributionKindSchema>

export const ReportDTOSchema = z.object({
  id: z.string(),
  inspectionId: z.string(),
  type: ReportTypeSchema,
  filename: z.string(),
  storageKey: z.string(),
  hash: z.string(),
  generatedAt: z.string().datetime(),
  distributedAt: z.string().datetime().nullable().optional(),
  signedAt: z.string().datetime().nullable().optional(),
  uniqueReportId: z.string().optional(),
  verifyUrl: z.string().url().optional(),
})
export type ReportDTO = z.infer<typeof ReportDTOSchema>

export const GenerateReportDTOSchema = z
  .object({
    inspectionId: z.string().min(1),
    type: ReportTypeSchema,
    deficiencyId: z.string().min(1).optional(),
  })
  .superRefine((val, ctx) => {
    if ((val.type === 'DEFICIENCY' || val.type === 'STOP_WORK') && !val.deficiencyId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `deficiencyId is required when type is ${val.type}`,
        path: ['deficiencyId'],
      })
    }
  })
export type GenerateReportDTO = z.infer<typeof GenerateReportDTOSchema>

export const ReportDownloadUrlSchema = z.object({
  url: z.string().url(),
  expiresIn: z.number().int().positive(),
})
export type ReportDownloadUrlDTO = z.infer<typeof ReportDownloadUrlSchema>
