import { z } from 'zod'

export const RemoteWipeStatusSchema = z.object({
  pending: z.boolean(),
  message: z.string().optional(),
})

export type RemoteWipeStatus = z.infer<typeof RemoteWipeStatusSchema>

export const RemoteWipeTriggerResponseSchema = z.object({
  message: z.string(),
  requestedAt: z.string().datetime(),
  userId: z.string(),
})

export type RemoteWipeTriggerResponse = z.infer<typeof RemoteWipeTriggerResponseSchema>

export const RemoteWipeConfirmResponseSchema = z.object({
  message: z.string(),
  confirmedAt: z.string().datetime(),
})

export type RemoteWipeConfirmResponse = z.infer<typeof RemoteWipeConfirmResponseSchema>
