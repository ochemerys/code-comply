import { z } from 'zod'

export const PushSubscriptionKeysSchema = z.object({
  p256dh: z.string().min(1),
  auth: z.string().min(1),
})

export const PushSubscriptionBodySchema = z.object({
  endpoint: z.string().url(),
  keys: PushSubscriptionKeysSchema,
  deviceId: z.string().min(1),
})

export type PushSubscriptionBody = z.infer<typeof PushSubscriptionBodySchema>

export const PushSubscriptionResponseSchema = z.object({
  id: z.string(),
  subscribed: z.boolean(),
})

export type PushSubscriptionResponse = z.infer<typeof PushSubscriptionResponseSchema>

export const PushUnsubscribeBodySchema = z.object({
  deviceId: z.string().min(1),
})

export type PushUnsubscribeBody = z.infer<typeof PushUnsubscribeBodySchema>

export const PushTestBodySchema = z.object({
  userId: z.string().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
  /** Deep link path (e.g. `/permits/:id`) — not a full URL; avoids request sanitization on `url`. */
  path: z.string().optional(),
})

export type PushTestBody = z.infer<typeof PushTestBodySchema>

export const PushTestResponseSchema = z.object({
  sent: z.number(),
  failed: z.number(),
})

export type PushTestResponse = z.infer<typeof PushTestResponseSchema>
