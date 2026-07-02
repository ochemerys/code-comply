import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchAdminSsoSettings, patchAdminSsoSettings } from './useAdminSsoSettings'

vi.mock('@/api/client', () => ({
  api: {
    admin: {
      settings: {
        sso: {
          $get: vi.fn(),
          $patch: vi.fn(),
        },
        'session-policy': {
          $get: vi.fn(),
        },
      },
    },
  },
}))

import { api } from '@/api/client'

describe('useAdminSsoSettings API helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchAdminSsoSettings parses JSON', async () => {
    vi.mocked(api.admin.settings.sso.$get).mockResolvedValue(
      new Response(
        JSON.stringify({
          enabled: true,
          issuerUrl: 'https://idp.example.com',
          clientId: 'cid',
          redirectUris: [],
          clientSecretConfigured: true,
        }),
        { status: 200 },
      ) as Awaited<ReturnType<typeof api.admin.settings.sso.$get>>,
    )

    const data = await fetchAdminSsoSettings()
    expect(data.enabled).toBe(true)
    expect(data.clientId).toBe('cid')
  })

  it('patchAdminSsoSettings sends body', async () => {
    vi.mocked(api.admin.settings.sso.$patch).mockResolvedValue(
      new Response(
        JSON.stringify({
          enabled: false,
          issuerUrl: '',
          clientId: '',
          redirectUris: [],
          clientSecretConfigured: false,
        }),
        { status: 200 },
      ) as Awaited<ReturnType<typeof api.admin.settings.sso.$patch>>,
    )

    await patchAdminSsoSettings({ enabled: false })
    expect(api.admin.settings.sso.$patch).toHaveBeenCalledWith({ json: { enabled: false } })
  })
})
