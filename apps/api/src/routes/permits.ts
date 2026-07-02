import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  PermitSearchQuerySchema,
  PermitGPSSearchSchema,
  PermitListDTOSchema,
  PermitDTOSchema,
} from '@codecomply/validators'
import { permitService } from '../services/permit.service.js'
import { permitTriageService } from '../services/permit-triage.service.js'
import { PermitMapper } from '../mappers/permit.mapper.js'

const app = new OpenAPIHono()

// Error response schema
const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

/**
 * GET /api/permits
 * List permits with optional filters
 */
const listPermitsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Permits'],
  summary: 'List permits',
  description:
    'List permits with optional filters for permit number, address, status, and pagination',
  request: {
    query: PermitSearchQuerySchema,
  },
  responses: {
    200: {
      description: 'List of permits',
      content: {
        'application/json': {
          schema: z.array(PermitListDTOSchema),
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
      description: 'Failed to list permits',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

app.openapi(listPermitsRoute, async (c) => {
  const query = c.req.valid('query')

  try {
    // Call service
    const permits = await permitService.search({
      permitNumber: query.permitNumber,
      address: query.address,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    })

    const triageByPermitId = await permitTriageService.buildTriageSummariesForPermits(permits)
    const dtos = PermitMapper.toListDTOs(permits, triageByPermitId)

    return c.json(dtos) as any
  } catch (error: any) {
    console.error('[PermitsController] Error listing permits:', error)
    return c.json(
      {
        error: 'Failed to list permits',
        message: error.message,
      },
      500,
    ) as any
  }
})

/**
 * GET /api/permits/nearby
 * Find permits near a GPS location
 */
const nearbyPermitsRoute = createRoute({
  method: 'get',
  path: '/nearby',
  tags: ['Permits'],
  summary: 'Find nearby permits',
  description:
    'Find permits near a GPS location using latitude and longitude. Returns permits sorted by distance.',
  request: {
    query: PermitGPSSearchSchema,
  },
  responses: {
    200: {
      description: 'List of nearby permits sorted by distance',
      content: {
        'application/json': {
          schema: z.array(PermitListDTOSchema),
        },
      },
    },
    400: {
      description: 'Invalid GPS coordinates',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
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
      description: 'Failed to find nearby permits',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

app.openapi(nearbyPermitsRoute, async (c) => {
  const query = c.req.valid('query')

  try {
    // Call service
    const { permits, totalWithCoordinates } = await permitService.findNearby(
      query.latitude,
      query.longitude,
      query.radius,
      query.status,
      query.limit,
    )

    // Map to DTOs (includes distance)
    const dtos = PermitMapper.toListDTOs(permits)

    // When empty, tell frontend how many permits have coords (for better empty-state messaging)
    if (dtos.length === 0) {
      c.header('X-Permits-With-Coordinates', String(totalWithCoordinates))
    }

    return c.json(dtos) as any
  } catch (error: any) {
    console.error('[PermitsController] Error finding nearby permits:', error)
    return c.json(
      {
        error: 'Failed to find nearby permits',
        message: error.message,
      },
      500,
    ) as any
  }
})

/**
 * GET /api/permits/assigned
 * Permits for inspections assigned to the authenticated inspector
 */
const assignedPermitsRoute = createRoute({
  method: 'get',
  path: '/assigned',
  tags: ['Permits'],
  summary: 'My assigned permits',
  description:
    'Returns distinct permits where the current user is assigned on at least one inspection schedule (inspector field workflow).',
  responses: {
    200: {
      description: 'Permit list DTOs (no distance)',
      content: {
        'application/json': {
          schema: z.array(PermitListDTOSchema),
        },
      },
    },
    401: {
      description: 'Unauthorized or missing user context',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

app.openapi(assignedPermitsRoute, async (c) => {
  const userId = c.get('userId')
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401) as any
  }

  try {
    const permits = await permitService.findAssignedToInspector(userId)
    const dtos = PermitMapper.toListDTOs(permits)
    return c.json(dtos) as any
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[PermitsController] assigned permits:', error)
    return c.json({ error: 'Failed to list assigned permits', message }, 500) as any
  }
})

/**
 * GET /api/permits/:id
 * Get permit details by ID
 */
const getPermitRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Permits'],
  summary: 'Get permit details',
  description: 'Get full permit details including inspections by permit ID',
  request: {
    params: z.object({
      id: z
        .string()
        .min(1)
        .openapi({
          param: {
            name: 'id',
            in: 'path',
          },
          example: 'permit-123',
        }),
    }),
  },
  responses: {
    200: {
      description: 'Permit details',
      content: {
        'application/json': {
          schema: PermitDTOSchema,
        },
      },
    },
    404: {
      description: 'Permit not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
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
      description: 'Failed to get permit',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

app.openapi(getPermitRoute, async (c) => {
  const { id } = c.req.valid('param')

  try {
    // Call service
    const permit = await permitService.getById(id)

    if (!permit) {
      return c.json({ error: 'Permit not found' }, 404) as any
    }

    // Map to DTO
    const dto = PermitMapper.toDTO(permit)

    return c.json(dto) as any
  } catch (error: any) {
    console.error('[PermitsController] Error getting permit:', error)
    return c.json(
      {
        error: 'Failed to get permit',
        message: error.message,
      },
      500,
    ) as any
  }
})

export default app
