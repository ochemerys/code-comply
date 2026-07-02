import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { DistributeReportDTOSchema, ReportDistributionResultSchema } from '@codecomply/validators'
import { distributionService } from '../../services/distribution.service.js'
import { reportService } from '../../services/report.service.js'
import { inspectionService } from '../../services/inspection.service.js'

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

const StakeholderContactsSchema = z.object({
  ownerEmail: z.string().email(),
  contractorEmail: z.string().email(),
  inspectorEmail: z.string().email().optional(),
})

const distributeRoute = createRoute({
  method: 'post',
  path: '/distribute',
  tags: ['Admin'],
  summary: 'Email a generated report PDF to stakeholders',
  request: {
    body: {
      content: { 'application/json': { schema: DistributeReportDTOSchema } },
    },
  },
  responses: {
    200: {
      description: 'Distribution result',
      content: { 'application/json': { schema: ReportDistributionResultSchema } },
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

const contactsRoute = createRoute({
  method: 'get',
  path: '/contacts/{inspectionId}',
  tags: ['Admin'],
  summary: 'Default distribution contacts for an inspection',
  request: {
    params: z.object({
      inspectionId: z
        .string()
        .min(1)
        .openapi({ param: { name: 'inspectionId', in: 'path' } }),
    }),
  },
  responses: {
    200: {
      description: 'Stakeholder emails',
      content: { 'application/json': { schema: StakeholderContactsSchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const app = new OpenAPIHono()
  .openapi(distributeRoute, async (c) => {
    const userId = c.get('userId')
    const body = c.req.valid('json')

    try {
      const report = await reportService.getById(body.reportId)
      if (!report) {
        return c.json({ error: 'Report not found' }, 404) as any
      }

      const inspection = await inspectionService.getById(report.inspectionId, userId)
      if (!inspection) {
        return c.json({ error: 'Inspection not found' }, 404) as any
      }

      const result = await distributionService.distributeReportByEmail({
        reportId: body.reportId,
        recipientKeys: body.recipients,
        customEmails: body.customEmails ?? [],
        userId,
      })

      return c.json(
        {
          reportId: body.reportId,
          status: result.status,
          messageId: result.messageId,
          error: result.error,
          distributedAt: result.distributedAt,
        },
        200,
      ) as any
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Distribution failed'
      if (message.includes('not found')) {
        return c.json({ error: message }, 404) as any
      }
      if (message.includes('Forbidden')) {
        return c.json({ error: message }, 403) as any
      }
      return c.json({ error: message }, 400) as any
    }
  })
  .openapi(contactsRoute, async (c) => {
    const userId = c.get('userId')
    const { inspectionId } = c.req.valid('param')

    try {
      const inspection = await inspectionService.getById(inspectionId, userId)
      if (!inspection) {
        return c.json({ error: 'Inspection not found' }, 404) as any
      }

      const contacts = await distributionService.getContactsForInspection(inspectionId)
      return c.json(contacts, 200) as any
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load contacts'
      return c.json({ error: message }, 404) as any
    }
  })

export default app
