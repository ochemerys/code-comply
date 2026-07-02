import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  AdminChecklistTemplateCreateBodySchema,
  AdminChecklistTemplateDetailDTOSchema,
  AdminChecklistTemplateListItemDTOSchema,
  AdminChecklistTemplateListQuerySchema,
  AdminChecklistTemplateUpdateBodySchema,
  ChecklistTemplateDTOSchema,
} from '@codecomply/validators'
import { checklistService } from '../../services/checklist.service.js'
import { ChecklistMapper } from '../../mappers/checklist.mapper.js'

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Admin'],
  summary: 'List checklist templates (admin)',
  request: { query: AdminChecklistTemplateListQuerySchema },
  responses: {
    200: {
      description: 'Templates',
      content: {
        'application/json': { schema: z.array(AdminChecklistTemplateListItemDTOSchema) },
      },
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

const postRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Admin'],
  summary: 'Create checklist template (admin)',
  request: {
    body: { content: { 'application/json': { schema: AdminChecklistTemplateCreateBodySchema } } },
  },
  responses: {
    201: {
      description: 'Created template',
      content: {
        'application/json': { schema: AdminChecklistTemplateDetailDTOSchema },
      },
    },
    400: {
      description: 'Bad request',
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
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const getByIdRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Admin'],
  summary: 'Get checklist template detail (admin)',
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
      description: 'Template detail',
      content: {
        'application/json': { schema: AdminChecklistTemplateDetailDTOSchema },
      },
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
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const putRoute = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['Admin'],
  summary: 'Update checklist template (admin)',
  request: {
    params: z.object({
      id: z
        .string()
        .min(1)
        .openapi({ param: { name: 'id', in: 'path' } }),
    }),
    body: { content: { 'application/json': { schema: AdminChecklistTemplateUpdateBodySchema } } },
  },
  responses: {
    200: {
      description: 'Updated template',
      content: {
        'application/json': { schema: AdminChecklistTemplateDetailDTOSchema },
      },
    },
    409: {
      description: 'Template locked — create new version',
      content: { 'application/json': { schema: ErrorResponseSchema } },
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
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const publishRoute = createRoute({
  method: 'post',
  path: '/{id}/publish',
  tags: ['Admin'],
  summary: 'Publish checklist template (admin)',
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
      description: 'Published template',
      content: { 'application/json': { schema: ChecklistTemplateDTOSchema } },
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
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const newVersionRoute = createRoute({
  method: 'post',
  path: '/{id}/new-version',
  tags: ['Admin'],
  summary: 'Create new checklist template version (admin)',
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
          schema: AdminChecklistTemplateUpdateBodySchema.partial(),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'New version',
      content: {
        'application/json': { schema: AdminChecklistTemplateDetailDTOSchema },
      },
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
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const archiveRoute = createRoute({
  method: 'post',
  path: '/{id}/archive',
  tags: ['Admin'],
  summary: 'Archive checklist template (admin)',
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
      description: 'Archived template',
      content: { 'application/json': { schema: ChecklistTemplateDTOSchema } },
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
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

export default new OpenAPIHono()
  .openapi(listRoute, async (c) => {
    const q = c.req.valid('query')
    try {
      const rows = await checklistService.listAllTemplates({
        discipline: q.discipline,
        search: q.search,
        includeInactive: q.includeInactive,
      })
      return c.json(
        rows.map((row) => ChecklistMapper.toAdminListItemDTO(row, row.usageCount)),
      ) as any
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[AdminChecklistTemplates] list:', error)
      return c.json({ error: 'Failed to list checklist templates', message }, 500) as any
    }
  })
  .openapi(postRoute, async (c) => {
    const body = c.req.valid('json')
    try {
      const created = await checklistService.createTemplate(body)
      const usageCount = await checklistService.getTemplateUsageCount(created.id)
      return c.json(ChecklistMapper.toAdminDetailDTO(created, usageCount), 201) as any
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[AdminChecklistTemplates] create:', error)
      return c.json({ error: 'Failed to create checklist template', message }, 500) as any
    }
  })
  .openapi(getByIdRoute, async (c) => {
    const { id } = c.req.valid('param')
    try {
      const template = await checklistService.getTemplate(id)
      const usageCount = await checklistService.getTemplateUsageCount(id)
      return c.json(ChecklistMapper.toAdminDetailDTO(template, usageCount)) as any
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      if (message.includes('not found')) {
        return c.json({ error: message }, 404) as any
      }
      console.error('[AdminChecklistTemplates] get:', error)
      return c.json({ error: 'Failed to get checklist template', message }, 500) as any
    }
  })
  .openapi(putRoute, async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    try {
      const updated = await checklistService.updateTemplate(id, body)
      const usageCount = await checklistService.getTemplateUsageCount(updated.id)
      return c.json(ChecklistMapper.toAdminDetailDTO(updated, usageCount)) as any
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      if (message.includes('locked')) {
        return c.json({ error: message }, 409) as any
      }
      if (message.includes('not found')) {
        return c.json({ error: message }, 404) as any
      }
      console.error('[AdminChecklistTemplates] update:', error)
      return c.json({ error: 'Failed to update checklist template', message }, 500) as any
    }
  })
  .openapi(publishRoute, async (c) => {
    const { id } = c.req.valid('param')
    try {
      const published = await checklistService.publishTemplate(id)
      return c.json(ChecklistMapper.toTemplateDTO(published)) as any
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      if (message.includes('not found')) {
        return c.json({ error: message }, 404) as any
      }
      console.error('[AdminChecklistTemplates] publish:', error)
      return c.json({ error: 'Failed to publish checklist template', message }, 500) as any
    }
  })
  .openapi(newVersionRoute, async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    try {
      const created = await checklistService.createNewVersion(id, body)
      const usageCount = await checklistService.getTemplateUsageCount(created.id)
      return c.json(ChecklistMapper.toAdminDetailDTO(created, usageCount), 201) as any
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      if (message.includes('not found')) {
        return c.json({ error: message }, 404) as any
      }
      console.error('[AdminChecklistTemplates] new-version:', error)
      return c.json({ error: 'Failed to create new template version', message }, 500) as any
    }
  })
  .openapi(archiveRoute, async (c) => {
    const { id } = c.req.valid('param')
    try {
      const archived = await checklistService.archiveTemplate(id)
      return c.json(ChecklistMapper.toTemplateDTO(archived)) as any
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      if (message.includes('not found')) {
        return c.json({ error: message }, 404) as any
      }
      console.error('[AdminChecklistTemplates] archive:', error)
      return c.json({ error: 'Failed to archive checklist template', message }, 500) as any
    }
  })
