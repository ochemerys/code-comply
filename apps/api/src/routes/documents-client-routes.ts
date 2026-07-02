/**
 * Chained document routes for Hono RPC typing (`hc<AppType>`).
 * Runtime server mounts `documents.ts`; keep paths in sync.
 */
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { DocumentDTOSchema, DocumentSignedUrlResponseSchema } from '@codecomply/validators'

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

const IdParamSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({ param: { name: 'id', in: 'path' }, example: 'doc-1' }),
})

const signedUrlRoute = createRoute({
  method: 'get',
  path: '/{id}/url',
  tags: ['Documents'],
  summary: 'Get signed download URL',
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'Signed URL',
      content: { 'application/json': { schema: DocumentSignedUrlResponseSchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Documents'],
  summary: 'Delete document',
  request: { params: IdParamSchema },
  responses: {
    204: { description: 'Deleted' },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const app = new OpenAPIHono()
  .openapi(signedUrlRoute, async (c) => {
    return c.json({ url: 'https://example.com', expiresIn: 3600 }) as any
  })
  .openapi(deleteRoute, async (c) => {
    return c.body(null, 204) as any
  })

export default app
