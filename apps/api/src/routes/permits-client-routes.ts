/**
 * Chained permit list route for Hono RPC typing (`hc<AppType>`).
 */
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { PermitListDTOSchema, PermitSearchQuerySchema } from '@codecomply/validators'
import { permitService } from '../services/permit.service.js'
import { permitTriageService } from '../services/permit-triage.service.js'
import { PermitMapper } from '../mappers/permit.mapper.js'

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

const listPermitsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Permits'],
  summary: 'List permits',
  request: { query: PermitSearchQuerySchema },
  responses: {
    200: {
      description: 'List of permits',
      content: { 'application/json': { schema: z.array(PermitListDTOSchema) } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Failed to list permits',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const app = new OpenAPIHono().openapi(listPermitsRoute, async (c) => {
  const query = c.req.valid('query')
  try {
    const permits = await permitService.search({
      permitNumber: query.permitNumber,
      address: query.address,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    })
    const triageByPermitId = await permitTriageService.buildTriageSummariesForPermits(permits)
    return c.json(PermitMapper.toListDTOs(permits, triageByPermitId)) as any
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[PermitsController] Error listing permits:', error)
    return c.json({ error: 'Failed to list permits', message }, 500) as any
  }
})

export default app
