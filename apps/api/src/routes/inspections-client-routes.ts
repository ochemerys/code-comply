/**
 * Chained inspection routes for Hono RPC typing (`hc<AppType>`).
 * Runtime server mounts the full `inspections.ts` router; keep paths in sync.
 */
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  DocumentDTOSchema,
  InspectionListDTOSchema,
  InspectionSearchQuerySchema,
  ReportDTOSchema,
} from '@codecomply/validators'
import { documentService } from '../services/document.service.js'
import { DocumentMapper } from '../mappers/document.mapper.js'
import { inspectionService } from '../services/inspection.service.js'
import { InspectionMapper } from '../mappers/inspection.mapper.js'
import { reportService } from '../services/report.service.js'
import { ReportMapper } from '../mappers/report.mapper.js'

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

const listInspectionsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Inspections'],
  summary: 'List inspections',
  request: { query: InspectionSearchQuerySchema },
  responses: {
    200: {
      description: 'List of inspections',
      content: { 'application/json': { schema: z.array(InspectionListDTOSchema) } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Failed to list inspections',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const listInspectionDocumentsRoute = createRoute({
  method: 'get',
  path: '/{id}/documents',
  tags: ['Inspections'],
  summary: 'List inspection documents',
  request: {
    params: z.object({
      id: z
        .string()
        .min(1)
        .openapi({ param: { name: 'id', in: 'path' } }),
    }),
  },
  responses: {
    200: {
      description: 'Documents',
      content: { 'application/json': { schema: z.array(DocumentDTOSchema) } },
    },
    403: {
      description: 'Unauthorized access to inspection',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Inspection not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Failed to list documents',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const listInspectionReportsRoute = createRoute({
  method: 'get',
  path: '/{id}/reports',
  tags: ['Inspections'],
  summary: 'List inspection reports',
  request: {
    params: z.object({
      id: z
        .string()
        .min(1)
        .openapi({ param: { name: 'id', in: 'path' } }),
    }),
  },
  responses: {
    200: {
      description: 'Reports',
      content: { 'application/json': { schema: z.array(ReportDTOSchema) } },
    },
    403: {
      description: 'Unauthorized access to inspection',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Inspection not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Failed to list reports',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const app = new OpenAPIHono()
  .openapi(listInspectionsRoute, async (c) => {
    const query = c.req.valid('query')
    const userId = c.get('userId')
    try {
      let inspections
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
        inspections = await inspectionService.list({
          permitId: query.permitId,
          status: query.status,
          assignedToId: query.assignedInspectorId,
          limit: query.limit,
          offset: query.offset,
        })
      }
      return c.json(InspectionMapper.toListDTOs(inspections)) as any
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[InspectionsController] Error listing inspections:', error)
      return c.json({ error: 'Failed to list inspections', message }, 500) as any
    }
  })
  .openapi(listInspectionDocumentsRoute, async (c) => {
    const { id } = c.req.valid('param')
    const userId = c.get('userId')
    try {
      const inspection = await inspectionService.getById(id, userId)
      if (!inspection) {
        return c.json({ error: 'Inspection not found' }, 404) as any
      }
      const docs = await documentService.getByInspection(id)
      return c.json(DocumentMapper.toDTOs(docs)) as any
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      if (message.includes('Unauthorized')) {
        return c.json({ error: message }, 403) as any
      }
      return c.json({ error: 'Failed to list documents', message }, 500) as any
    }
  })
  .openapi(listInspectionReportsRoute, async (c) => {
    const { id } = c.req.valid('param')
    const userId = c.get('userId')
    try {
      const inspection = await inspectionService.getById(id, userId)
      if (!inspection) {
        return c.json({ error: 'Inspection not found' }, 404) as any
      }
      const reports = await reportService.listForInspection(id)
      return c.json(
        ReportMapper.toDTOs(reports, { inspectionUniqueId: inspection.uniqueId }),
      ) as any
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      if (message.includes('Unauthorized')) {
        return c.json({ error: message }, 403) as any
      }
      console.error('[InspectionsController] Error listing reports:', error)
      return c.json({ error: 'Failed to list reports', message }, 500) as any
    }
  })

export default app
