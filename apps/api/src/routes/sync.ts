import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import {
  PushRequestSchema,
  PushResponseSchema,
  PullQuerySchema,
  PullResponseSchema,
  type PushResponse,
  type PullResponse,
} from '@codecomply/validators'
import { syncService } from '../services/sync.service.js'

const app = new OpenAPIHono()

// Error response schema
const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

/**
 * POST /api/sync/push
 * Push batch of mutations from client to server
 */
const pushRoute = createRoute({
  method: 'post',
  path: '/push',
  tags: ['Sync'],
  summary: 'Push batch mutations',
  description: 'Push batch of mutations from client to server with deduplication support',
  request: {
    body: {
      content: {
        'application/json': {
          schema: PushRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Mutations processed successfully',
      content: {
        'application/json': {
          schema: PushResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Failed to process sync push',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

app.openapi(pushRoute, async (c) => {
  const { mutations } = c.req.valid('json')
  const userId = c.get('userId') // From auth middleware

  try {
    // Process mutations via service
    const results = await syncService.processPushMutations(mutations, userId)

    // Build response
    const response: PushResponse = {
      results,
      timestamp: new Date().toISOString(),
    }

    return c.json(response, 200)
  } catch (error: any) {
    console.error('[SyncRoutes] Error processing push:', error)
    return c.json(
      {
        error: 'Failed to process sync push',
        message: error.message,
      },
      500,
    )
  }
})

/**
 * GET /api/sync/pull
 * Pull changes from server since last sync
 */
const pullRoute = createRoute({
  method: 'get',
  path: '/pull',
  tags: ['Sync'],
  summary: 'Pull delta changes',
  description: 'Pull changes from server since last sync timestamp',
  request: {
    query: PullQuerySchema,
  },
  responses: {
    200: {
      description: 'Changes retrieved successfully',
      content: {
        'application/json': {
          schema: PullResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Failed to process sync pull',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

app.openapi(pullRoute, async (c) => {
  const { since, limit } = c.req.valid('query')
  const userId = c.get('userId') // From auth middleware

  try {
    // Parse since timestamp
    const sinceDate = since ? new Date(since) : null

    // Get changes via service
    const { changes, hasMore } = await syncService.getPullChanges(sinceDate, limit, userId)

    // Build response
    const response: PullResponse = {
      changes,
      timestamp: new Date().toISOString(),
      hasMore,
    }

    return c.json(response, 200)
  } catch (error: any) {
    console.error('[SyncRoutes] Error processing pull:', error)
    return c.json(
      {
        error: 'Failed to process sync pull',
        message: error.message,
      },
      500,
    )
  }
})

export default app
