import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  GenerateReportDTOSchema,
  ReportDTOSchema,
  ReportDownloadUrlSchema,
  ReportExportFormatSchema,
} from '@codecomply/validators'
import { getReportSignedDownloadUrl } from '../services/document-workflow.service.js'
import { reportService, REPORT_SIGNED_URL_TTL_SECONDS } from '../services/report.service.js'
import { inspectionService } from '../services/inspection.service.js'
import { ReportMapper } from '../mappers/report.mapper.js'

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

function mapReportError(error: unknown): {
  status: 400 | 403 | 404 | 500
  body: { error: string; message?: string }
} {
  const message = error instanceof Error ? error.message : 'Unknown error'
  if (message.includes('not found')) {
    return { status: 404, body: { error: message } }
  }
  if (message.includes('Unauthorized')) {
    return { status: 403, body: { error: message } }
  }
  if (message.includes('not supported') || message.includes('required')) {
    return { status: 400, body: { error: message } }
  }
  return { status: 500, body: { error: 'Internal error', message } }
}

const generateReportRoute = createRoute({
  method: 'post',
  path: '/generate',
  tags: ['Reports'],
  summary: 'Generate and store a report PDF',
  request: {
    body: {
      content: { 'application/json': { schema: GenerateReportDTOSchema } },
    },
  },
  responses: {
    201: {
      description: 'Generated report metadata',
      content: { 'application/json': { schema: ReportDTOSchema } },
    },
    400: {
      description: 'Invalid request',
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
  },
})

const downloadReportRoute = createRoute({
  method: 'get',
  path: '/{id}/download',
  tags: ['Reports'],
  summary: 'Get signed download URL for a report',
  request: {
    params: z.object({
      id: z
        .string()
        .min(1)
        .openapi({ param: { name: 'id', in: 'path' } }),
    }),
    query: z.object({
      format: ReportExportFormatSchema.optional().openapi({
        param: { name: 'format', in: 'query' },
        example: 'pdf',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Signed URL',
      content: { 'application/json': { schema: ReportDownloadUrlSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const app = new OpenAPIHono()
  .openapi(generateReportRoute, async (c) => {
    const userId = c.get('userId')
    const body = c.req.valid('json')

    try {
      const inspection = await inspectionService.getById(body.inspectionId, userId)
      if (!inspection) {
        return c.json({ error: 'Inspection not found' }, 404) as any
      }

      const row = await reportService.generateAndStore(body)
      return c.json(
        ReportMapper.toDTO(row, { inspectionUniqueId: inspection.uniqueId }),
        201,
      ) as any
    } catch (error) {
      const mapped = mapReportError(error)
      return c.json(mapped.body, mapped.status) as any
    }
  })
  .openapi(downloadReportRoute, async (c) => {
    const { id } = c.req.valid('param')
    const { format } = c.req.valid('query')
    const userId = c.get('userId')

    try {
      const row = await reportService.getById(id)
      if (!row) {
        return c.json({ error: 'Report not found' }, 404) as any
      }

      const inspection = await inspectionService.getById(row.inspectionId, userId)
      if (!inspection) {
        return c.json({ error: 'Inspection not found' }, 404) as any
      }

      const url = await getReportSignedDownloadUrl(id, format ?? 'pdf')
      return c.json({ url, expiresIn: REPORT_SIGNED_URL_TTL_SECONDS }) as any
    } catch (error) {
      const mapped = mapReportError(error)
      return c.json(mapped.body, mapped.status) as any
    }
  })

export default app
