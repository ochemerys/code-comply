import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { RouterView } from 'vue-router'
import DashboardLayout from './DashboardLayout.vue'

describe('DashboardLayout', () => {
  it('renders shell regions for navigation and content', () => {
    const wrapper = mount(DashboardLayout, {
      global: {
        components: { RouterView },
        stubs: {
          Sidebar: { template: '<aside data-testid="sidebar-stub" />' },
          Header: { template: '<header data-testid="header-stub" />' },
          RouterView: { template: '<div data-testid="child-outlet" />' },
        },
      },
    })

    expect(wrapper.find('[data-testid="sidebar-stub"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="header-stub"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="child-outlet"]').exists()).toBe(true)
  })

  it('renders standard app footer for portal shell (M9-S2-B1)', () => {
    const wrapper = mount(DashboardLayout, {
      global: {
        components: { RouterView },
        stubs: {
          Sidebar: { template: '<aside data-testid="sidebar-stub" />' },
          Header: { template: '<header data-testid="header-stub" />' },
          RouterView: { template: '<div data-testid="child-outlet" />' },
        },
      },
    })

    const footer = wrapper.find('[data-testid="app-footer"]')
    expect(footer.exists()).toBe(true)
    expect(footer.element.tagName).toBe('FOOTER')
  })
})
