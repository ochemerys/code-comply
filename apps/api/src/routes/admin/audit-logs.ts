import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { AuditLogListQuerySchema, AuditLogListResponseSchema } from '@codecomply/validators'
import { AuditLogMapper } from '../../mappers/audit-log.mapper.js'
import { auditLogService } from '../../services/audit-log.service.js'

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Admin'],
  summary: 'List audit log entries (admin)',
  request: { query: AuditLogListQuerySchema },
  responses: {
    200: {
      description: 'Audit log entries',
      content: { 'application/json': { schema: AuditLogListResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const app = new OpenAPIHono().openapi(listRoute, async (c) => {
  const query =
    c.req.valid('query') ??
    AuditLogListQuerySchema.parse({
      action: c.req.query('action'),
      entityType: c.req.query('entityType'),
      limit: c.req.query('limit'),
    })
  const rows = await auditLogService.list({
    action: query.action,
    entityType: query.entityType,
    limit: query.limit,
  })
  const entries = AuditLogMapper.toDTOs(rows)
  return c.json({ entries, total: entries.length }) as any
})

export default app
