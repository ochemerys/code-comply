import { describe, it, expect, beforeEach, vi } from 'vitest'
import { testClient } from 'hono/testing'
import { Hono } from 'hono'
import type { User } from '@codecomply/db'
import settingsApp from './settings'
import { orgSettingsService } from '../../services/org-settings.service'
import { roleMiddleware } from '../../middleware/auth.middleware'

vi.mock('../../services/org-settings.service')

type SettingsTestClient = {
  sso: {
    $get: () => Promise<Response>
    $patch: (opts: { json: Record<string, unknown> }) => Promise<Response>
  }
  'session-policy': { $get: () => Promise<Response> }
}

const createAdminTestApp = () => {
  const testApp = new Hono()
  testApp.use('*', async (c, next) => {
    c.set('user', { id: 'admin-1', role: 'ADMIN' } as User)
    c.set('userId', 'admin-1')
    await next()
  })
  testApp.use('*', roleMiddleware(['ADMIN']))
  testApp.route('/', settingsApp)
  return testApp
}

const client = () => testClient(createAdminTestApp()) as SettingsTestClient

describe('Admin settings routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /sso returns settings', async () => {
    vi.mocked(orgSettingsService.getSsoSettings).mockResolvedValue({
      enabled: false,
      issuerUrl: '',
      clientId: '',
      redirectUris: [],
      clientSecretConfigured: false,
    })

    const res = await client().sso.$get()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ enabled: false })
  })

  it('PATCH /sso updates settings', async () => {
    vi.mocked(orgSettingsService.patchSsoSettings).mockResolvedValue({
      enabled: true,
      issuerUrl: 'https://issuer.example.com',
      clientId: 'client',
      redirectUris: ['https://app.example.com/callback'],
      clientSecretConfigured: true,
    })

    const res = await client().sso.$patch({
      json: { enabled: true, clientId: 'client' },
    })
    expect(res.status).toBe(200)
    expect(orgSettingsService.patchSsoSettings).toHaveBeenCalled()
  })

  it('GET /session-policy returns policy', async () => {
    vi.mocked(orgSettingsService.getSessionPolicy).mockReturnValue({
      idleWarnAfterMinutes: 14,
      idleLogoutAfterMinutes: 15,
      source: 'server',
    })

    const res = await client()['session-policy'].$get()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.idleWarnAfterMinutes).toBe(14)
  })
})
