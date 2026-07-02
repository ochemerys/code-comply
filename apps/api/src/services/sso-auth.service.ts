import * as crypto from 'node:crypto'
import type { AdminSsoSettings, SsoPublicConfig, SsoTokenExchange } from '@codecomply/validators'
import { orgSettingsService } from './org-settings.service.js'
import { authService, type TokenPair } from './auth.service.js'
import { prisma } from '@codecomply/db'

type PendingAuth = {
  redirectUri: string
  nonce: string
  expiresAt: number
}

type AuthCodeRecord = {
  email: string
  redirectUri: string
  expiresAt: number
}

const pendingByState = new Map<string, PendingAuth>()
const codeByValue = new Map<string, AuthCodeRecord>()

const TTL_MS = 10 * 60 * 1000

function apiPublicUrl(): string {
  return (process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 4000}`).replace(
    /\/$/,
    '',
  )
}

function defaultRedirectUris(): string[] {
  const inspector = process.env.INSPECTOR_URL?.replace(/\/$/, '') ?? 'http://localhost:5175'
  return [`${inspector}/login/sso-callback`]
}

function isDevProvider(settings: AdminSsoSettings): boolean {
  if (process.env.SSO_DEV_PROVIDER === 'false') return false
  if (process.env.SSO_DEV_PROVIDER === 'true') return true
  if (process.env.NODE_ENV === 'production') return false
  if (!settings.issuerUrl?.trim()) return true
  return settings.issuerUrl.includes('/auth/sso/dev-oidc')
}

function isSsoEnabled(settings: AdminSsoSettings): boolean {
  if (settings.enabled) return true
  return isDevProvider(settings)
}

function allowedRedirectUris(settings: AdminSsoSettings): string[] {
  const configured = settings.redirectUris?.length ? settings.redirectUris : defaultRedirectUris()
  return [...new Set([...configured, ...defaultRedirectUris()])]
}

function purgeExpired(): void {
  const now = Date.now()
  for (const [key, value] of pendingByState) {
    if (value.expiresAt <= now) pendingByState.delete(key)
  }
  for (const [key, value] of codeByValue) {
    if (value.expiresAt <= now) codeByValue.delete(key)
  }
}

export class SsoAuthService {
  async getPublicConfig(): Promise<SsoPublicConfig> {
    const settings = await orgSettingsService.getSsoSettings()
    if (!isSsoEnabled(settings)) {
      return { enabled: false }
    }

    const dev = isDevProvider(settings)
    const base = `${apiPublicUrl()}/auth/sso`

    return {
      enabled: true,
      clientId: settings.clientId || 'inspector-pwa',
      authorizationEndpoint: dev
        ? `${base}/authorize`
        : `${settings.issuerUrl.replace(/\/$/, '')}/authorize`,
      scopes: ['openid', 'profile', 'email'],
      devProvider: dev,
    }
  }

  assertRedirectUri(settings: AdminSsoSettings, redirectUri: string): void {
    const allowed = allowedRedirectUris(settings)
    if (!allowed.includes(redirectUri)) {
      throw new Error('Invalid redirect_uri')
    }
  }

  createAuthorizationState(redirectUri: string, nonce: string): string {
    purgeExpired()
    const state = crypto.randomBytes(16).toString('hex')
    this.registerAuthorizationState(state, redirectUri, nonce)
    return state
  }

  registerAuthorizationState(state: string, redirectUri: string, nonce: string): void {
    purgeExpired()
    pendingByState.set(state, {
      redirectUri,
      nonce,
      expiresAt: Date.now() + TTL_MS,
    })
  }

  getRedirectUriForState(state: string): string {
    purgeExpired()
    const pending = pendingByState.get(state)
    if (!pending || pending.expiresAt <= Date.now()) {
      throw new Error('Invalid or expired state')
    }
    return pending.redirectUri
  }

  consumeAuthorizationState(state: string, redirectUri: string): PendingAuth {
    purgeExpired()
    const pending = pendingByState.get(state)
    pendingByState.delete(state)
    if (!pending || pending.redirectUri !== redirectUri || pending.expiresAt <= Date.now()) {
      throw new Error('Invalid or expired state')
    }
    return pending
  }

  issueAuthCode(email: string, redirectUri: string): string {
    purgeExpired()
    const code = crypto.randomBytes(24).toString('hex')
    codeByValue.set(code, {
      email: email.trim().toLowerCase(),
      redirectUri,
      expiresAt: Date.now() + TTL_MS,
    })
    return code
  }

  async exchangeCode(body: SsoTokenExchange): Promise<TokenPair> {
    purgeExpired()
    const settings = await orgSettingsService.getSsoSettings()
    if (!isSsoEnabled(settings)) {
      throw new Error('SSO is not enabled')
    }

    this.assertRedirectUri(settings, body.redirectUri)
    this.consumeAuthorizationState(body.state, body.redirectUri)

    const record = codeByValue.get(body.code)
    codeByValue.delete(body.code)
    if (!record || record.redirectUri !== body.redirectUri || record.expiresAt <= Date.now()) {
      throw new Error('Invalid or expired authorization code')
    }

    const user = await prisma.user.findUnique({ where: { email: record.email } })
    if (!user || user.role !== 'SCO' || !user.isActive) {
      throw new Error('SSO user is not an active SCO')
    }

    return authService.createSessionForEmail(record.email)
  }

  devLoginHtml(state: string, error?: string): string {
    const err = error ? `<p style="color:#b91c1c;margin:0 0 1rem">${escapeHtml(error)}</p>` : ''
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Organization SSO</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 24rem; margin: 3rem auto; padding: 0 1rem; }
    label { display:block; font-weight:600; margin-bottom:0.5rem; }
    input, button { width:100%; box-sizing:border-box; font-size:1rem; padding:0.75rem; }
    button { margin-top:1rem; background:#2563eb; color:#fff; border:0; border-radius:0.5rem; }
  </style>
</head>
<body>
  <h1>Organization SSO</h1>
  <p>Development OIDC sign-in — enter your SCO email to complete OAuth 2.0 / OIDC authentication.</p>
  ${err}
  <form method="post" action="/auth/sso/dev-login">
    <input type="hidden" name="state" value="${escapeHtml(state)}" />
    <label for="email">Work email</label>
    <input id="email" name="email" type="email" required autocomplete="username" placeholder="pat.nguyen@example.com" />
    <button type="submit">Continue with SSO</button>
  </form>
</body>
</html>`
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export const ssoAuthService = new SsoAuthService()
