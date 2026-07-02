import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import UserCreateView from './UserCreateView.vue'
import { useAuthStore } from '../stores/auth'

const mutateAsync = vi.fn()

vi.mock('../composables/useAdminCreateUser', () => ({
  useAdminCreateUser: () => ({
    mutateAsync,
    isPending: { value: false },
    error: { value: null },
    data: { value: null },
  }),
}))

describe('UserCreateView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    useAuthStore().updateTokens({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 })
  })

  it('shows validation errors for invalid email', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/users/new', name: 'user-create', component: UserCreateView }],
    })
    await router.push('/users/new')

    const wrapper = mount(UserCreateView, {
      global: { plugins: [createPinia(), router] },
    })

    await wrapper.get('[data-testid="user-create-email"]').setValue('bad-email')
    await wrapper.get('[data-testid="user-create-name"]').setValue('Test User')
    await wrapper.get('[data-testid="user-create-submit"]').trigger('click')
    await flushPromises()

    expect(mutateAsync).not.toHaveBeenCalled()
    expect(wrapper.text()).toMatch(/email/i)
  })

  it('submits valid create payload', async () => {
    mutateAsync.mockResolvedValue({
      user: { id: 'u1', email: 'sco@example.com', name: 'New SCO', role: 'SCO' },
      temporaryPassword: 'temp-pass-123',
    })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/users/new', name: 'user-create', component: UserCreateView }],
    })
    await router.push('/users/new')

    const wrapper = mount(UserCreateView, {
      global: { plugins: [createPinia(), router] },
    })

    await wrapper.get('[data-testid="user-create-email"]').setValue('sco@example.com')
    await wrapper.get('[data-testid="user-create-name"]').setValue('New SCO')
    await wrapper.get('[data-testid="user-create-submit"]').trigger('click')
    await flushPromises()

    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'sco@example.com',
        name: 'New SCO',
        role: 'SCO',
      }),
    )
    expect(wrapper.find('[data-testid="user-create-temp-password"]').exists()).toBe(true)
  })
})
