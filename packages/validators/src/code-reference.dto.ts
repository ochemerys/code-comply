import { z } from 'zod'

/**
 * Code reference attached to failed checklist items or deficiencies.
 * Aligns with code library entries (code + section uniqueness).
 */
export const CodeReferenceDTOSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1),
  section: z.string().min(1),
  title: z.string().optional(),
})

export type CodeReferenceDTO = z.infer<typeof CodeReferenceDTOSchema>

/** Full code library row for admin CRUD (A-03). */
export const CodeLibraryEntryDTOSchema = CodeReferenceDTOSchema.extend({
  id: z.string(),
  description: z.string().optional(),
})

export type CodeLibraryEntryDTO = z.infer<typeof CodeLibraryEntryDTOSchema>

export const AdminCodeLibraryCreateBodySchema = z.object({
  code: z.string().min(1),
  section: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
})

export type AdminCodeLibraryCreateBody = z.infer<typeof AdminCodeLibraryCreateBodySchema>

export const AdminCodeLibraryUpdateBodySchema = z.object({
  code: z.string().min(1).optional(),
  section: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
})

export type AdminCodeLibraryUpdateBody = z.infer<typeof AdminCodeLibraryUpdateBodySchema>

export const AdminCodeLibraryListQuerySchema = z.object({
  q: z.string().optional(),
  type: z.string().optional(),
})
