import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  AddendumDTOSchema,
  AdminInspectionRecordDetailSchema,
  AdminInspectionWorkflowDetailSchema,
  AdminNoEntryLetterRequestSchema,
  AdminNoEntryLetterResponseSchema,
  CreateAddendumRequestSchema,
  InspectionCertificationSnapshotSchema,
  UpdateAdminInspectionWorkflowSchema,
} from '@codecomply/validators'
import { inspectionCertificationSnapshotService } from '../../services/inspection-certification-snapshot.service.js'
import { adminInspectionRecordService } from '../../services/admin-inspection-record.service.js'
import { inspectionService } from '../../services/inspection.service.js'
import { inspectionWorkflowService } from '../../services/inspection-workflow.service.js'

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  code: z.string().optional(),
})

function mapAddendumError(error: unknown): {
  status: 400 | 404 | 403 | 500
  body: { error: string; message?: string }
} {
  const message = error instanceof Error ? error.message : 'Unknown error'
  if (message.includes('not found')) {
    return { status: 404, body: { error: message } }
  }
  if (message.includes('Unauthorized')) {
    return { status: 403, body: { error: message } }
  }
  if (message.includes('finalized')) {
    return { status: 400, body: { error: message } }
  }
  return { status: 500, body: { error: 'Failed to create addendum', message } }
}

const getCertificationSnapshotRoute = createRoute({
  method: 'get',
  path: '/{id}/certification-snapshot',
  tags: ['Admin'],
  summary: 'Get certification snapshot captured at inspection finalization (admin)',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: 'Certification snapshot',
      content: { 'application/json': { schema: InspectionCertificationSnapshotSchema } },
    },
    404: {
      description: 'Not found',
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
  },
})

const getRecordDetailRoute = createRoute({
  method: 'get',
  path: '/{id}/record',
  tags: ['Admin'],
  summary: 'Get read-only inspection record for compliance browser (admin)',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: 'Inspection record detail',
      content: { 'application/json': { schema: AdminInspectionRecordDetailSchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const getAddendumRoute = createRoute({
  method: 'get',
  path: '/{id}/addendums/{addendumId}',
  tags: ['Admin'],
  summary: 'Get addendum detail (admin)',
  request: {
    params: z.object({
      id: z.string(),
      addendumId: z.string(),
    }),
  },
  responses: {
    200: {
      description: 'Addendum',
      content: { 'application/json': { schema: AddendumDTOSchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const getWorkflowRoute = createRoute({
  method: 'get',
  path: '/{id}/workflow',
  tags: ['Admin'],
  summary: 'Get legacy inspection workflow (dates, stages, unable-to-enter) for admin',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: 'Inspection workflow detail',
      content: { 'application/json': { schema: AdminInspectionWorkflowDetailSchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const patchWorkflowRoute = createRoute({
  method: 'patch',
  path: '/{id}/workflow',
  tags: ['Admin'],
  summary: 'Update legacy inspection workflow fields (admin)',
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { 'application/json': { schema: UpdateAdminInspectionWorkflowSchema } },
    },
  },
  responses: {
    200: {
      description: 'Updated workflow',
      content: { 'application/json': { schema: AdminInspectionWorkflowDetailSchema } },
    },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const postNoEntryLetterRoute = createRoute({
  method: 'post',
  path: '/{id}/no-entry-letter',
  tags: ['Admin'],
  summary: 'Generate No Entry letter PDF and optionally email owner',
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { 'application/json': { schema: AdminNoEntryLetterRequestSchema } },
    },
  },
  responses: {
    201: {
      description: 'No Entry letter generated',
      content: { 'application/json': { schema: AdminNoEntryLetterResponseSchema } },
    },
    400: {
      description: 'Invalid request',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const createAddendumRoute = createRoute({
  method: 'post',
  path: '/{id}/addendum',
  tags: ['Admin'],
  summary: 'Create inspection addendum (admin)',
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: CreateAddendumRequestSchema,
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
      description: 'Invalid request or inspection not finalized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const app = new OpenAPIHono()
  .openapi(getCertificationSnapshotRoute, async (c) => {
    const { id } = c.req.valid('param')
    const snapshot = await inspectionCertificationSnapshotService.getByInspectionId(id)
    if (!snapshot) {
      return c.json({ error: 'Not Found', message: 'Inspection not found' }, 404)
    }
    return c.json(snapshot) as any
  })
  .openapi(getWorkflowRoute, async (c) => {
    const { id } = c.req.valid('param')
    const detail = await inspectionWorkflowService.getAdminDetail(id)
    if (!detail) {
      return c.json({ error: 'Not Found', message: 'Inspection not found' }, 404)
    }
    return c.json(detail) as any
  })
  .openapi(patchWorkflowRoute, async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    try {
      const detail = await inspectionWorkflowService.updateAdmin(id, body)
      return c.json(detail) as any
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update failed'
      if (message.includes('not found')) {
        return c.json({ error: message }, 404) as any
      }
      return c.json({ error: message }, 400) as any
    }
  })
  .openapi(postNoEntryLetterRoute, async (c) => {
    const { id } = c.req.valid('param')
    const userId = c.get('userId')
    const body = c.req.valid('json')
    try {
      const result = await inspectionWorkflowService.generateAndDistributeNoEntryLetter(
        id,
        userId,
        body.ownerEmail,
      )
      return c.json(result, 201) as any
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate letter'
      if (message.includes('not found')) {
        return c.json({ error: message }, 404) as any
      }
      return c.json({ error: message }, 400) as any
    }
  })
  .openapi(getRecordDetailRoute, async (c) => {
    const { id } = c.req.valid('param')
    const record = await adminInspectionRecordService.getRecordDetail(id)
    if (!record) {
      return c.json({ error: 'Not Found', message: 'Inspection not found' }, 404)
    }
    return c.json(record) as any
  })
  .openapi(getAddendumRoute, async (c) => {
    const { id, addendumId } = c.req.valid('param')
    const addendum = await adminInspectionRecordService.getAddendum(id, addendumId)
    if (!addendum) {
      return c.json({ error: 'Not Found', message: 'Addendum not found' }, 404)
    }
    return c.json(addendum) as any
  })
  .openapi(createAddendumRoute, async (c) => {
    const { id } = c.req.valid('param')
    const userId = c.get('userId')
    const body = c.req.valid('json')
    try {
      const addendum = await inspectionService.createAddendum(id, userId, body)
      const detail = await adminInspectionRecordService.getAddendum(id, addendum.id)
      return c.json(
        detail ?? {
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
      const mapped = mapAddendumError(error)
      return c.json(mapped.body, mapped.status) as any
    }
  })

export default app
