/**
 * Chained admin assignment routes for Hono RPC typing (`hc<AppType>`).
 * Runtime server mounts `routes/admin/assignments.ts`; keep paths in sync.
 */
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  AdminAssignmentCreateBodySchema,
  AdminAssignmentGridDTOSchema,
  AdminAssignmentGridQuerySchema,
  AdminBulkAssignmentBodySchema,
  AdminCalendarWorkloadDTOSchema,
  AdminCalendarWorkloadQuerySchema,
  AdminWorkloadQuerySchema,
  AssignmentDTOSchema,
  WorkloadDTOSchema,
} from '@codecomply/validators'
import { assignmentService } from '../services/assignment.service.js'
import { AssignmentMapper } from '../mappers/assignment.mapper.js'

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

const getGridRoute = createRoute({
  method: 'get',
  path: '/grid',
  tags: ['Admin'],
  summary: 'Assignment grid data for a date range (admin)',
  request: { query: AdminAssignmentGridQuerySchema },
  responses: {
    200: {
      description: 'Grid payload',
      content: { 'application/json': { schema: AdminAssignmentGridDTOSchema } },
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

const getCalendarWorkloadRoute = createRoute({
  method: 'get',
  path: '/calendar',
  tags: ['Admin'],
  summary: 'All inspectors workload events for calendar (admin)',
  request: { query: AdminCalendarWorkloadQuerySchema },
  responses: {
    200: {
      description: 'Calendar events',
      content: { 'application/json': { schema: AdminCalendarWorkloadDTOSchema } },
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

const postAssignRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Admin'],
  summary: 'Create or update assignment (admin)',
  request: {
    body: { content: { 'application/json': { schema: AdminAssignmentCreateBodySchema } } },
  },
  responses: {
    200: {
      description: 'Assignment (inspection schedule)',
      content: { 'application/json': { schema: AssignmentDTOSchema } },
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

const postBulkAssignRoute = createRoute({
  method: 'post',
  path: '/bulk',
  tags: ['Admin'],
  summary: 'Bulk assign inspections (admin)',
  request: {
    body: { content: { 'application/json': { schema: AdminBulkAssignmentBodySchema } } },
  },
  responses: {
    200: {
      description: 'Assignments',
      content: { 'application/json': { schema: z.array(AssignmentDTOSchema) } },
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

const getWorkloadRoute = createRoute({
  method: 'get',
  path: '/workload',
  tags: ['Admin'],
  summary: 'Inspector workload in a date range (admin)',
  request: { query: AdminWorkloadQuerySchema },
  responses: {
    200: {
      description: 'Workload',
      content: { 'application/json': { schema: WorkloadDTOSchema } },
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

const app = new OpenAPIHono()
  .openapi(getGridRoute, async (c) => {
    const q = c.req.valid('query')
    const from = new Date(`${q.from}T00:00:00.000Z`)
    const to = new Date(`${q.to}T23:59:59.999Z`)
    const grid = await assignmentService.getGridData(from, to)
    return c.json(grid) as any
  })
  .openapi(getCalendarWorkloadRoute, async (c) => {
    const q = c.req.valid('query')
    const payload = await assignmentService.getCalendarWorkload(new Date(q.from), new Date(q.to))
    return c.json(payload) as any
  })
  .openapi(postAssignRoute, async (c) => {
    const body = c.req.valid('json')
    try {
      const scheduledDate = body.scheduledDate ? new Date(body.scheduledDate) : undefined
      const row = await assignmentService.assign(body.inspectionId, body.userId, { scheduledDate })
      return c.json(AssignmentMapper.toDTO(row)) as any
    } catch (e) {
      if (e instanceof Error) {
        const status = e.message.includes('not found') ? 404 : 400
        return c.json(
          { error: status === 404 ? 'Not Found' : 'Bad Request', message: e.message },
          status,
        )
      }
      throw e
    }
  })
  .openapi(postBulkAssignRoute, async (c) => {
    const body = c.req.valid('json')
    try {
      const rows = await assignmentService.bulkAssign({ items: body.items })
      return c.json(AssignmentMapper.toDTOs(rows)) as any
    } catch (e) {
      if (e instanceof Error) {
        const isNotFound =
          e.message.startsWith('Inspection not found') || e.message.includes('not found')
        const status = isNotFound ? 404 : 400
        return c.json(
          { error: status === 404 ? 'Not Found' : 'Bad Request', message: e.message },
          status,
        )
      }
      throw e
    }
  })
  .openapi(getWorkloadRoute, async (c) => {
    const q = c.req.valid('query')
    const workload = await assignmentService.getWorkload(q.userId, {
      from: new Date(q.from),
      to: new Date(q.to),
    })
    const dto = {
      userId: workload.userId,
      scheduledCount: workload.scheduledCount,
      inspections: workload.inspections.map((i) => ({
        inspectionId: i.inspectionId,
        scheduledDate: i.scheduledDate.toISOString(),
        status: i.status,
      })),
    }
    return c.json(dto) as any
  })

export default app
