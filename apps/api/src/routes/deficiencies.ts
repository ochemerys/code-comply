import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  CreateDeficiencyDTOSchema,
  DeficiencyDTOSchema,
  DeficiencySeveritySchema,
  DeficiencyStatusSchema,
  StopWorkOrderDTOSchema,
  UpdateDeficiencyDTOSchema,
  SubmitVoCDTOSchema,
  VoCDTOSchema,
} from '@codecomply/validators'
import { deficiencyService } from '../services/deficiency.service.js'
import { DeficiencyMapper } from '../mappers/deficiency.mapper.js'
import { vocService } from '../services/voc.service.js'
import { VoCMapper } from '../mappers/voc.mapper.js'
import { mapVoCError } from './voc.js'

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

const ListDeficienciesQuerySchema = z.object({
  inspectionId: z
    .string()
    .optional()
    .openapi({ param: { name: 'inspectionId', in: 'query' }, example: 'cl-insp-1' }),
  status: DeficiencyStatusSchema.optional().openapi({
    param: { name: 'status', in: 'query' },
    example: 'OPEN',
  }),
  severity: DeficiencySeveritySchema.optional().openapi({
    param: { name: 'severity', in: 'query' },
    example: 'MAJOR',
  }),
})

const IdParamSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({ param: { name: 'id', in: 'path' }, example: 'def-1' }),
})

function normalizeIfMatch(header: string | undefined): string | undefined {
  if (!header) return undefined
  const v = header.trim()
  if (v.startsWith('W/"') && v.endsWith('"')) return v.slice(3, -1)
  if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1)
  return v
}

type DeficiencyErrorStatus = 403 | 404 | 409 | 500

