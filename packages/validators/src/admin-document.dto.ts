import { z } from 'zod'
import { DocumentDTOSchema } from './document.dto.js'

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export const EmailInspectionDocumentDTOSchema = z.object({
  to: z.array(z.string().email()).min(1),
  message: z.string().max(2000).optional(),
})
export type EmailInspectionDocumentDTO = z.infer<typeof EmailInspectionDocumentDTOSchema>

export const SignInspectionDocumentDTOSchema = z.object({
  signatureDataUrl: z
    .string()
    .min(1)
    .refine((v) => v.startsWith('data:image/'), 'signatureDataUrl must be a data URL image'),
  signedByName: z.string().min(1).max(200).optional(),
})
export type SignInspectionDocumentDTO = z.infer<typeof SignInspectionDocumentDTOSchema>

export const DocumentEmailResultSchema = z.object({
  documentId: z.string(),
  status: z.enum(['sent', 'failed']),
  messageId: z.string().optional(),
  error: z.string().optional(),
})
export type DocumentEmailResultDTO = z.infer<typeof DocumentEmailResultSchema>

export const SignedDocumentDTOSchema = DocumentDTOSchema.extend({
  signedAt: z.string().datetime().optional(),
  signedByName: z.string().optional(),
})
export type SignedDocumentDTO = z.infer<typeof SignedDocumentDTOSchema>

export const SignReportDTOSchema = SignInspectionDocumentDTOSchema
export type SignReportDTO = z.infer<typeof SignReportDTOSchema>

export const ReportExportFormatSchema = z.enum(['pdf', 'docx'])
export type ReportExportFormatDTO = z.infer<typeof ReportExportFormatSchema>
