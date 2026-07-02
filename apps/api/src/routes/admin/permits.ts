import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  PermitSyncResultDTOSchema,
  PermitSyncStatusDTOSchema,
  PermitTriageDetailDTOSchema,
} from '@codecomply/validators'
import { permitSyncService } from '../../services/permit-sync.service.js'
import { permitTriageService } from '../../services/permit-triage.service.js'

const app = new OpenAPIHono()

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

const getSyncStatusRoute = createRoute({
  method: 'get',
  path: '/sync-status',
  tags: ['Admin'],
  summary: 'Municipal permit sync status (admin)',
  responses: {
    200: {
      description: 'Sync status',
      content: { 'application/json': { schema: PermitSyncStatusDTOSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

app.openapi(getSyncStatusRoute, async (c) => {
  const status = await permitSyncService.getStatus()
  return c.json(status) as any
})

const postSyncRoute = createRoute({
  method: 'post',
  path: '/sync',
  tags: ['Admin'],
  summary: 'Sync active permits from municipal system (admin)',
  responses: {
    200: {
      description: 'Sync summary',
      content: { 'application/json': { schema: PermitSyncResultDTOSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

app.openapi(postSyncRoute, async (c) => {
  const userId = c.get('userId') as string
  try {
    const result = await permitSyncService.syncFromMunicipal(userId)
    return c.json(result) as any
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Sync failed'
    return c.json({ error: 'Sync failed', message }, 500) as any
  }
})

const getPermitTriageRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Admin'],
  summary: 'Permit triage detail (admin)',
  request: {
    params: z.object({
      id: z
        .string()
        .min(1)
        .openapi({ param: { name: 'id', in: 'path' }, example: 'permit-123' }),
    }),
  },
  responses: {
    200: {
      description: 'Permit with triage eligibility summary',
      content: { 'application/json': { schema: PermitTriageDetailDTOSchema } },
    },
    404: {
      description: 'Permit not found',
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
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

app.openapi(getPermitTriageRoute, async (c) => {
  const { id } = c.req.valid('param')
  try {
    const detail = await permitTriageService.getTriageDetail(id)
    if (!detail) {
      return c.json({ error: 'Permit not found' }, 404) as any
    }
    return c.json(detail) as any
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load permit'
    return c.json({ error: 'Failed to load permit', message }, 500) as any
  }
})

export default app
