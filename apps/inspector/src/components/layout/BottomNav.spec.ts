import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import BottomNav from './BottomNav.vue'

// Create a simple router for testing
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'home', component: { template: '<div>Home</div>' } },
    { path: '/permits', name: 'permits', component: { template: '<div>Permits</div>' } },
    { path: '/user-manual', name: 'user-manual', component: { template: '<div>Manual</div>' } },
    { path: '/profile', name: 'profile', component: { template: '<div>Profile</div>' } },
  ],
})

describe('BottomNav', () => {
  let pinia: Pinia

  beforeEach(async () => {
    pinia = createPinia()
    setActivePinia(pinia)
    await router.push('/')
    await router.isReady()
  })

  it('should render navigation items', () => {
    const wrapper = mount(BottomNav, {
      global: {
        plugins: [pinia, router],
      },
    })

    expect(wrapper.text()).toContain('Home')
    expect(wrapper.text()).toContain('Permits')
    expect(wrapper.text()).toContain('Help')
    expect(wrapper.text()).toContain('Profile')
  })

  it('should have correct number of navigation items (3-5)', () => {
    const wrapper = mount(BottomNav, {
      global: {
        plugins: [pinia, router],
      },
    })

    const navLinks = wrapper.findAll('a')
    expect(navLinks.length).toBeGreaterThanOrEqual(3)
    expect(navLinks.length).toBeLessThanOrEqual(5)
  })

  it('should highlight active route', async () => {
    await router.push('/')
    const wrapper = mount(BottomNav, {
      global: {
        plugins: [pinia, router],
      },
    })

    const homeLink = wrapper.find('a[href="/"]')
    expect(homeLink.classes()).toContain('text-primary-600')
    expect(homeLink.attributes('aria-current')).toBe('page')
  })

  it('should show active indicator on current page', async () => {
    await router.push('/permits')
    const wrapper = mount(BottomNav, {
      global: {
        plugins: [pinia, router],
      },
    })

    // Find the active indicator (blue bar at bottom)
    const activeIndicator = wrapper.find('.bg-primary-600.rounded-t-full')
    expect(activeIndicator.exists()).toBe(true)
  })

  it('should have proper accessibility attributes', () => {
    const wrapper = mount(BottomNav, {
      global: {
        plugins: [pinia, router],
      },
    })

    const nav = wrapper.find('nav')
    expect(nav.attributes('role')).toBe('navigation')
    expect(nav.attributes('aria-label')).toBe('Main navigation')
  })

  it('should be hidden on tablet landscape and larger screens', () => {
    const wrapper = mount(BottomNav, {
      global: {
        plugins: [pinia, router],
      },
    })

    const nav = wrapper.find('nav')
    expect(nav.classes()).toContain('tablet-l:hidden')
  })

  it('should have safe area padding at bottom', () => {
    const wrapper = mount(BottomNav, {
      global: {
        plugins: [pinia, router],
      },
    })

    const nav = wrapper.find('nav')
    expect(nav.classes()).toContain('pb-safe-bottom')
  })

  it('should have correct z-index', () => {
    const wrapper = mount(BottomNav, {
      global: {
        plugins: [pinia, router],
      },
    })

    const nav = wrapper.find('nav')
    expect(nav.classes()).toContain('z-nav')
  })

  it('should have minimum touch target height', () => {
    const wrapper = mount(BottomNav, {
      global: {
        plugins: [pinia, router],
      },
    })

    const navLinks = wrapper.findAll('a')
    navLinks.forEach((link) => {
      expect(link.classes()).toContain('min-h-touch')
    })
  })

  it('should have correct href attributes for navigation', () => {
    const wrapper = mount(BottomNav, {
      global: {
        plugins: [pinia, router],
      },
    })

    const homeLink = wrapper.find('a[href="/"]')
    const permitsLink = wrapper.find('a[href="/permits"]')
    const manualLink = wrapper.find('a[href="/user-manual"]')
    const profileLink = wrapper.find('a[href="/profile"]')

    expect(homeLink.exists()).toBe(true)
    expect(permitsLink.exists()).toBe(true)
    expect(manualLink.exists()).toBe(true)
    expect(profileLink.exists()).toBe(true)
  })
})
