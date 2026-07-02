import { z } from 'zod'
import { CodeReferenceDTOSchema } from './code-reference.dto.js'

export const ChecklistResponseResultSchema = z.enum(['PASS', 'FAIL', 'NA'])
export type ChecklistResponseResult = z.infer<typeof ChecklistResponseResultSchema>

export const ChecklistItemDTOSchema = z.object({
  id: z.string(),
  order: z.number(),
  text: z.string(),
  category: z.string().optional(),
  isRequired: z.boolean().default(true),
  requiresPhoto: z.boolean().default(false),
  codeReferences: z.array(CodeReferenceDTOSchema).optional(),
})

export type ChecklistItemDTO = z.infer<typeof ChecklistItemDTOSchema>

export const ChecklistTemplateDTOSchema = z.object({
  id: z.string(),
  name: z.string(),
  discipline: z.string(),
  version: z.number().int().positive(),
  versionHash: z.string(),
  items: z.array(ChecklistItemDTOSchema),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type ChecklistTemplateDTO = z.infer<typeof ChecklistTemplateDTOSchema>

export const ChecklistResponseDTOSchema = z
  .object({
    itemId: z.string(),
    result: ChecklistResponseResultSchema,
    codeReference: CodeReferenceDTOSchema.optional(),
    notes: z.string().optional(),
    timestamp: z.string().datetime(),
  })
  .superRefine((data, ctx) => {
    if (data.result === 'FAIL' && data.codeReference === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'codeReference is required when result is FAIL',
        path: ['codeReference'],
      })
    }
  })

export type ChecklistResponseDTO = z.infer<typeof ChecklistResponseDTOSchema>

export const ChecklistExecutionDTOSchema = z.object({
  id: z.string(),
  inspectionId: z.string(),
  templateId: z.string(),
  versionHash: z.string(),
  responses: z.array(ChecklistResponseDTOSchema),
  progress: z.number().min(0).max(100),
  completedAt: z.string().datetime().optional(),
})

export type ChecklistExecutionDTO = z.infer<typeof ChecklistExecutionDTOSchema>

/**
 * Progress for required template items: fraction of required items that have at least one response.
 * Returns 100 when there are no required items.
 */
export function computeChecklistExecutionProgress(
  items: { id: string; isRequired?: boolean }[],
  responses: { itemId: string }[],
): number {
  const requiredIds = new Set(items.filter((i) => i.isRequired !== false).map((i) => i.id))
  const responded = new Set(responses.map((r) => r.itemId))
  let answered = 0
  for (const id of requiredIds) {
    if (responded.has(id)) answered += 1
  }
  const total = requiredIds.size
  if (total === 0) return 100
  return Math.round((answered / total) * 100)
}

/** Input item for admin template builder (id optional — assigned server-side). */
export const AdminChecklistItemInputSchema = z.object({
  id: z.string().optional(),
  order: z.number(),
  text: z.string().min(1),
  category: z.string().optional(),
  isRequired: z.boolean().default(true),
  requiresPhoto: z.boolean().default(false),
  codeReferences: z.array(CodeReferenceDTOSchema).optional(),
})

export type AdminChecklistItemInput = z.infer<typeof AdminChecklistItemInputSchema>

export const AdminChecklistTemplateCreateBodySchema = z.object({
  name: z.string().min(1),
  discipline: z.string().min(1),
  items: z.array(AdminChecklistItemInputSchema).min(1),
  publish: z.boolean().default(false),
})

export type AdminChecklistTemplateCreateBody = z.infer<
  typeof AdminChecklistTemplateCreateBodySchema
>

export const AdminChecklistTemplateUpdateBodySchema = z.object({
  name: z.string().min(1).optional(),
  discipline: z.string().min(1).optional(),
  items: z.array(AdminChecklistItemInputSchema).min(1).optional(),
  createNewVersion: z.boolean().default(false),
})

export type AdminChecklistTemplateUpdateBody = z.infer<
  typeof AdminChecklistTemplateUpdateBodySchema
>

export const AdminChecklistTemplateListItemDTOSchema = ChecklistTemplateDTOSchema.extend({
  usageCount: z.number().int().nonnegative(),
  isLocked: z.boolean(),
})

export type AdminChecklistTemplateListItemDTO = z.infer<
  typeof AdminChecklistTemplateListItemDTOSchema
>

export const AdminChecklistTemplateDetailDTOSchema = ChecklistTemplateDTOSchema.extend({
  usageCount: z.number().int().nonnegative(),
  isLocked: z.boolean(),
})

export type AdminChecklistTemplateDetailDTO = z.infer<typeof AdminChecklistTemplateDetailDTOSchema>

export const AdminChecklistTemplateListQuerySchema = z.object({
  discipline: z.string().optional(),
  search: z.string().optional(),
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
})
