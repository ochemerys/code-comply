import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { ReportVerifyResponseSchema } from '@codecomply/validators'
import { reportService } from '../services/report.service.js'

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

const verifyReportRoute = createRoute({
  method: 'get',
  path: '/verify/{id}',
  tags: ['Reports'],
  summary: 'Verify report document integrity (public)',
  request: {
    params: z.object({
      id: z
        .string()
        .min(1)
        .openapi({ param: { name: 'id', in: 'path' } }),
    }),
    query: z.object({
      hash: z
        .string()
        .min(64)
        .max(64)
        .openapi({ param: { name: 'hash', in: 'query' } }),
    }),
  },
  responses: {
    200: {
      description: 'Verification result',
      content: { 'application/json': { schema: ReportVerifyResponseSchema } },
    },
    400: {
      description: 'Invalid request',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const app = new OpenAPIHono().openapi(verifyReportRoute, async (c) => {
  const { id } = c.req.valid('param')
  const { hash } = c.req.valid('query')
  const result = await reportService.verifyReport(id, hash)
  return c.json(result, 200) as any
})

export default app
