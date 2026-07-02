import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import type { UserDTO } from '@codecomply/validators'
import DashboardLayout from '../../src/layouts/DashboardLayout.vue'
import WorkloadCalendarView from '../../src/views/WorkloadCalendarView.vue'
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

describe('workload calendar routing (integration)', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    localStorage.clear()
  })

  it('renders the workload calendar inside the dashboard shell when authenticated', async () => {
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
              path: 'assignments/calendar',
              name: 'workload-calendar',
              component: WorkloadCalendarView,
              meta: { title: 'Workload calendar' },
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

    await router.push('/assignments/calendar')
    await router.isReady()
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('workload-calendar')
    expect(wrapper.text()).toContain('Workload calendar')
    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-testid="workload-calendar"]').exists()).toBe(true)
      },
      { timeout: 3000 },
    )

    wrapper.unmount()
  })
})
