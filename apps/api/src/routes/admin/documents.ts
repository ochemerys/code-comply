import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  DocumentEmailResultSchema,
  DocumentDTOSchema,
  EmailInspectionDocumentDTOSchema,
  SignInspectionDocumentDTOSchema,
  SignReportDTOSchema,
  ReportDTOSchema,
} from '@codecomply/validators'
import { DocumentMapper } from '../../mappers/document.mapper.js'
import { ReportMapper } from '../../mappers/report.mapper.js'
import { documentWorkflowService } from '../../services/document-workflow.service.js'
import { inspectionService } from '../../services/inspection.service.js'
import { reportService } from '../../services/report.service.js'

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

const IdParamSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({ param: { name: 'id', in: 'path' }, example: 'doc-1' }),
})

const emailRoute = createRoute({
  method: 'post',
  path: '/{id}/email',
  tags: ['Admin'],
  summary: 'Email an uploaded inspection document',
  request: {
    params: IdParamSchema,
    body: {
      content: { 'application/json': { schema: EmailInspectionDocumentDTOSchema } },
    },
  },
  responses: {
    200: {
      description: 'Email delivery result',
      content: { 'application/json': { schema: DocumentEmailResultSchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const signDocumentRoute = createRoute({
  method: 'post',
  path: '/{id}/sign',
  tags: ['Admin'],
  summary: 'Apply electronic signature to an uploaded document',
  request: {
    params: IdParamSchema,
    body: {
      content: { 'application/json': { schema: SignInspectionDocumentDTOSchema } },
    },
  },
  responses: {
    200: {
      description: 'Signed document metadata',
      content: { 'application/json': { schema: DocumentDTOSchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const signReportRoute = createRoute({
  method: 'post',
  path: '/reports/{id}/sign',
  tags: ['Admin'],
  summary: 'Apply electronic signature to a generated report',
  request: {
    params: IdParamSchema,
    body: {
      content: { 'application/json': { schema: SignReportDTOSchema } },
    },
  },
  responses: {
    200: {
      description: 'Signed report metadata',
      content: { 'application/json': { schema: ReportDTOSchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const app = new OpenAPIHono()
  .openapi(emailRoute, async (c) => {
    const userId = c.get('userId')
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')

    try {
      const result = await documentWorkflowService.emailInspectionDocument(id, body, userId)
      return c.json(result, 200) as any
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Email failed'
      return c.json({ error: message }, 404) as any
    }
  })
  .openapi(signDocumentRoute, async (c) => {
    const userId = c.get('userId')
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')

    try {
      const doc = await documentWorkflowService.signInspectionDocument(id, body, userId)
      return c.json(DocumentMapper.toDTO(doc), 200) as any
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign failed'
      return c.json({ error: message }, 404) as any
    }
  })
  .openapi(signReportRoute, async (c) => {
    const userId = c.get('userId')
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')

    try {
      const report = await reportService.getById(id)
      if (!report) {
        return c.json({ error: 'Report not found' }, 404) as any
      }
      const inspection = await inspectionService.getById(report.inspectionId, userId)
      if (!inspection) {
        return c.json({ error: 'Inspection not found' }, 404) as any
      }

      await documentWorkflowService.signReport(id, body, userId)
      const updated = await reportService.getById(id)
      return c.json(
        ReportMapper.toDTO(updated!, { inspectionUniqueId: inspection.uniqueId }),
        200,
      ) as any
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign failed'
      return c.json({ error: message }, 404) as any
    }
  })

export default app
