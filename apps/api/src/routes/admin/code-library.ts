import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  AdminCodeLibraryCreateBodySchema,
  AdminCodeLibraryListQuerySchema,
  AdminCodeLibraryUpdateBodySchema,
  CodeLibraryEntryDTOSchema,
} from '@codecomply/validators'
import { codeLibraryService } from '../../services/code-library.service.js'

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

function toEntryDto(ref: {
  id: string
  code: string
  section: string
  title: string
  description?: string | null
}) {
  return {
    id: ref.id,
    code: ref.code,
    section: ref.section,
    title: ref.title,
    ...(ref.description ? { description: ref.description } : {}),
  }
}

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Admin'],
  summary: 'List code library entries (admin)',
  request: { query: AdminCodeLibraryListQuerySchema },
  responses: {
    200: {
      description: 'Code entries',
      content: {
        'application/json': { schema: z.array(CodeLibraryEntryDTOSchema) },
      },
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

const postRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Admin'],
  summary: 'Create code library entry (admin)',
  request: {
    body: { content: { 'application/json': { schema: AdminCodeLibraryCreateBodySchema } } },
  },
  responses: {
    201: {
      description: 'Created entry',
      content: { 'application/json': { schema: CodeLibraryEntryDTOSchema } },
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
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const putRoute = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['Admin'],
  summary: 'Update code library entry (admin)',
  request: {
    params: z.object({
      id: z
        .string()
        .min(1)
        .openapi({ param: { name: 'id', in: 'path' } }),
    }),
    body: { content: { 'application/json': { schema: AdminCodeLibraryUpdateBodySchema } } },
  },
  responses: {
    200: {
      description: 'Updated entry',
      content: { 'application/json': { schema: CodeLibraryEntryDTOSchema } },
    },
    404: {
      description: 'Not found',
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

export default new OpenAPIHono()
  .openapi(listRoute, async (c) => {
    const q = c.req.valid('query')
    try {
      const refs = await codeLibraryService.listAll({ query: q.q, codeType: q.type })
      return c.json(refs.map(toEntryDto)) as any
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[AdminCodeLibrary] list:', error)
      return c.json({ error: 'Failed to list code library entries', message }, 500) as any
    }
  })
  .openapi(postRoute, async (c) => {
    const body = c.req.valid('json')
    try {
      const created = await codeLibraryService.createEntry(body)
      return c.json(toEntryDto(created), 201) as any
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[AdminCodeLibrary] create:', error)
      return c.json({ error: 'Failed to create code reference', message }, 500) as any
    }
  })
  .openapi(putRoute, async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    try {
      const updated = await codeLibraryService.updateEntry(id, body)
      return c.json(toEntryDto(updated)) as any
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      if (message.includes('not found')) {
        return c.json({ error: message }, 404) as any
      }
      console.error('[AdminCodeLibrary] update:', error)
      return c.json({ error: 'Failed to update code reference', message }, 500) as any
    }
  })
