import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  ChecklistExecutionDTOSchema,
  ChecklistResponseDTOSchema,
  ChecklistTemplateDTOSchema,
} from '@codecomply/validators'
import { checklistService } from '../services/checklist.service.js'
import { ChecklistMapper } from '../mappers/checklist.mapper.js'

const app = new OpenAPIHono()

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

const TemplatesQuerySchema = z.object({
  discipline: z
    .string()
    .optional()
    .openapi({
      param: { name: 'discipline', in: 'query' },
      example: 'Building',
    }),
})

const StartExecutionBodySchema = z.object({
  inspectionId: z.string().min(1).openapi({ example: 'cl-insp-1' }),
  templateId: z.string().min(1).openapi({ example: 'cl-tpl-1' }),
})

const listTemplatesRoute = createRoute({
  method: 'get',
  path: '/templates',
  tags: ['Checklists'],
  summary: 'List checklist templates',
  description: 'Lists active checklist templates, optionally filtered by discipline.',
  request: {
    query: TemplatesQuerySchema,
  },
  responses: {
    200: {
      description: 'Templates',
      content: {
        'application/json': {
          schema: z.array(ChecklistTemplateDTOSchema),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

app.openapi(listTemplatesRoute, async (c) => {
  const query = c.req.valid('query')
  try {
    const templates = await checklistService.listTemplates(query.discipline)
    return c.json(ChecklistMapper.toTemplateDTOs(templates)) as any
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[ChecklistsController] list templates:', error)
    return c.json({ error: 'Failed to list checklist templates', message }, 500) as any
  }
})

const getTemplateRoute = createRoute({
  method: 'get',
  path: '/templates/{id}',
  tags: ['Checklists'],
  summary: 'Get checklist template by id',
  request: {
    params: z.object({
      id: z
        .string()
        .min(1)
        .openapi({ param: { name: 'id', in: 'path' }, example: 'tpl-1' }),
    }),
  },
  responses: {
    200: {
      description: 'Template',
      content: {
        'application/json': {
          schema: ChecklistTemplateDTOSchema,
        },
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
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

app.openapi(getTemplateRoute, async (c) => {
  const { id } = c.req.valid('param')
  try {
    const template = await checklistService.getTemplate(id)
    return c.json(ChecklistMapper.toTemplateDTO(template)) as any
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message.includes('not found')) {
      return c.json({ error: message }, 404) as any
    }
    console.error('[ChecklistsController] get template:', error)
    return c.json({ error: 'Failed to get checklist template', message }, 500) as any
  }
})

const postExecutionRoute = createRoute({
  method: 'post',
  path: '/executions',
  tags: ['Checklists'],
  summary: 'Start checklist execution',
  description: 'Creates a checklist execution for an inspection from a template version.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: StartExecutionBodySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Execution created',
      content: {
        'application/json': {
          schema: ChecklistExecutionDTOSchema,
        },
      },
    },
    400: {
      description: 'Bad request',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Inspection or template not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

app.openapi(postExecutionRoute, async (c) => {
  const body = c.req.valid('json')
  try {
    const created = await checklistService.startExecution(body.inspectionId, body.templateId)
    const withTemplate = await checklistService.getExecutionWithTemplate(created.id)
    return c.json(ChecklistMapper.toExecutionDTO(withTemplate), 201) as any
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message.includes('not found')) {
      return c.json({ error: message }, 404) as any
    }
    console.error('[ChecklistsController] start execution:', error)
    return c.json({ error: 'Failed to start checklist execution', message }, 500) as any
  }
})

const getExecutionRoute = createRoute({
  method: 'get',
  path: '/executions/{id}',
  tags: ['Checklists'],
  summary: 'Get checklist execution',
  description:
    'Returns execution state (responses, progress) for the given id. User must have access to the parent inspection.',
  request: {
    params: z.object({
      id: z
        .string()
        .min(1)
        .openapi({ param: { name: 'id', in: 'path' }, example: 'exec-1' }),
    }),
  },
  responses: {
    200: {
      description: 'Execution',
      content: {
        'application/json': {
          schema: ChecklistExecutionDTOSchema,
        },
      },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Execution or inspection not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

app.openapi(getExecutionRoute, async (c) => {
  const { id } = c.req.valid('param')
  const userId = c.get('userId') as string
  try {
    const execution = await checklistService.getExecutionForUser(id, userId)
    return c.json(ChecklistMapper.toExecutionDTO(execution)) as any
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message.includes('Unauthorized')) {
      return c.json({ error: message }, 403) as any
    }
    if (message.includes('not found')) {
      return c.json({ error: message }, 404) as any
    }
    console.error('[ChecklistsController] get execution:', error)
    return c.json({ error: 'Failed to get checklist execution', message }, 500) as any
  }
})

const patchResponseRoute = createRoute({
  method: 'patch',
  path: '/executions/{id}/responses',
  tags: ['Checklists'],
  summary: 'Update a checklist item response',
  request: {
    params: z.object({
      id: z
        .string()
        .min(1)
        .openapi({ param: { name: 'id', in: 'path' }, example: 'exec-1' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: ChecklistResponseDTOSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated execution',
      content: {
        'application/json': {
          schema: ChecklistExecutionDTOSchema,
        },
      },
    },
    400: {
      description: 'Validation or business rule error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Execution not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

app.openapi(patchResponseRoute, async (c) => {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')
  try {
    await checklistService.updateResponse(id, body.itemId, {
      result: body.result,
      codeReference: body.codeReference,
      notes: body.notes,
      timestamp: body.timestamp,
    })
    const withTemplate = await checklistService.getExecutionWithTemplate(id)
    return c.json(ChecklistMapper.toExecutionDTO(withTemplate)) as any
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message.includes('not found')) {
      return c.json({ error: message }, 404) as any
    }
    if (
      message.includes('codeReference') ||
      message.includes('Cannot modify completed') ||
      message.includes('not part of this checklist')
    ) {
      return c.json({ error: message }, 400) as any
    }
    console.error('[ChecklistsController] update response:', error)
    return c.json({ error: 'Failed to update checklist response', message }, 500) as any
  }
})

export default app
