import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import Sidebar from '../../src/components/Sidebar.vue'
import { seedAdminAuthStore } from '../../src/test-utils/admin-auth-fixture'

describe('admin report generation navigation', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    seedAdminAuthStore()
  })

  it('includes Reports route in sidebar', () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'dashboard', component: { template: '<div />' } },
        { path: '/reports', name: 'reports', component: { template: '<div />' } },
      ],
    })

    const wrapper = mount(Sidebar, {
      props: { collapsed: false, mobileOpen: false },
      global: { plugins: [pinia, router] },
    })

    expect(wrapper.get('[data-testid="nav-reports"]').text()).toContain('Reports')
  })
})
