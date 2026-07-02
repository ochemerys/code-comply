import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import SideNav from './SideNav.vue'

// Create a simple router for testing
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'home', component: { template: '<div>Home</div>' } },
    { path: '/permits', name: 'permits', component: { template: '<div>Permits</div>' } },
    { path: '/profile', name: 'profile', component: { template: '<div>Profile</div>' } },
    { path: '/user-manual', name: 'user-manual', component: { template: '<div>Manual</div>' } },
  ],
})

describe('SideNav', () => {
  let pinia: Pinia

  beforeEach(async () => {
    pinia = createPinia()
    setActivePinia(pinia)
    await router.push('/')
    await router.isReady()
  })

  it('should render app name as a home link in the sidebar brand', () => {
    const wrapper = mount(SideNav, {
      global: {
        plugins: [pinia, router],
      },
    })

    const brandLink = wrapper.find('a[href="/"]')
    expect(brandLink.exists()).toBe(true)
    expect(brandLink.text()).toContain('CodeComply Field')
    expect(brandLink.find('[data-testid="app-brand-wordmark"]').exists()).toBe(true)
    expect(brandLink.attributes('aria-label')).toBe('CodeComply Field home')
  })

  it('should render navigation items', () => {
    const wrapper = mount(SideNav, {
      global: {
        plugins: [pinia, router],
      },
    })

    expect(wrapper.text()).toContain('Home')
    expect(wrapper.text()).toContain('Permits')
    expect(wrapper.text()).toContain('Profile')
  })

  it('should have correct width (256px / w-64)', () => {
    const wrapper = mount(SideNav, {
      global: {
        plugins: [pinia, router],
      },
    })

    const aside = wrapper.find('aside')
    expect(aside.classes()).toContain('w-64')
  })

  it('should highlight active route with pill state', async () => {
    await router.push('/permits')
    const wrapper = mount(SideNav, {
      global: {
        plugins: [pinia, router],
      },
    })

    const permitsLink = wrapper.find('a[href="/permits"]')
    expect(permitsLink.classes()).toContain('bg-blue-50')
    expect(permitsLink.classes()).toContain('text-blue-600')
    expect(permitsLink.classes()).toContain('font-medium')
    expect(permitsLink.attributes('aria-current')).toBe('page')
  })

  it('should have proper accessibility attributes', () => {
    const wrapper = mount(SideNav, {
      global: {
        plugins: [pinia, router],
      },
    })

    const aside = wrapper.find('aside')
    expect(aside.attributes('role')).toBe('navigation')
    expect(aside.attributes('aria-label')).toBe('Main navigation')
  })

  it('should be hidden on phone and tablet portrait', () => {
    const wrapper = mount(SideNav, {
      global: {
        plugins: [pinia, router],
      },
    })

    const aside = wrapper.find('aside')
    expect(aside.classes()).toContain('hidden')
    expect(aside.classes()).toContain('tablet-l:flex')
  })

  it('should be fixed positioned', () => {
    const wrapper = mount(SideNav, {
      global: {
        plugins: [pinia, router],
      },
    })

    const aside = wrapper.find('aside')
    expect(aside.classes()).toContain('fixed')
    expect(aside.classes()).toContain('left-0')
    expect(aside.classes()).toContain('top-0')
  })

  it('should have correct z-index', () => {
    const wrapper = mount(SideNav, {
      global: {
        plugins: [pinia, router],
      },
    })

    const aside = wrapper.find('aside')
    expect(aside.classes()).toContain('z-nav')
  })

  it('should have minimum touch target height for nav items', () => {
    const wrapper = mount(SideNav, {
      global: {
        plugins: [pinia, router],
      },
    })

    const navLinks = wrapper.findAll('nav a')
    navLinks.forEach((link) => {
      expect(link.classes()).toContain('h-11')
      expect(link.classes()).toContain('min-h-touch')
    })
  })

  it('should display version in footer', () => {
    const wrapper = mount(SideNav, {
      global: {
        plugins: [pinia, router],
      },
    })

    expect(wrapper.text()).toContain('v1.0.0')
  })

  it('should have correct href attributes for navigation', () => {
    const wrapper = mount(SideNav, {
      global: {
        plugins: [pinia, router],
      },
    })

    const homeLink = wrapper.find('a[href="/"]')
    const permitsLink = wrapper.find('a[href="/permits"]')
    const profileLink = wrapper.find('a[href="/profile"]')

    expect(homeLink.exists()).toBe(true)
    expect(permitsLink.exists()).toBe(true)
    expect(profileLink.exists()).toBe(true)
  })

  it('should have full height', () => {
    const wrapper = mount(SideNav, {
      global: {
        plugins: [pinia, router],
      },
    })

    const aside = wrapper.find('aside')
    expect(aside.classes()).toContain('h-screen')
  })

  it('should have scrollable navigation area', () => {
    const wrapper = mount(SideNav, {
      global: {
        plugins: [pinia, router],
      },
    })

    const navArea = wrapper.find('nav')
    expect(navArea.classes()).toContain('overflow-y-auto')
  })
})
