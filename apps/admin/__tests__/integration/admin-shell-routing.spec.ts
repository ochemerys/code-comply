import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import type { UserDTO } from '@codecomply/validators'
import DashboardLayout from '../../src/layouts/DashboardLayout.vue'
import DashboardView from '../../src/views/DashboardView.vue'
import { useAuthStore } from '../../src/stores/auth'

const adminUser = (): UserDTO => ({
  id: 'u1',
  email: 'admin@test.com',
  name: 'Test Admin',
  role: 'ADMIN',
  disciplines: [],
  certifications: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

describe('admin shell routing (integration)', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    localStorage.clear()
  })

  it('renders dashboard inside the layout when the user is authenticated', async () => {
    const authStore = useAuthStore()
    authStore.setUser(adminUser())
    authStore.updateTokens({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/',
          component: DashboardLayout,
          children: [{ path: '', name: 'dashboard', component: DashboardView }],
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

    await router.push('/')
    await router.isReady()
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('dashboard')
    expect(wrapper.text()).toContain('Dashboard')
    expect(wrapper.text()).toContain('Test Admin')
    await vi.waitFor(
      () => {
        expect(wrapper.text()).toContain('Active inspectors')
      },
      { timeout: 3000 },
    )

    wrapper.unmount()
  })
})
