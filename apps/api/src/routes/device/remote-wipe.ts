import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { RemoteWipeConfirmResponseSchema, RemoteWipeStatusSchema } from '@codecomply/validators'
import { remoteWipeService } from '../../services/remote-wipe.service.js'
import { roleMiddleware } from '../../middleware/role.js'

const app = new OpenAPIHono()

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

app.use('*', roleMiddleware(['SCO']))

const statusRoute = createRoute({
  method: 'get',
  path: '/status',
  tags: ['Device'],
  summary: 'Remote wipe status for current inspector device',
  responses: {
    200: {
      description: 'Wipe status',
      content: { 'application/json': { schema: RemoteWipeStatusSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

app.openapi(statusRoute, async (c) => {
  const userId = c.get('userId') as string
  const status = await remoteWipeService.getWipeStatus(userId)
  return c.json(status) as any
})

const confirmRoute = createRoute({
  method: 'post',
  path: '/confirm',
  tags: ['Device'],
  summary: 'Confirm remote wipe completed on device',
  responses: {
    200: {
      description: 'Wipe confirmed',
      content: { 'application/json': { schema: RemoteWipeConfirmResponseSchema } },
    },
    400: {
      description: 'No pending wipe',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

app.openapi(confirmRoute, async (c) => {
  const userId = c.get('userId') as string
  try {
    const user = await remoteWipeService.confirmRemoteWipe(userId)
    const confirmedAt = user.remoteWipeConfirmedAt ?? new Date()
    return c.json({
      message: 'Remote wipe confirmed',
      confirmedAt: confirmedAt.toISOString(),
    }) as any
  } catch (e) {
    if (e instanceof Error && e.message === 'No pending remote wipe for this user') {
      return c.json({ error: 'Bad Request', message: e.message }, 400)
    }
    throw e
  }
})

export default app
