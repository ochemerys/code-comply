import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import Sidebar from '../../src/components/Sidebar.vue'
import { ADMIN_NAV_ITEMS } from '../../src/config/admin-navigation'
import { seedAdminAuthStore } from '../../src/test-utils/admin-auth-fixture'

describe('Compliance search admin navigation (M10-S16)', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    seedAdminAuthStore()
  })

  it('includes compliance search in nav items', () => {
    const item = ADMIN_NAV_ITEMS.find((n) => n.route === '/compliance/search')
    expect(item).toBeDefined()
    expect(item?.label).toBe('Compliance search')
  })

  it('includes compliance search route in sidebar', () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'dashboard', component: { template: '<div />' } },
        {
          path: '/compliance/search',
          name: 'compliance-search',
          component: { template: '<div />' },
        },
      ],
    })

    const wrapper = mount(Sidebar, {
      props: { collapsed: false, mobileOpen: false },
      global: { plugins: [pinia, router] },
    })

    expect(wrapper.get('[data-testid="nav-compliance-search"]').text()).toContain(
      'Compliance search',
    )
  })
})
