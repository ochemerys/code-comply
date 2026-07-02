import { z } from 'zod'

/**
 * Sync Mutation - Represents a single mutation to be synced
 */
export const SyncMutationSchema = z.object({
  clientId: z.string().uuid(),
  entity: z.enum(['deficiency', 'inspection', 'checklist', 'document']),
  operation: z.enum(['create', 'update', 'delete']),
  payload: z.record(z.any()),
  timestamp: z.string().datetime(),
})

export type SyncMutation = z.infer<typeof SyncMutationSchema>

/**
 * Sync Result - Result of processing a single mutation
 */
export const SyncResultSchema = z.object({
  clientId: z.string().uuid(),
  success: z.boolean(),
  serverId: z.string().optional(),
  error: z.string().optional(),
  conflict: z.boolean().default(false),
})

export type SyncResult = z.infer<typeof SyncResultSchema>

/**
 * Push Request - Batch of mutations to push to server
 */
export const PushRequestSchema = z.object({
  mutations: z.array(SyncMutationSchema).min(1).max(100),
})

export type PushRequest = z.infer<typeof PushRequestSchema>

/**
 * Push Response - Results of processing mutations
 */
export const PushResponseSchema = z.object({
  results: z.array(SyncResultSchema),
  timestamp: z.string().datetime(),
})

export type PushResponse = z.infer<typeof PushResponseSchema>

/**
 * Change - Represents a change to pull from server
 */
export const ChangeSchema = z.object({
  id: z.string(),
  entity: z.enum(['deficiency', 'inspection', 'checklist', 'document']),
  operation: z.enum(['create', 'update', 'delete']),
  data: z.record(z.any()).optional(),
  timestamp: z.string().datetime(),
})

export type Change = z.infer<typeof ChangeSchema>

/**
 * Pull Response - Changes since last sync
 */
export const PullResponseSchema = z.object({
  changes: z.array(ChangeSchema),
  timestamp: z.string().datetime(),
  hasMore: z.boolean().default(false),
})

export type PullResponse = z.infer<typeof PullResponseSchema>

/**
 * Pull Query Parameters
 */
export const PullQuerySchema = z.object({
  since: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
})

export type PullQuery = z.infer<typeof PullQuerySchema>
