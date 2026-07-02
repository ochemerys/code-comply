import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { prisma } from '@codecomply/db'

const app = new OpenAPIHono()

// Health check response schema
const HealthResponseSchema = z.object({
  status: z.string(),
  timestamp: z.string().datetime(),
  database: z.string(),
})

// Error response schema
const ErrorResponseSchema = z.object({
  error: z.string(),
})

// Health check route
const healthRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Health'],
  summary: 'Health check',
  description: 'Check the health status of the API and database connection',
  responses: {
    200: {
      description: 'API is healthy',
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
    },
    503: {
      description: 'Service unavailable',
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
    },
  },
})

app.openapi(healthRoute, async (c) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`

    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
    })
  } catch (error) {
    return c.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
      },
      503,
    )
  }
})

export default app
