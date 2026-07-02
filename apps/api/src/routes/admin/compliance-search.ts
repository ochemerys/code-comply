import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { ComplianceSearchQuerySchema, ComplianceSearchResponseSchema } from '@codecomply/validators'
import { complianceSearchService } from '../../services/compliance-search.service.js'

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

const searchRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Admin'],
  summary: 'FOIP-compliant compliance search (admin)',
  request: { query: ComplianceSearchQuerySchema },
  responses: {
    200: {
      description: 'Matching inspection records',
      content: { 'application/json': { schema: ComplianceSearchResponseSchema } },
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

const app = new OpenAPIHono().openapi(searchRoute, async (c) => {
  const query = c.req.valid('query')
  const userId = c.get('userId') as string
  const response = await complianceSearchService.search(query, userId)
  return c.json(response) as any
})

export default app
