import { describe, it, expect, vi } from 'vitest'
import { ref, computed } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import LoginView from './LoginView.vue'

vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({
    login: vi.fn(),
    loginWithSso: vi.fn(),
  }),
}))

vi.mock('../composables/useSsoConfig', () => ({
  useSsoConfig: () => ({
    config: ref({ enabled: false }),
    isLoading: ref(false),
    ssoEnabled: computed(() => false),
  }),
}))

describe('LoginView', () => {
  it('renders title and sign-in form', async () => {
    const pinia = createPinia()
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/user-manual', name: 'user-manual', component: { template: '<div>Manual</div>' } },
      ],
    })
    await router.push('/')
    await router.isReady()

    const wrapper = mount(LoginView, {
      global: {
        plugins: [pinia, router],
      },
    })

    expect(wrapper.text()).toContain('CodeComply Field')
    expect(wrapper.text()).toContain('Sign in to your account')
    expect(wrapper.find('#email').exists()).toBe(true)
    expect(wrapper.find('#password').exists()).toBe(true)
    expect(wrapper.find('[data-testid="login-user-manual-link"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="login-dev-credentials"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('inspector1@example.com / password123')
  })

  it('shows idle logout notice when query reason is idle', async () => {
    const pinia = createPinia()
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', component: LoginView },
        { path: '/user-manual', name: 'user-manual', component: { template: '<div />' } },
      ],
    })
    await router.push({ path: '/login', query: { reason: 'idle' } })
    await router.isReady()

    const wrapper = mount(LoginView, {
      global: { plugins: [pinia, router] },
    })

    expect(wrapper.find('[data-testid="login-idle-logout-notice"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('signed out after a period of inactivity')
  })
})
