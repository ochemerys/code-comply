import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  PushSubscriptionBodySchema,
  PushSubscriptionResponseSchema,
  PushTestBodySchema,
  PushTestResponseSchema,
  PushUnsubscribeBodySchema,
} from '@codecomply/validators'
import { pushNotificationService, isPushConfigured } from '../services/push-notification.service.js'
import { roleMiddleware } from '../middleware/role.js'

const app = new OpenAPIHono()

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

const subscribeRoute = createRoute({
  method: 'post',
  path: '/subscribe',
  tags: ['Notifications'],
  summary: 'Register Web Push subscription for current device',
  request: {
    body: { content: { 'application/json': { schema: PushSubscriptionBodySchema } } },
  },
  responses: {
    200: {
      description: 'Subscription stored',
      content: { 'application/json': { schema: PushSubscriptionResponseSchema } },
    },
    400: {
      description: 'Bad request',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    503: {
      description: 'Push not configured on server',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

app.openapi(subscribeRoute, async (c) => {
  if (!isPushConfigured()) {
    return c.json(
      { error: 'Service Unavailable', message: 'Push notifications are not configured' },
      503,
    )
  }

  const userId = c.get('userId') as string
  const body = c.req.valid('json')
  const row = await pushNotificationService.upsertSubscription(userId, body)
  return c.json({ id: row.id, subscribed: true }) as any
})

const unsubscribeRoute = createRoute({
  method: 'post',
  path: '/unsubscribe',
  tags: ['Notifications'],
  summary: 'Remove Web Push subscription for current device',
  request: {
    body: { content: { 'application/json': { schema: PushUnsubscribeBodySchema } } },
  },
  responses: {
    200: {
      description: 'Unsubscribed',
      content: {
        'application/json': {
          schema: z.object({ unsubscribed: z.boolean() }),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

app.openapi(unsubscribeRoute, async (c) => {
  const userId = c.get('userId') as string
  const { deviceId } = c.req.valid('json')
  const unsubscribed = await pushNotificationService.removeSubscription(userId, deviceId)
  return c.json({ unsubscribed }) as any
})

app.use('/test', roleMiddleware(['ADMIN']))

const testRoute = createRoute({
  method: 'post',
  path: '/test',
  tags: ['Notifications'],
  summary: 'Send a test push notification (admin)',
  request: {
    body: { content: { 'application/json': { schema: PushTestBodySchema } } },
  },
  responses: {
    200: {
      description: 'Test push dispatched',
      content: { 'application/json': { schema: PushTestResponseSchema } },
    },
    400: {
      description: 'Bad request',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    503: {
      description: 'Push not configured',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

app.openapi(testRoute, async (c) => {
  if (!isPushConfigured()) {
    return c.json(
      { error: 'Service Unavailable', message: 'Push notifications are not configured' },
      503,
    )
  }

  const adminUserId = c.get('userId') as string
  const body = c.req.valid('json')
  const targetUserId = body.userId ?? adminUserId

  const result = await pushNotificationService.sendTestNotification(targetUserId, {
    title: body.title,
    body: body.body,
    path: body.path,
  })

  return c.json(result) as any
})

export default app
