import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { ReviewVoCDTOSchema, VoCDTOSchema } from '@codecomply/validators'
import { requirePermission } from '../middleware/role.js'
import { vocService } from '../services/voc.service.js'
import { VoCMapper } from '../mappers/voc.mapper.js'

const vocBase = new OpenAPIHono()

vocBase.use('*', requirePermission('review_voc'))

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

export function mapVoCError(error: unknown): {
  status: 400 | 403 | 404 | 409 | 500
  body: { error: string; message?: string }
} {
  const message = error instanceof Error ? error.message : 'Unknown error'
  if (message.includes('not found')) {
    return { status: 404, body: { error: message } }
  }
  if (message.includes('Forbidden') || message.includes('Unauthorized')) {
    return { status: 403, body: { error: message } }
  }
  if (message.includes('pending review') || message.includes('already accepted')) {
    return { status: 409, body: { error: message } }
  }
  if (message.includes('not eligible') || message.includes('not pending')) {
    return { status: 400, body: { error: message } }
  }
  return { status: 500, body: { error: 'Internal error', message } }
}

const listPendingRoute = createRoute({
  method: 'get',
  path: '/pending',
  tags: ['VoC'],
  summary: 'List pending VoC submissions',
  description: 'Admin-only queue of VoC records awaiting review.',
  responses: {
    200: {
      description: 'Pending VoCs',
      content: { 'application/json': { schema: z.array(VoCDTOSchema) } },
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

const reviewVoCRoute = createRoute({
  method: 'post',
  path: '/{id}/review',
  tags: ['VoC'],
  summary: 'Review a pending VoC submission',
  description: 'Admin accepts or rejects a VoC and updates deficiency status.',
  request: {
    params: z.object({
      id: z
        .string()
        .min(1)
        .openapi({ param: { name: 'id', in: 'path' } }),
    }),
    body: {
      content: { 'application/json': { schema: ReviewVoCDTOSchema } },
    },
  },
  responses: {
    200: {
      description: 'Reviewed VoC',
      content: { 'application/json': { schema: VoCDTOSchema } },
    },
    400: {
      description: 'Invalid review',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const app = vocBase
  .openapi(listPendingRoute, async (c) => {
    const userId = c.get('userId')

    try {
      const rows = await vocService.listPending(userId)
      return c.json(VoCMapper.toDTOs(rows)) as any
    } catch (error) {
      const mapped = mapVoCError(error)
      if (mapped.status === 500) {
        console.error('[VoCController] listPending:', error)
      }
      return c.json(mapped.body, mapped.status) as any
    }
  })
  .openapi(reviewVoCRoute, async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const userId = c.get('userId')

    try {
      const row = await vocService.review(id, body.decision, userId, body.comments)
      return c.json(VoCMapper.toDTO(row)) as any
    } catch (error) {
      const mapped = mapVoCError(error)
      if (mapped.status === 500) {
        console.error('[VoCController] review:', error)
      }
      return c.json(mapped.body, mapped.status) as any
    }
  })

export default app
