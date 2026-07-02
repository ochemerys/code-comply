import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import type { UserDTO } from '@codecomply/validators'
import LoginView from '../../src/views/LoginView.vue'
import DashboardLayout from '../../src/layouts/DashboardLayout.vue'
import { useAuthStore } from '../../src/stores/auth'
import { runAdminPortalBeforeEach } from '../../src/router/guards/admin.guard'

const iso = () => new Date().toISOString()

const scoUser = (): UserDTO => ({
  id: 'sco-1',
  email: 'sco@test.com',
  name: 'SCO',
  role: 'SCO',
  disciplines: [],
  certifications: [],
  createdAt: iso(),
  updatedAt: iso(),
})

describe('admin authentication routing (integration, M9-S14)', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    localStorage.clear()
  })

  it('redirects non-admin to login and shows access denied on LoginView', async () => {
    const authStore = useAuthStore()
    authStore.setUser(scoUser())
    authStore.updateTokens({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/login',
          name: 'login',
          component: LoginView,
          meta: { requiresAuth: false },
        },
        {
          path: '/',
          component: DashboardLayout,
          meta: { requiresAuth: true, requiresAdmin: true },
          children: [
            {
              path: '',
              name: 'dashboard',
              component: { template: '<div data-testid="dash">Dashboard</div>' },
            },
          ],
        },
      ],
    })

    router.beforeEach((to, _from, next) => runAdminPortalBeforeEach(to, useAuthStore(), next))

    const wrapper = mount(RouterView, {
      global: {
        plugins: [pinia, router],
      },
      attachTo: document.body,
    })

    await router.push('/')
    await router.isReady()
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.reason).toBe('access_denied')
    expect(wrapper.get('[data-testid="login-access-denied-notice"]').text()).toContain(
      'administrator privileges',
    )

    wrapper.unmount()
  })
})
