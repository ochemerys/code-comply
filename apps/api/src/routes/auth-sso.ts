import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import {
  SsoPublicConfigSchema,
  SsoTokenExchangeSchema,
  TokenDTOSchema,
} from '@codecomply/validators'
import { orgSettingsService } from '../services/org-settings.service.js'
import { ssoAuthService } from '../services/sso-auth.service.js'

const ErrorResponseSchema = z.object({
  error: z.string(),
})

const configRoute = createRoute({
  method: 'get',
  path: '/sso/config',
  tags: ['Authentication'],
  summary: 'Public SSO/OIDC config for inspector login',
  responses: {
    200: {
      description: 'SSO configuration',
      content: { 'application/json': { schema: SsoPublicConfigSchema } },
    },
  },
})

const authorizeQuerySchema = z.object({
  client_id: z.string().optional(),
  redirect_uri: z.string().url(),
  response_type: z.literal('code'),
  scope: z.string().optional(),
  state: z.string().min(1),
  nonce: z.string().optional(),
})

const authorizeRoute = createRoute({
  method: 'get',
  path: '/sso/authorize',
  tags: ['Authentication'],
  summary: 'Start OIDC authorization (redirects to IdP or dev login)',
  request: { query: authorizeQuerySchema },
  responses: {
    302: { description: 'Redirect to organization SSO' },
    400: {
      description: 'Invalid request',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const tokenRoute = createRoute({
  method: 'post',
  path: '/sso/token',
  tags: ['Authentication'],
  summary: 'Exchange OIDC authorization code for API tokens',
  request: {
    body: {
      content: { 'application/json': { schema: SsoTokenExchangeSchema } },
    },
  },
  responses: {
    200: {
      description: 'Token pair',
      content: { 'application/json': { schema: TokenDTOSchema } },
    },
    401: {
      description: 'Invalid code or state',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const ssoBase = new OpenAPIHono()

export const ssoRoutes = ssoBase
  .openapi(configRoute, async (c) => {
    const config = await ssoAuthService.getPublicConfig()
    return c.json(config) as any
  })
  .openapi(authorizeRoute, async (c) => {
    try {
      const query = c.req.valid('query')
      const settings = await orgSettingsService.getSsoSettings()
      ssoAuthService.assertRedirectUri(settings, query.redirect_uri)
      ssoAuthService.registerAuthorizationState(query.state, query.redirect_uri, query.nonce ?? '')

      const config = await ssoAuthService.getPublicConfig()
      if (config.devProvider) {
        return c.redirect(`/auth/sso/dev-login?state=${encodeURIComponent(query.state)}`, 302)
      }

      const issuer = settings.issuerUrl.replace(/\/$/, '')
      const params = new URLSearchParams({
        client_id: query.client_id ?? settings.clientId,
        redirect_uri: query.redirect_uri,
        response_type: 'code',
        scope: query.scope ?? 'openid profile email',
        state: query.state,
      })
      if (query.nonce) params.set('nonce', query.nonce)
      return c.redirect(`${issuer}/authorize?${params.toString()}`, 302)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid authorize request'
      return c.json({ error: message }, 400) as any
    }
  })
  .openapi(tokenRoute, async (c) => {
    try {
      const body = c.req.valid('json')
      const tokens = await ssoAuthService.exchangeCode(body)
      return c.json(tokens) as any
    } catch {
      return c.json({ error: 'Invalid or expired authorization code' }, 401) as any
    }
  })
  .get('/sso/dev-login', async (c) => {
    const state = c.req.query('state')
    if (!state) return c.text('Missing state', 400)
    const error = c.req.query('error')
    return c.html(ssoAuthService.devLoginHtml(state, error), 200)
  })
  .post('/sso/dev-login', async (c) => {
    const body = await c.req.parseBody()
    const state = String(body.state ?? '')
    const email = String(body.email ?? '').trim()
    if (!state || !email) {
      return c.redirect(
        `/auth/sso/dev-login?state=${encodeURIComponent(state)}&error=Missing+email`,
        302,
      )
    }

    try {
      const settings = await orgSettingsService.getSsoSettings()
      const redirectUri = ssoAuthService.getRedirectUriForState(state)
      ssoAuthService.assertRedirectUri(settings, redirectUri)
      const code = ssoAuthService.issueAuthCode(email, redirectUri)
      const url = new URL(redirectUri)
      url.searchParams.set('code', code)
      url.searchParams.set('state', state)
      return c.redirect(url.toString(), 302)
    } catch (error) {
      const message = encodeURIComponent(error instanceof Error ? error.message : 'SSO failed')
      return c.redirect(
        `/auth/sso/dev-login?state=${encodeURIComponent(state)}&error=${message}`,
        302,
      )
    }
  })

export default ssoRoutes
