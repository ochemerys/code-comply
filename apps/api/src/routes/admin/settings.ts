import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  AdminSessionPolicySchema,
  AdminSsoSettingsPatchSchema,
  AdminSsoSettingsSchema,
} from '@codecomply/validators'
import { orgSettingsService } from '../../services/org-settings.service.js'

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

const getSsoRoute = createRoute({
  method: 'get',
  path: '/sso',
  tags: ['Admin'],
  summary: 'Get SSO/OIDC settings (admin)',
  responses: {
    200: {
      description: 'SSO settings',
      content: { 'application/json': { schema: AdminSsoSettingsSchema } },
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

const patchSsoRoute = createRoute({
  method: 'patch',
  path: '/sso',
  tags: ['Admin'],
  summary: 'Update SSO/OIDC settings (admin)',
  request: {
    body: { content: { 'application/json': { schema: AdminSsoSettingsPatchSchema } } },
  },
  responses: {
    200: {
      description: 'Updated SSO settings',
      content: { 'application/json': { schema: AdminSsoSettingsSchema } },
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

const getSessionPolicyRoute = createRoute({
  method: 'get',
  path: '/session-policy',
  tags: ['Admin'],
  summary: 'Get admin session idle policy (read-only)',
  responses: {
    200: {
      description: 'Session policy',
      content: { 'application/json': { schema: AdminSessionPolicySchema } },
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

const app = new OpenAPIHono()
  .openapi(getSsoRoute, async (c) => {
    const settings = await orgSettingsService.getSsoSettings()
    return c.json(settings) as any
  })
  .openapi(patchSsoRoute, async (c) => {
    const body = c.req.valid('json')
    const settings = await orgSettingsService.patchSsoSettings(body)
    return c.json(settings) as any
  })
  .openapi(getSessionPolicyRoute, async (c) => {
    return c.json(orgSettingsService.getSessionPolicy()) as any
  })

export default app
