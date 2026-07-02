import { z } from 'zod'

/**
 * Evidence photo DTO — inspection photos in the photos bucket (M7-S19).
 * `storageKey` is included so the inspector can persist offline sync state.
 */
export const PhotoDTOSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  inspectionId: z.string(),
  deficiencyId: z.string().nullable().optional(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  storageKey: z.string().nullable().optional(),
  metadata: z.record(z.unknown()),
  annotations: z.unknown().optional(),
  createdAt: z.string().datetime(),
  syncedAt: z.string().datetime().nullable().optional(),
})
export type PhotoDTO = z.infer<typeof PhotoDTOSchema>
