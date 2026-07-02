import { z } from 'zod'
import { CodeReferenceDTOSchema } from './code-reference.dto.js'

export const DeficiencySeveritySchema = z.enum(['MINOR', 'MAJOR', 'CRITICAL'])
export type DeficiencySeverity = z.infer<typeof DeficiencySeveritySchema>

export const DeficiencyStatusSchema = z.enum([
  'OPEN',
  'VOC_SUBMITTED',
  'VOC_ACCEPTED',
  'VOC_REJECTED',
  'CLOSED',
])
export type DeficiencyStatus = z.infer<typeof DeficiencyStatusSchema>

/**
 * Full deficiency record returned by APIs (aligns with Prisma Deficiency + client sync fields).
 */
export const DeficiencyDTOSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  inspectionId: z.string(),
  checklistItemId: z.string().optional(),
  description: z.string(),
  location: z.string().optional(),
  severity: DeficiencySeveritySchema,
  status: DeficiencyStatusSchema,
  codeReference: CodeReferenceDTOSchema.optional(),
  isStopWork: z.boolean(),
  isUnsafe: z.boolean(),
  dueDate: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type DeficiencyDTO = z.infer<typeof DeficiencyDTOSchema>

/**
 * Payload for creating a deficiency (offline-safe clientId, optional checklist link).
 */
export const CreateDeficiencyDTOSchema = z.object({
  clientId: z.string(),
  inspectionId: z.string(),
  checklistItemId: z.string().optional(),
  description: z.string().min(10),
  location: z.string().optional(),
  severity: DeficiencySeveritySchema,
  codeReference: CodeReferenceDTOSchema.optional(),
  isStopWork: z.boolean().default(false),
  isUnsafe: z.boolean().default(false),
  dueDate: z.string().datetime().optional(),
})
export type CreateDeficiencyDTO = z.infer<typeof CreateDeficiencyDTOSchema>

/**
 * Partial update; clientId is immutable after create. Strict so clientId and other unknown keys are rejected.
 * `status` is lifecycle (e.g. mark resolved) and is not part of create payload.
 */
export const UpdateDeficiencyDTOSchema = CreateDeficiencyDTOSchema.partial()
  .omit({ clientId: true })
  .merge(z.object({ status: DeficiencyStatusSchema.optional() }))
  .strict()
export type UpdateDeficiencyDTO = z.infer<typeof UpdateDeficiencyDTOSchema>

/** Response for POST /api/deficiencies/:id/stop-work */
export const StopWorkOrderDTOSchema = z.object({
  id: z.string(),
  deficiencyId: z.string(),
  inspectionId: z.string(),
  issuedAt: z.string().datetime(),
})
export type StopWorkOrderDTO = z.infer<typeof StopWorkOrderDTOSchema>
