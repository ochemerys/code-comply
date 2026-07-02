/**
 * Admin portal integration: VoC review and report generation navigation (M11-S15).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import Sidebar from '../../src/components/Sidebar.vue'
import { seedAdminAuthStore } from '../../src/test-utils/admin-auth-fixture'

describe('User flows — admin navigation (M11-S15)', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    seedAdminAuthStore()
  })

  it('exposes VoC review and Reports routes for compliance workflows', () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'dashboard', component: { template: '<div />' } },
        {
          path: '/compliance/voc',
          name: 'voc-review',
          component: { template: '<div />' },
        },
        { path: '/reports', name: 'reports', component: { template: '<div />' } },
      ],
    })

    const wrapper = mount(Sidebar, {
      props: { collapsed: false, mobileOpen: false },
      global: { plugins: [pinia, router] },
    })

    expect(wrapper.get('[data-testid="nav-compliance-voc"]').text()).toContain('VoC review')
    expect(wrapper.get('[data-testid="nav-reports"]').text()).toContain('Reports')
  })

  it('navigates to VoC review route', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'dashboard', component: { template: '<div />' } },
        {
          path: '/compliance/voc',
          name: 'voc-review',
          component: { template: '<div data-testid="voc-page" />' },
        },
      ],
    })
    await router.push('/compliance/voc')
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('voc-review')
  })
})
