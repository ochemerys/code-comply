import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import type { UserDTO } from '@codecomply/validators'
import DashboardLayout from '../../src/layouts/DashboardLayout.vue'
import InspectionMonitorView from '../../src/views/InspectionMonitorView.vue'
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

describe('inspection monitor routing (integration)', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    localStorage.clear()
  })

  it('renders inspection monitor inside the dashboard shell when authenticated', async () => {
    const authStore = useAuthStore()
    authStore.setUser(adminUser())
    authStore.updateTokens({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/',
          component: DashboardLayout,
          children: [
            {
              path: 'inspections/monitor',
              name: 'inspection-monitor',
              component: InspectionMonitorView,
              meta: { title: 'Inspection monitor' },
            },
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

    await router.push('/inspections/monitor')
    await router.isReady()
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('inspection-monitor')
    expect(wrapper.find('[data-testid="inspection-monitor-view"]').exists()).toBe(true)

    wrapper.unmount()
  })
})
