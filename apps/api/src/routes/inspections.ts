import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  InspectionSearchQuerySchema,
  InspectionDTOSchema,
  InspectionListDTOSchema,
  DocumentDTOSchema,
  ReportDTOSchema,
  InspectionReviewDTOSchema,
  ValidationResultDTOSchema,
  InspectorUnableToEnterRequestSchema,
  InspectorUnableToEnterResponseSchema,
} from '@codecomply/validators'
import { inspectionService } from '../services/inspection.service.js'
import { inspectionWorkflowService } from '../services/inspection-workflow.service.js'
import { InspectionMapper } from '../mappers/inspection.mapper.js'
import { documentService } from '../services/document.service.js'
import { DocumentMapper } from '../mappers/document.mapper.js'
import { reportService } from '../services/report.service.js'
import { ReportMapper } from '../mappers/report.mapper.js'
import type { GPSCoordinates } from '../services/inspection.service.js'
import { inspectionValidationService } from '../services/inspection-validation.service.js'
import { ImmutableInspectionError } from '../middleware/immutable.js'

let app = new OpenAPIHono()

function mapInspectionWriteError(error: unknown): {
  status: 409 | 404 | 403 | 400 | 500
  body: { error: string; code?: string; message?: string }
} {
  if (error instanceof ImmutableInspectionError) {
    return {
      status: 409,
      body: { error: error.message, code: error.code },
    }
  }
  const message = error instanceof Error ? error.message : 'Unknown error'
  if (message.includes('not found')) {
    return { status: 404, body: { error: message } }
  }
  if (message.includes('Unauthorized') || message.includes('not assigned')) {
    return { status: 403, body: { error: message } }
  }
  if (message.includes('finalized inspection')) {
    return { status: 400, body: { error: message } }
  }
  return { status: 500, body: { error: 'Internal error', message } }
}

// Error response schema
const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

// GPS Coordinates Schema for validation
const GPSCoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90).openapi({
    example: 51.0447,
    description: 'Latitude coordinate',
  }),
  longitude: z.number().min(-180).max(180).openapi({
    example: -114.0719,
    description: 'Longitude coordinate',
  }),
  accuracy: z.number().positive().optional().openapi({
    example: 10,
    description: 'GPS accuracy in meters',
  }),
  timestamp: z.string().datetime().openapi({
    example: '2024-01-15T10:30:00Z',
    description: 'ISO 8601 timestamp',
  }),
})

/**
 * GET /api/inspections
 * List inspections with optional filters
 */
const listInspectionsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Inspections'],
  summary: 'List inspections',
  description:
    'List inspections with optional filters. If no filters provided, returns inspections assigned to the current user.',
  request: {
    query: InspectionSearchQuerySchema,
  },
  responses: {
    200: {
      description: 'List of inspections',
      content: {
        'application/json': {
          schema: z.array(InspectionListDTOSchema),
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
      description: 'Failed to list inspections',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

app = app.openapi(listInspectionsRoute, async (c) => {
  const query = c.req.valid('query')
  const userId = c.get('userId') // From auth middleware

  try {
    let inspections

    // If no filters provided, return user's assigned inspections
    if (
      !query.permitId &&
      !query.status &&
      !query.assignedInspectorId &&
      !query.scheduledAfter &&
      !query.scheduledBefore
    ) {
      inspections = await inspectionService.getAssigned(userId, {
        limit: query.limit,
        offset: query.offset,
      })
    } else {
      // Otherwise, use provided filters
      inspections = await inspectionService.list({
        permitId: query.permitId,
        status: query.status,
        assignedToId: query.assignedInspectorId,
        limit: query.limit,
        offset: query.offset,
      })
    }

    // Map to DTOs
    const dtos = InspectionMapper.toListDTOs(inspections)

    return c.json(dtos) as any
  } catch (error: any) {
    console.error('[InspectionsController] Error listing inspections:', error)
    return c.json(
      {
        error: 'Failed to list inspections',
        message: error.message,
      },
      500,
    ) as any
  }
})

/**
 * GET /api/inspections/:id/documents
 * List documents attached to an inspection
 */
const listInspectionDocumentsRoute = createRoute({
  method: 'get',
  path: '/{id}/documents',
  tags: ['Inspections'],
  summary: 'List inspection documents',
  description: 'Returns metadata for all documents uploaded for this inspection.',
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
          example: 'insp-123',
        }),
    }),
  },
  responses: {
    200: {
      description: 'Documents',
      content: {
        'application/json': {
          schema: z.array(DocumentDTOSchema),
        },
      },
    },
    403: {
      description: 'Unauthorized access to inspection',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Inspection not found',
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
      description: 'Failed to list documents',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

app = app.openapi(listInspectionDocumentsRoute, async (c) => {
  const { id } = c.req.valid('param')
  const userId = c.get('userId')

  try {
    const inspection = await inspectionService.getById(id, userId)
    if (!inspection) {
      return c.json({ error: 'Inspection not found' }, 404) as any
    }

    const docs = await documentService.getByInspection(id)
    return c.json(DocumentMapper.toDTOs(docs)) as any
  } catch (error: any) {
    if (error.message?.includes('Unauthorized')) {
      return c.json({ error: error.message }, 403) as any
    }

    console.error('[InspectionsController] Error listing documents:', error)
    return c.json(
      {
        error: 'Failed to list documents',
        message: error.message,
      },
      500,
    ) as any
  }
})

/**
 * GET /api/inspections/:id/reports
 * List generated reports for an inspection
 */
const listInspectionReportsRoute = createRoute({
  method: 'get',
  path: '/{id}/reports',
  tags: ['Inspections'],
  summary: 'List inspection reports',
  description: 'Returns metadata for all PDF reports generated for this inspection.',
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
          example: 'insp-123',
        }),
    }),
  },
  responses: {
    200: {
      description: 'Reports',
      content: {
        'application/json': {
          schema: z.array(ReportDTOSchema),
        },
      },
    },
    403: {
      description: 'Unauthorized access to inspection',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Inspection not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Failed to list reports',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

app = app.openapi(listInspectionReportsRoute, async (c) => {
  const { id } = c.req.valid('param')
  const userId = c.get('userId')

  try {
    const inspection = await inspectionService.getById(id, userId)
    if (!inspection) {
      return c.json({ error: 'Inspection not found' }, 404) as any
    }

    const reports = await reportService.listForInspection(id)
    return c.json(ReportMapper.toDTOs(reports, { inspectionUniqueId: inspection.uniqueId })) as any
  } catch (error: any) {
    if (error.message?.includes('Unauthorized')) {
      return c.json({ error: error.message }, 403) as any
    }

    console.error('[InspectionsController] Error listing reports:', error)
    return c.json(
      {
        error: 'Failed to list reports',
        message: error.message,
      },
      500,
    ) as any
  }
})

/**
 * GET /api/inspections/:id
 * Get inspection details by ID
 */
const getInspectionRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Inspections'],
  summary: 'Get inspection details',
  description:
    'Get full inspection details including permit, deficiencies, and assignment. Access control: Admins can view any inspection, inspectors can only view their assigned inspections.',
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
          example: 'insp-123',
        }),
    }),
  },
  responses: {
    200: {
      description: 'Inspection details',
      content: {
        'application/json': {
          schema: InspectionDTOSchema,
        },
      },
    },
    403: {
      description: 'Unauthorized access to inspection',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Inspection not found',
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
      description: 'Failed to get inspection',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

app = app.openapi(getInspectionRoute, async (c) => {
  const { id } = c.req.valid('param')
  const userId = c.get('userId') // From auth middleware

  try {
    // Call service (includes access control)
    const inspection = await inspectionService.getById(id, userId)

    if (!inspection) {
      return c.json({ error: 'Inspection not found' }, 404) as any
    }

    // Map to DTO
    const dto = InspectionMapper.toDTO(inspection)

    return c.json(dto) as any
  } catch (error: any) {
    if (error.message.includes('Unauthorized')) {
      return c.json({ error: error.message }, 403) as any
    }

    console.error('[InspectionsController] Error getting inspection:', error)
    return c.json(
      {
        error: 'Failed to get inspection',
        message: error.message,
      },
      500,
    ) as any
  }
})

/**
 * POST /api/inspections/:id/start
 * Start an inspection
 */
const startInspectionRoute = createRoute({
  method: 'post',
  path: '/{id}/start',
  tags: ['Inspections'],
  summary: 'Start an inspection',
  description:
    'Start an inspection with GPS coordinates. Business rules: Inspection must be in SCHEDULED status, user must be assigned to the inspection, GPS coordinates are recorded at start, optional geofence warning if outside configured radius.',
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
          example: 'insp-123',
        }),
    }),
    body: {
      content: {
        'application/json': {
          schema: GPSCoordinatesSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Inspection started successfully',
      content: {
        'application/json': {
          schema: InspectionDTOSchema,
        },
      },
    },
    400: {
      description: 'Invalid request or inspection cannot be started',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'User not assigned to this inspection',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Inspection not found',
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
      description: 'Failed to start inspection',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

app = app.openapi(startInspectionRoute, async (c) => {
  const { id } = c.req.valid('param')
  const userId = c.get('userId') // From auth middleware
  const gpsCoords = c.req.valid('json') as GPSCoordinates

  try {
    // Call service (includes business logic and validation)
    const inspection = await inspectionService.start(id, userId, gpsCoords)

    // Map to DTO
    const dto = InspectionMapper.toDTO(inspection)

    return c.json(dto, 200) as any
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return c.json({ error: error.message }, 404) as any
    }

    if (error.message.includes('not assigned') || error.message.includes('Unauthorized')) {
      return c.json({ error: error.message }, 403) as any
    }

    if (error.message.includes('Cannot start') || error.message.includes('Must be')) {
      return c.json({ error: error.message }, 400) as any
    }

    console.error('[InspectionsController] Error starting inspection:', error)
    return c.json(
      {
        error: 'Failed to start inspection',
        message: error.message,
      },
      500,
    ) as any
  }
})

/**
 * POST /api/inspections/:id/validate
 * Validate an inspection before submission/finalization
 */
const validateInspectionRoute = createRoute({
  method: 'post',
  path: '/{id}/validate',
  tags: ['Inspections'],
  summary: 'Validate an inspection',
  description: 'Runs pre-submit validation rules for an inspection.',
  request: {
    params: z.object({
      id: z
        .string()
        .min(1)
        .openapi({
          param: { name: 'id', in: 'path' },
          example: 'insp-123',
        }),
    }),
  },
  responses: {
    200: {
      description: 'Validation result',
      content: {
        'application/json': {
          schema: ValidationResultDTOSchema,
        },
      },
    },
    404: {
      description: 'Inspection not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Failed to validate inspection',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

app = app.openapi(validateInspectionRoute, async (c) => {
  const { id } = c.req.valid('param')
  const userId = c.get('userId')

  try {
    const inspection = await inspectionService.getById(id, userId)
    if (!inspection) return c.json({ error: 'Inspection not found' }, 404) as any

    const result = await inspectionValidationService.validate(id)
    return c.json(result, 200) as any
  } catch (error: any) {
    if (error.message?.includes('Unauthorized')) {
      return c.json({ error: error.message }, 403) as any
    }
    console.error('[InspectionsController] Error validating inspection:', error)
    return c.json({ error: 'Failed to validate inspection', message: error.message }, 500) as any
  }
})

/**
 * GET /api/inspections/:id/review
 * Return review payload (inspection DTO + validation)
 */
const reviewInspectionRoute = createRoute({
  method: 'get',
  path: '/{id}/review',
  tags: ['Inspections'],
  summary: 'Get inspection review payload',
  description:
    'Returns an inspection summary with validation results for a review-before-submit screen.',
  request: {
    params: z.object({
      id: z
        .string()
        .min(1)
        .openapi({
          param: { name: 'id', in: 'path' },
          example: 'insp-123',
        }),
    }),
  },
  responses: {
    200: {
      description: 'Inspection review payload',
      content: {
        'application/json': {
          schema: InspectionReviewDTOSchema,
        },
      },
    },
    403: {
      description: 'Unauthorized access to inspection',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Inspection not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Failed to get inspection review payload',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

app = app.openapi(reviewInspectionRoute, async (c) => {
  const { id } = c.req.valid('param')
  const userId = c.get('userId')

  try {
    const inspection = await inspectionService.getById(id, userId)
    if (!inspection) return c.json({ error: 'Inspection not found' }, 404) as any

    const dto = InspectionMapper.toDTO(inspection)
    const validation = await inspectionValidationService.validate(id)

    return c.json({ inspection: dto, validation }, 200) as any
  } catch (error: any) {
    if (error.message?.includes('Unauthorized')) {
      return c.json({ error: error.message }, 403) as any
    }
    console.error('[InspectionsController] Error getting inspection review:', error)
    return c.json({ error: 'Failed to get inspection review', message: error.message }, 500) as any
  }
})

/**
 * POST /api/inspections/:id/finalize
 * Finalize an inspection atomically
 */
const InspectionOutcomeSchema = z.enum(['PASSED', 'FAILED']).openapi({
  example: 'PASSED',
  description: 'Inspection outcome to finalize with',
})

const finalizeInspectionRoute = createRoute({
  method: 'post',
  path: '/{id}/finalize',
  tags: ['Inspections'],
  summary: 'Finalize an inspection',
  description:
    'Finalizes an inspection with legal integrity capture. Performs validation and persists finalization fields in a single transaction.',
  request: {
    params: z.object({
      id: z
        .string()
        .min(1)
        .openapi({
          param: { name: 'id', in: 'path' },
          example: 'insp-123',
        }),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            signature: z.string().min(1).openapi({
              example: 'base64-signature-or-token',
              description: 'Digital signature payload (format is client-defined)',
            }),
            outcome: InspectionOutcomeSchema,
            gps: GPSCoordinatesSchema,
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Finalized inspection',
      content: {
        'application/json': {
          schema: InspectionDTOSchema,
        },
      },
    },
    400: {
      description: 'Validation failed or inspection cannot be finalized',
      content: { 'application/json': { schema: ValidationResultDTOSchema } },
    },
    403: {
      description: 'Unauthorized access to inspection',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Inspection not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Failed to finalize inspection',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

app = app.openapi(finalizeInspectionRoute, async (c) => {
  const { id } = c.req.valid('param')
  const userId = c.get('userId')
  const body = c.req.valid('json') as { signature: string; outcome: 'PASSED' | 'FAILED'; gps: any }

  try {
    const inspection = await inspectionService.getById(id, userId)
    if (!inspection) return c.json({ error: 'Inspection not found' }, 404) as any

    const validation = await inspectionValidationService.validateForFinalize(id, {
      outcome: body.outcome,
      signature: body.signature,
      gpsCaptured: true,
    })

    if (!validation.isValid) {
      return c.json(validation, 400) as any
    }

    const finalized = await inspectionService.finalize(id, userId, {
      outcome: body.outcome,
      signature: body.signature,
      finalizeGps: body.gps as GPSCoordinates,
      certificationSnapshot: {
        outcome: body.outcome,
        signature: body.signature,
        gps: body.gps,
        finalizedAt: new Date().toISOString(),
      },
    })

    return c.json(InspectionMapper.toDTO(finalized), 200) as any
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return c.json({ error: error.message }, 404) as any
    }
    if (error.message?.includes('not assigned') || error.message?.includes('Unauthorized')) {
      return c.json({ error: error.message }, 403) as any
    }
    if (
      error.message?.includes('already finalized') ||
      error.message?.includes('Invalid outcome')
    ) {
      return c.json({ error: error.message }, 400) as any
    }

    console.error('[InspectionsController] Error finalizing inspection:', error)
    return c.json({ error: 'Failed to finalize inspection', message: error.message }, 500) as any
  }
})

const UpdateInspectionBodySchema = z.object({
  notes: z.string().optional(),
  scheduledDate: z.string().datetime().optional(),
})

const patchInspectionRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Inspections'],
  summary: 'Update inspection',
  description: 'Updates a non-finalized inspection. Finalized records are append-only (409).',
  request: {
    params: z.object({
      id: z
        .string()
        .min(1)
        .openapi({ param: { name: 'id', in: 'path' } }),
    }),
    body: {
      content: { 'application/json': { schema: UpdateInspectionBodySchema } },
    },
  },
  responses: {
    200: {
      description: 'Updated inspection',
      content: { 'application/json': { schema: InspectionDTOSchema } },
    },
    409: {
      description: 'Inspection is finalized and immutable',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

app = app.openapi(patchInspectionRoute, async (c) => {
  const { id } = c.req.valid('param')
  const userId = c.get('userId')
  const body = c.req.valid('json')
  try {
    const updated = await inspectionService.update(id, userId, body)
    return c.json(InspectionMapper.toDTO(updated), 200) as any
  } catch (error) {
    const mapped = mapInspectionWriteError(error)
    return c.json(mapped.body, mapped.status) as any
  }
})

const unableToEnterRoute = createRoute({
  method: 'post',
  path: '/{id}/unable-to-enter',
  tags: ['Inspections'],
  summary: 'Record field unable-to-enter attempt with GPS proof (LSC-A-03)',
  description:
    'Syncs geofence attendance and attempt timestamp without finalizing a Pass/Fail checklist.',
  request: {
    params: z.object({
      id: z
        .string()
        .min(1)
        .openapi({ param: { name: 'id', in: 'path' } }),
    }),
    body: {
      content: {
        'application/json': {
          schema: InspectorUnableToEnterRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Unable-to-enter attempt recorded',
      content: { 'application/json': { schema: InspectorUnableToEnterResponseSchema } },
    },
    404: {
      description: 'Inspection not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    400: {
      description: 'Invalid request',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

app = app.openapi(unableToEnterRoute, async (c) => {
  const { id } = c.req.valid('param')
  const userId = c.get('userId')
  const body = c.req.valid('json')
  try {
    const result = await inspectionWorkflowService.recordUnableToEnterFromField(id, userId, body)
    return c.json(result, 200) as any
  } catch (error) {
    const mapped = mapInspectionWriteError(error)
    return c.json(mapped.body, mapped.status) as any
  }
})

const deleteInspectionRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Inspections'],
  summary: 'Delete inspection',
  description: 'Deletes a non-finalized inspection. Finalized records cannot be deleted (409).',
  request: {
    params: z.object({
      id: z
        .string()
        .min(1)
        .openapi({ param: { name: 'id', in: 'path' } }),
    }),
  },
  responses: {
    204: { description: 'Deleted' },
    409: {
      description: 'Inspection is finalized and immutable',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

app = app.openapi(deleteInspectionRoute, async (c) => {
  const { id } = c.req.valid('param')
  const userId = c.get('userId')
  try {
    await inspectionService.delete(id, userId)
    return c.body(null, 204) as any
  } catch (error) {
    const mapped = mapInspectionWriteError(error)
    return c.json(mapped.body, mapped.status) as any
  }
})

const AddendumDTOSchema = z.object({
  id: z.string(),
  inspectionId: z.string(),
  reason: z.string(),
  content: z.string(),
  createdById: z.string(),
  createdAt: z.string().datetime(),
  signature: z.string().nullable().optional(),
})

const createAddendumRoute = createRoute({
  method: 'post',
  path: '/{id}/addendum',
  tags: ['Inspections'],
  summary: 'Create inspection addendum',
  description: 'Adds an amendment to a finalized inspection (append-only legal record).',
  request: {
    params: z.object({
      id: z
        .string()
        .min(1)
        .openapi({ param: { name: 'id', in: 'path' } }),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            reason: z.string().min(1),
            content: z.string().min(1),
            signature: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Addendum created',
      content: { 'application/json': { schema: AddendumDTOSchema } },
    },
    400: {
      description: 'Inspection not finalized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

app = app.openapi(createAddendumRoute, async (c) => {
  const { id } = c.req.valid('param')
  const userId = c.get('userId')
  const body = c.req.valid('json')
  try {
    const addendum = await inspectionService.createAddendum(id, userId, body)
    return c.json(
      {
        id: addendum.id,
        inspectionId: addendum.inspectionId,
        reason: addendum.reason,
        content: addendum.content,
        createdById: addendum.createdById,
        createdAt: addendum.createdAt.toISOString(),
        signature: addendum.signature,
      },
      201,
    ) as any
  } catch (error) {
    const mapped = mapInspectionWriteError(error)
    return c.json(mapped.body, mapped.status) as any
  }
})

export default app
