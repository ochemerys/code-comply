import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import type { UserDTO } from '@codecomply/validators'
import { createRouter, createMemoryHistory } from 'vue-router'
import DashboardView from './DashboardView.vue'
import { useAuthStore } from '../stores/auth'

vi.mock('../composables/useAdminDashboard', () => ({
  useAdminDashboard: () => ({
    data: ref({
      stats: {
        activeInspectors: 12,
        pendingInspections: 28,
        completedToday: 6,
        stopWorkOrders: 2,
      },
      recentInspections: [
        {
          id: 'insp-1001',
          permitId: 'P-24001',
          status: 'IN_PROGRESS',
          inspectorName: 'Alex Inspector',
          updatedAt: new Date().toISOString(),
        },
      ],
      pendingAssignments: [
        {
          id: 'asg-501',
          permitId: 'P-23990',
          assignedTo: 'Alex Inspector',
          dueDate: new Date().toISOString(),
        },
      ],
      stopWorkAlerts: [],
    }),
    isPending: ref(false),
    isFetching: ref(false),
    refetch: vi.fn(),
    failureCount: ref(0),
  }),
}))

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

describe('DashboardView', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.setUser(adminUser())
    auth.updateTokens({ accessToken: 'a', refreshToken: 'b', expiresIn: 3600 })
  })

  it('loads dashboard sections and triggers manual refresh', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', name: 'home', component: { template: '<div />' } }],
    })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const wrapper = mount(DashboardView, {
      global: {
        plugins: [pinia, router, [VueQueryPlugin, { queryClient }]],
      },
    })

    await flushPromises()
    await vi.waitFor(() => expect(wrapper.text()).toContain('12'))

    expect(wrapper.text()).toContain('Active inspectors')
    expect(wrapper.text()).toContain('Recent inspections')

    await wrapper.get('[data-testid="dashboard-refresh"]').trigger('click')
    await flushPromises()
  })
})
