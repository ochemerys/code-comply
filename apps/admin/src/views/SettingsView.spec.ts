import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import SettingsView from './SettingsView.vue'
import { useAuthStore } from '../stores/auth'

vi.mock('../composables/useAdminSsoSettings', () => ({
  useAdminSsoSettings: () => ({
    ssoQuery: {
      data: {
        value: {
          enabled: false,
          issuerUrl: '',
          clientId: 'test-client',
          redirectUris: ['https://admin.example.com/callback'],
          clientSecretConfigured: true,
          documentationUrl: 'https://openid.net/',
        },
      },
      isPending: { value: false },
      error: { value: null },
    },
    sessionPolicyQuery: {
      data: {
        value: {
          idleWarnAfterMinutes: 14,
          idleLogoutAfterMinutes: 15,
          source: 'client',
        },
      },
      isPending: { value: false },
    },
    saveSso: {
      isPending: { value: false },
      mutateAsync: vi.fn().mockResolvedValue({}),
    },
  }),
}))

describe('SettingsView', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.updateTokens({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 })
  })

  it('renders SSO and session policy sections', async () => {
    const queryClient = new QueryClient()
    const wrapper = mount(SettingsView, {
      global: { plugins: [createPinia(), [VueQueryPlugin, { queryClient }]] },
    })

    await flushPromises()

    expect(wrapper.find('[data-testid="settings-sso-section"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="settings-session-section"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="settings-sso-client-id"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Session / idle policy')
  })
})
