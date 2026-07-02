import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import LoginView from './LoginView.vue'

const loginWithSso = vi.fn()

vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({
    login: vi.fn(),
    loginWithSso,
  }),
}))

vi.mock('../composables/useConnectivity', () => ({
  useConnectivity: () => ({
    isConnectionAvailable: ref(true),
  }),
}))

describe('LoginView SSO', () => {
  beforeEach(() => {
    vi.resetModules()
    loginWithSso.mockReset()
  })

  it('shows organization SSO button when config is enabled', async () => {
    vi.doMock('../composables/useSsoConfig', () => ({
      useSsoConfig: () => ({
        config: ref({
          enabled: true,
          clientId: 'inspector-pwa',
          authorizationEndpoint: 'http://localhost:4000/auth/sso/authorize',
          scopes: ['openid', 'profile', 'email'],
          devProvider: true,
        }),
        isLoading: ref(false),
        ssoEnabled: computed(() => true),
      }),
    }))

    const { default: SsoLoginView } = await import('./LoginView.vue')
    const pinia = createPinia()
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', component: SsoLoginView },
        { path: '/user-manual', name: 'user-manual', component: { template: '<div />' } },
      ],
    })
    await router.push('/login')
    await router.isReady()

    const wrapper = mount(SsoLoginView, {
      global: { plugins: [pinia, router] },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="login-sso-button"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Sign in with Organization SSO')
    expect(wrapper.text()).not.toContain('SSO integration coming soon')
  })
})
