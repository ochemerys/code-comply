import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  AdminDashboardPayloadSchema,
  AdminInspectionMonitorPayloadSchema,
  AdminOrderAlertListItemSchema,
  AdminOrderDetailSchema,
  AdminOrderOverrideLockOutBodySchema,
  AdminOrdersSummarySchema,
} from '@codecomply/validators'
import { adminDashboardService } from '../../services/admin-dashboard.service.js'
import { orderEscalationService } from '../../services/order-escalation.service.js'

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Admin'],
  summary: 'List active Stop Work / unsafe condition orders',
  responses: {
    200: {
      description: 'Active order alerts',
      content: { 'application/json': { schema: z.array(AdminOrderAlertListItemSchema) } },
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

const summaryRoute = createRoute({
  method: 'get',
  path: '/summary',
  tags: ['Admin'],
  summary: 'Stop Work summary for dashboard red-flag polling',
  responses: {
    200: {
      description: 'Summary',
      content: { 'application/json': { schema: AdminOrdersSummarySchema } },
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

const dashboardRoute = createRoute({
  method: 'get',
  path: '/dashboard',
  tags: ['Admin'],
  summary: 'Admin home dashboard payload',
  responses: {
    200: {
      description: 'Dashboard',
      content: { 'application/json': { schema: AdminDashboardPayloadSchema } },
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

const monitorRoute = createRoute({
  method: 'get',
  path: '/inspection-monitor',
  tags: ['Admin'],
  summary: 'Inspection monitor rows with live Stop Work flags',
  responses: {
    200: {
      description: 'Monitor payload',
      content: { 'application/json': { schema: AdminInspectionMonitorPayloadSchema } },
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

const detailRoute = createRoute({
  method: 'get',
  path: '/{deficiencyId}',
  tags: ['Admin'],
  summary: 'Stop Work order detail (appeal deadline, deliveries, lock-out)',
  request: {
    params: z.object({
      deficiencyId: z
        .string()
        .min(1)
        .openapi({ param: { name: 'deficiencyId', in: 'path' } }),
    }),
  },
  responses: {
    200: {
      description: 'Order detail',
      content: { 'application/json': { schema: AdminOrderDetailSchema } },
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

const overrideRoute = createRoute({
  method: 'post',
  path: '/{deficiencyId}/override-lockout',
  tags: ['Admin'],
  summary: 'Senior SCO lock-out override (audit trail)',
  request: {
    params: z.object({
      deficiencyId: z
        .string()
        .min(1)
        .openapi({ param: { name: 'deficiencyId', in: 'path' } }),
    }),
    body: { content: { 'application/json': { schema: AdminOrderOverrideLockOutBodySchema } } },
  },
  responses: {
    200: {
      description: 'Lock-out cleared',
      content: { 'application/json': { schema: z.object({ lockedOut: z.boolean() }) } },
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

export default new OpenAPIHono()
  .openapi(listRoute, async (c) => {
    try {
      const alerts = await orderEscalationService.listActiveAlerts()
      return c.json(alerts) as any
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[AdminOrders] list:', error)
      return c.json({ error: 'Failed to list orders', message }, 500) as any
    }
  })
  .openapi(summaryRoute, async (c) => {
    try {
      const summary = await orderEscalationService.getSummary()
      return c.json(summary) as any
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[AdminOrders] summary:', error)
      return c.json({ error: 'Failed to load order summary', message }, 500) as any
    }
  })
  .openapi(dashboardRoute, async (c) => {
    try {
      const payload = await adminDashboardService.getPayload()
      return c.json(payload) as any
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[AdminOrders] dashboard:', error)
      return c.json({ error: 'Failed to load dashboard', message }, 500) as any
    }
  })
  .openapi(monitorRoute, async (c) => {
    try {
      const payload = await adminDashboardService.getInspectionMonitorPayload()
      return c.json(payload) as any
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[AdminOrders] inspection-monitor:', error)
      return c.json({ error: 'Failed to load inspection monitor', message }, 500) as any
    }
  })
  .openapi(detailRoute, async (c) => {
    const { deficiencyId } = c.req.valid('param')
    try {
      const detail = await orderEscalationService.getDetail(deficiencyId)
      return c.json(detail) as any
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      if (message === 'Order not found') {
        return c.json({ error: 'Not Found', message }, 404) as any
      }
      console.error('[AdminOrders] detail:', error)
      return c.json({ error: 'Failed to load order', message }, 500) as any
    }
  })
  .openapi(overrideRoute, async (c) => {
    const { deficiencyId } = c.req.valid('param')
    const body = c.req.valid('json')
    const userId = c.get('userId') as string
    try {
      const result = await orderEscalationService.overrideLockOut(deficiencyId, userId, body.reason)
      return c.json(result) as any
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      if (message === 'Order not found' || message === 'Escalation record not found') {
        return c.json({ error: 'Not Found', message }, 404) as any
      }
      if (message === 'Forbidden' || message.includes('Senior SCO')) {
        return c.json({ error: 'Forbidden', message }, 403) as any
      }
      console.error('[AdminOrders] override-lockout:', error)
      return c.json({ error: 'Failed to override lock-out', message }, 500) as any
    }
  })
