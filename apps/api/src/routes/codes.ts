import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { CodeReferenceDTOSchema } from '@codecomply/validators'
import { codeLibraryService } from '../services/code-library.service.js'

const app = new OpenAPIHono()

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

const CodeSearchQuerySchema = z
  .object({
    q: z
      .string()
      .optional()
      .openapi({
        param: { name: 'q', in: 'query' },
        example: 'fire separation',
      }),
    type: z
      .string()
      .optional()
      .openapi({
        param: { name: 'type', in: 'query' },
        example: 'NBC',
      }),
  })
  .openapi({
    description:
      'Search by text (`q`) and/or list sections for a code book (`type`). At least one must be provided.',
  })

const searchCodesRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Codes'],
  summary: 'Search or list code library entries',
  description:
    'Full-text style search via `q`, and/or filter by code book via `type`. When both are set, search results are narrowed to that code type.',
  request: {
    query: CodeSearchQuerySchema,
  },
  responses: {
    200: {
      description: 'Matching code references',
      content: {
        'application/json': {
          schema: z.array(CodeReferenceDTOSchema),
        },
      },
    },
    400: {
      description: 'Missing query parameters',
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

app.openapi(searchCodesRoute, async (c) => {
  const query = c.req.valid('query')
  const q = query.q?.trim() ?? ''
  const type = query.type?.trim() ?? ''

  if (!q && !type) {
    return c.json({ error: 'Provide query parameter q and/or type' }, 400) as any
  }

  try {
    if (q) {
      let refs = await codeLibraryService.search(q)
      if (type) {
        const t = type.toLowerCase()
        refs = refs.filter((r) => r.code.toLowerCase() === t)
      }
      return c.json(
        refs.map((r) => ({
          id: r.id,
          code: r.code,
          section: r.section,
          ...(r.title ? { title: r.title } : {}),
        })),
      ) as any
    }

    const refs = await codeLibraryService.listByType(type)
    return c.json(
      refs.map((r) => ({
        id: r.id,
        code: r.code,
        section: r.section,
        ...(r.title ? { title: r.title } : {}),
      })),
    ) as any
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[CodesController] search:', error)
    return c.json({ error: 'Failed to search codes', message }, 500) as any
  }
})

const getCodeRoute = createRoute({
  method: 'get',
  path: '/{code}/{section}',
  tags: ['Codes'],
  summary: 'Get code reference by code book and section',
  request: {
    params: z.object({
      code: z
        .string()
        .min(1)
        .openapi({ param: { name: 'code', in: 'path' }, example: 'NBC' }),
      section: z
        .string()
        .min(1)
        .openapi({ param: { name: 'section', in: 'path' }, example: '9.10.1' }),
    }),
  },
  responses: {
    200: {
      description: 'Code reference',
      content: {
        'application/json': {
          schema: CodeReferenceDTOSchema,
        },
      },
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

app.openapi(getCodeRoute, async (c) => {
  const { code, section } = c.req.valid('param')
  try {
    const ref = await codeLibraryService.getByCode(code, section)
    if (!ref) {
      return c.json({ error: 'Code reference not found' }, 404) as any
    }
    return c.json({
      id: ref.id,
      code: ref.code,
      section: ref.section,
      ...(ref.title ? { title: ref.title } : {}),
    }) as any
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[CodesController] getByCode:', error)
    return c.json({ error: 'Failed to resolve code reference', message }, 500) as any
  }
})

export default app
