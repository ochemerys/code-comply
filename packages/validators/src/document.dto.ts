import { z } from 'zod'

/**
 * Inspection document DTO — metadata for files stored in the documents bucket (M7-S9).
 * `storageKey` is internal and omitted from the public contract; clients use signed URLs to download.
 */
export const DocumentDTOSchema = z.object({
  id: z.string(),
  inspectionId: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  metadata: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type DocumentDTO = z.infer<typeof DocumentDTOSchema>

export const DocumentSignedUrlResponseSchema = z.object({
  url: z.string().url(),
  expiresIn: z.number().int().positive(),
})
export type DocumentSignedUrlResponse = z.infer<typeof DocumentSignedUrlResponseSchema>
