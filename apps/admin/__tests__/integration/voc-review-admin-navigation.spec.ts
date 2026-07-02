import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import Sidebar from '../../src/components/Sidebar.vue'
import { seedAdminAuthStore } from '../../src/test-utils/admin-auth-fixture'

describe('admin VoC navigation', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    seedAdminAuthStore()
  })

  it('includes VoC review route in sidebar', () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'dashboard', component: { template: '<div />' } },
        {
          path: '/compliance/voc',
          name: 'voc-review',
          component: { template: '<div />' },
        },
      ],
    })

    const wrapper = mount(Sidebar, {
      props: { collapsed: false, mobileOpen: false },
      global: { plugins: [pinia, router] },
    })

    expect(wrapper.get('[data-testid="nav-compliance-voc"]').text()).toContain('VoC review')
  })
})
