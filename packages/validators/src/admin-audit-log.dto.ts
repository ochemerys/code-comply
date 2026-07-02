import { z } from 'zod'

export const AuditLogListQuerySchema = z.object({
  action: z.string().optional(),
  entityType: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export type AuditLogListQuery = z.infer<typeof AuditLogListQuerySchema>

export const AuditLogEntryDTOSchema = z.object({
  id: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  action: z.string(),
  userId: z.string(),
  timestamp: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
})

export type AuditLogEntryDTO = z.infer<typeof AuditLogEntryDTOSchema>

export const AuditLogListResponseSchema = z.object({
  entries: z.array(AuditLogEntryDTOSchema),
  total: z.number().int().nonnegative(),
})

export type AuditLogListResponse = z.infer<typeof AuditLogListResponseSchema>
