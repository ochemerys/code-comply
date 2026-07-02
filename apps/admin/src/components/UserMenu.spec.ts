import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import type { UserDTO } from '@codecomply/validators'
import UserMenu from './UserMenu.vue'
import { useAuthStore } from '../stores/auth'

const logout = vi.fn().mockResolvedValue(undefined)

vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({ logout }),
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

describe('UserMenu', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    logout.mockClear()
    const auth = useAuthStore()
    auth.setUser(adminUser())
    auth.updateTokens({ accessToken: 'a', refreshToken: 'b', expiresIn: 3600 })
  })

  it('opens the menu and signs out', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', name: 'dashboard', component: { template: '<div />' } }],
    })
    vi.spyOn(router, 'push').mockResolvedValue(undefined)

    const wrapper = mount(UserMenu, {
      global: { plugins: [pinia, router] },
    })

    await wrapper.get('[data-testid="user-menu-trigger"]').trigger('click')
    await wrapper.get('[data-testid="user-menu-sign-out"]').trigger('click')
    await flushPromises()

    expect(logout).toHaveBeenCalled()
  })
})