function mapDeficiencyError(error: unknown): {
  status: DeficiencyErrorStatus
  body: { error: string; message?: string }
} {
  const message = error instanceof Error ? error.message : 'Unknown error'
  if (message.includes('not found')) {
    return { status: 404, body: { error: message } }
  }
  if (message.includes('Unauthorized access')) {
    return { status: 403, body: { error: message } }
  }
  if (message.includes('User not assigned')) {
    return { status: 403, body: { error: message } }
  }
  if (message.includes('Forbidden:')) {
    return { status: 403, body: { error: message } }
  }
  if (message.includes('Optimistic concurrency conflict') || message.includes('ETag mismatch')) {
    return { status: 409, body: { error: message } }
  }
  return { status: 500, body: { error: 'Internal error', message } }
}

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Deficiencies'],
  summary: 'List deficiencies',
  description: 'Lists deficiencies visible to the current user, with optional filters.',
  request: { query: ListDeficienciesQuerySchema },
  responses: {
    200: {
      description: 'Deficiencies',
      content: { 'application/json': { schema: z.array(DeficiencyDTOSchema) } },
    },
    400: {
      description: 'Invalid query',
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

const getByIdRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Deficiencies'],
  summary: 'Get deficiency by id',
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'Deficiency',
      content: { 'application/json': { schema: DeficiencyDTOSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Not found',
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

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  tags: ['Deficiencies'],
  summary: 'Create deficiency',
  request: {
    body: {
      content: { 'application/json': { schema: CreateDeficiencyDTOSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      description: 'Created',
      content: { 'application/json': { schema: DeficiencyDTOSchema } },
    },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Inspection not found',
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

const patchRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Deficiencies'],
  summary: 'Update deficiency',
  description: 'Partial update. Send If-Match with the current etag for optimistic concurrency.',
  request: {
    params: IdParamSchema,
    body: {
      content: { 'application/json': { schema: UpdateDeficiencyDTOSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Updated',
      content: { 'application/json': { schema: DeficiencyDTOSchema } },
    },
    400: {
      description: 'Bad request',
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
    409: {
      description: 'ETag conflict',
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

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Deficiencies'],
  summary: 'Delete deficiency',
  request: { params: IdParamSchema },
  responses: {
    204: { description: 'Deleted' },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Not found',
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

const submitVoCRoute = createRoute({
  method: 'post',
  path: '/{id}/voc',
  tags: ['Deficiencies'],
  summary: 'Submit Verification of Compliance',
  description: 'Inspector submits VoC for an open or previously rejected deficiency.',
  request: {
    params: IdParamSchema,
    body: {
      content: { 'application/json': { schema: SubmitVoCDTOSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      description: 'VoC submitted',
      content: { 'application/json': { schema: VoCDTOSchema } },
    },
    400: {
      description: 'Invalid submission',
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
    409: {
      description: 'Conflict',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const getVoCByDeficiencyRoute = createRoute({
  method: 'get',
  path: '/{id}/voc',
  tags: ['Deficiencies'],
  summary: 'Get Verification of Compliance for a deficiency',
  description: 'Returns the linked VoC record when one exists (admin and inspector).',
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'VoC record when linked, or null when none exists yet',
      content: { 'application/json': { schema: VoCDTOSchema.nullable() } },
    },
    404: {
      description: 'Deficiency not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
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

const stopWorkRoute = createRoute({
  method: 'post',
  path: '/{id}/stop-work',
  tags: ['Deficiencies'],
  summary: 'Issue Stop Work order',
  description: 'Sets Stop Work on the deficiency and triggers notification hooks.',
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'Stop Work order issued',
      content: { 'application/json': { schema: StopWorkOrderDTOSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Not found',
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

const app = new OpenAPIHono()
  .openapi(listRoute, async (c) => {
    const query = c.req.valid('query')
    const userId = c.get('userId')
    try {
      const rows = await deficiencyService.list({
        userId,
        inspectionId: query.inspectionId,
        status: query.status,
        severity: query.severity,
      })
      return c.json(DeficiencyMapper.toDTOs(rows)) as any
    } catch (error: unknown) {
      const mapped = mapDeficiencyError(error)
      if (mapped.status === 500) {
        console.error('[DeficienciesController] list:', error)
      }
      return c.json(mapped.body, mapped.status) as any
    }
  })
  .openapi(getByIdRoute, async (c) => {
    const { id } = c.req.valid('param')
    const userId = c.get('userId')
    try {
      const row = await deficiencyService.getById(id, userId)
      if (!row) {
        return c.json({ error: 'Deficiency not found' }, 404) as any
      }
      return c.json(DeficiencyMapper.toDTO(row)) as any
    } catch (error: unknown) {
      const mapped = mapDeficiencyError(error)
      if (mapped.status === 500) {
        console.error('[DeficienciesController] getById:', error)
      }
      return c.json(mapped.body, mapped.status) as any
    }
  })
  .openapi(createRouteDef, async (c) => {
    const body = c.req.valid('json')
    const userId = c.get('userId')
    try {
      const row = await deficiencyService.create(body, userId)
      return c.json(DeficiencyMapper.toDTO(row), 201) as any
    } catch (error: unknown) {
      const mapped = mapDeficiencyError(error)
      if (mapped.status === 500) {
        console.error('[DeficienciesController] create:', error)
      }
      return c.json(mapped.body, mapped.status) as any
    }
  })
  .openapi(getVoCByDeficiencyRoute, async (c) => {
    const { id } = c.req.valid('param')
    const userId = c.get('userId')
    try {
      const deficiency = await deficiencyService.getById(id, userId)
      if (!deficiency) {
        return c.json({ error: 'Deficiency not found' }, 404) as any
      }
      const voc = await vocService.getByDeficiency(id)
      return c.json(voc ? VoCMapper.toDTO(voc) : null) as any
    } catch (error: unknown) {
      const mapped = mapDeficiencyError(error)
      if (mapped.status === 500) {
        console.error('[DeficienciesController] getVoC:', error)
      }
      return c.json(mapped.body, mapped.status) as any
    }
  })
  .openapi(patchRoute, async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const userId = c.get('userId')
    const etag = normalizeIfMatch(c.req.header('If-Match'))
    try {
      const row = await deficiencyService.update(id, userId, body, etag)
      const dto = DeficiencyMapper.toDTO(row)
      if (row.etag) {
        c.header('ETag', row.etag)
      }
      return c.json(dto) as any
    } catch (error: unknown) {
      const mapped = mapDeficiencyError(error)
      if (mapped.status === 500) {
        console.error('[DeficienciesController] patch:', error)
      }
      return c.json(mapped.body, mapped.status) as any
    }
  })
  .openapi(deleteRoute, async (c) => {
    const { id } = c.req.valid('param')
    const userId = c.get('userId')
    try {
      await deficiencyService.delete(id, userId)
      return c.body(null, 204)
    } catch (error: unknown) {
      const mapped = mapDeficiencyError(error)
      if (mapped.status === 500) {
        console.error('[DeficienciesController] delete:', error)
      }
      return c.json(mapped.body, mapped.status) as any
    }
  })
  .openapi(submitVoCRoute, async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const userId = c.get('userId')

    try {
      const deficiency = await deficiencyService.getById(id, userId)
      if (!deficiency) {
        return c.json({ error: 'Deficiency not found' }, 404) as any
      }

      const row = await vocService.submit(id, body)
      return c.json(VoCMapper.toDTO(row), 201) as any
    } catch (error: unknown) {
      const mapped = mapVoCError(error)
      if (mapped.status === 500) {
        console.error('[DeficienciesController] submit VoC:', error)
      }
      return c.json(mapped.body, mapped.status) as any
    }
  })
  .openapi(stopWorkRoute, async (c) => {
    const { id } = c.req.valid('param')
    const userId = c.get('userId')
    try {
      const swo = await deficiencyService.createStopWorkOrder(id, userId)
      return c.json(swo) as any
    } catch (error: unknown) {
      const mapped = mapDeficiencyError(error)
      if (mapped.status === 500) {
        console.error('[DeficienciesController] stop-work:', error)
      }
      return c.json(mapped.body, mapped.status) as any
    }
  })

export default app
