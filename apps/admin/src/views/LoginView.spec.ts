import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import LoginView from './LoginView.vue'

const login = vi.fn()

vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({ login }),
}))

function createLoginRouter(initial: { path: string; query?: Record<string, string> }) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/login', name: 'login', component: LoginView }],
  })
  return router.push(initial).then(() => router)
}

describe('LoginView', () => {
  beforeEach(() => {
    login.mockReset()
    login.mockResolvedValue(undefined)
  })

  it('shows validation when fields are empty', async () => {
    const router = await createLoginRouter({ path: '/login' })
    const wrapper = mount(LoginView, { global: { plugins: [router] } })
    await wrapper.get('form').trigger('submit.prevent')
    expect(wrapper.text()).toContain('Please enter both email and password')
    expect(login).not.toHaveBeenCalled()
  })

  it('submits credentials via useAuth', async () => {
    const router = await createLoginRouter({ path: '/login' })
    const wrapper = mount(LoginView, { global: { plugins: [router] } })
    await wrapper.get('#email').setValue('admin@test.com')
    await wrapper.get('#password').setValue('secretpass')
    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()

    expect(login).toHaveBeenCalledWith({
      email: 'admin@test.com',
      password: 'secretpass',
    })
  })

  it('shows access denied notice when routed from admin guard (M9-S14)', async () => {
    const router = await createLoginRouter({
      path: '/login',
      query: { reason: 'access_denied' },
    })
    const wrapper = mount(LoginView, { global: { plugins: [router] } })

    expect(wrapper.get('[data-testid="login-access-denied-notice"]').text()).toContain(
      'administrator privileges',
    )
  })

  it('shows idle logout notice when query reason is idle', async () => {
    const router = await createLoginRouter({
      path: '/login',
      query: { reason: 'idle' },
    })
    const wrapper = mount(LoginView, { global: { plugins: [router] } })

    expect(wrapper.get('[data-testid="login-idle-logout-notice"]').text()).toContain(
      'signed out after a period of inactivity',
    )
  })
})
