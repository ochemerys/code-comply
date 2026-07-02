import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('./org-settings.service.js', () => ({
  orgSettingsService: {
    getSsoSettings: vi.fn(),
  },
}))

vi.mock('./auth.service.js', () => ({
  authService: {
    createSessionForEmail: vi.fn(),
  },
}))

vi.mock('@codecomply/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

const { orgSettingsService } = await import('./org-settings.service.js')
const { authService } = await import('./auth.service.js')
const { prisma } = await import('@codecomply/db')
const { ssoAuthService } = await import('./sso-auth.service.js')

describe('SsoAuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.SSO_DEV_PROVIDER = 'true'
    vi.mocked(orgSettingsService.getSsoSettings).mockResolvedValue({
      enabled: false,
      issuerUrl: '',
      clientId: 'inspector-pwa',
      redirectUris: ['http://localhost:5175/login/sso-callback'],
      clientSecretConfigured: false,
    })
  })

  it('returns enabled dev provider config in development', async () => {
    const config = await ssoAuthService.getPublicConfig()
    expect(config.enabled).toBe(true)
    expect(config.devProvider).toBe(true)
    expect(config.authorizationEndpoint).toContain('/auth/sso/authorize')
    expect(config.scopes).toEqual(['openid', 'profile', 'email'])
  })

  it('exchanges a valid authorization code for tokens', async () => {
    const redirectUri = 'http://localhost:5175/login/sso-callback'
    const state = ssoAuthService.createAuthorizationState(redirectUri, 'nonce-1')
    const code = ssoAuthService.issueAuthCode('pat.nguyen@example.com', redirectUri)

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1',
      email: 'pat.nguyen@example.com',
      role: 'SCO',
      isActive: true,
    } as any)
    vi.mocked(authService.createSessionForEmail).mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 900,
    })

    const tokens = await ssoAuthService.exchangeCode({ code, redirectUri, state })

    expect(tokens.accessToken).toBe('access')
    expect(authService.createSessionForEmail).toHaveBeenCalledWith('pat.nguyen@example.com')
  })

  it('rejects invalid redirect_uri', async () => {
    const redirectUri = 'http://evil.example/callback'
    const state = 'evil-state'
    ssoAuthService.registerAuthorizationState(state, redirectUri, 'nonce-1')
    const code = ssoAuthService.issueAuthCode('pat.nguyen@example.com', redirectUri)

    await expect(ssoAuthService.exchangeCode({ code, redirectUri, state })).rejects.toThrow(
      'Invalid redirect_uri',
    )
  })
})
