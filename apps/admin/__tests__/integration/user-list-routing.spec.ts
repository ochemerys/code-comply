import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import type { UserDTO } from '@codecomply/validators'
import DashboardLayout from '../../src/layouts/DashboardLayout.vue'
import UserListView from '../../src/views/UserListView.vue'
import { useAuthStore } from '../../src/stores/auth'

const iso = () => new Date().toISOString()

const adminUser = (): UserDTO => ({
  id: 'u1',
  email: 'admin@test.com',
  name: 'Test Admin',
  role: 'ADMIN',
  disciplines: [],
  certifications: [],
  createdAt: iso(),
  updatedAt: iso(),
})

describe('user list routing (integration)', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('renders user list inside the dashboard layout', async () => {
    const authStore = useAuthStore()
    authStore.setUser(adminUser())
    authStore.updateTokens({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 })

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/',
          component: DashboardLayout,
          children: [
            { path: 'users', name: 'users', component: UserListView, meta: { title: 'Users' } },
          ],
        },
      ],
    })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const wrapper = mount(RouterView, {
      global: {
        plugins: [pinia, router, [VueQueryPlugin, { queryClient }]],
      },
      attachTo: document.body,
    })

    await router.push('/users')
    await router.isReady()
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('users')
    expect(wrapper.text()).toContain('Users')
    expect(wrapper.find('[data-testid="user-list-view"]').exists()).toBe(true)

    wrapper.unmount()
    vi.unstubAllGlobals()
  })
})
