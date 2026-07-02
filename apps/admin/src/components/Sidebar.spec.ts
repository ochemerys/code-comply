import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import Sidebar from './Sidebar.vue'
import { seedAdminAuthStore } from '../test-utils/admin-auth-fixture'

describe('Sidebar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    seedAdminAuthStore()
  })

  it('renders navigation targets from config', () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'dashboard', component: { template: '<div />' }, meta: { title: 'D' } },
        { path: '/users', name: 'users', component: { template: '<div />' }, meta: { title: 'U' } },
      ],
    })

    const wrapper = mount(Sidebar, {
      props: { collapsed: false, mobileOpen: false },
      global: { plugins: [router] },
    })

    expect(wrapper.get('[data-testid="nav-home"]').text()).toContain('Dashboard')
    expect(wrapper.get('[data-testid="nav-users"]').text()).toContain('Users')
  })

  it('emits toggle-collapse when desktop control is activated', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }],
    })

    const wrapper = mount(Sidebar, {
      props: { collapsed: false, mobileOpen: false },
      global: { plugins: [router] },
    })

    await wrapper.get('[data-testid="sidebar-collapse-toggle"]').trigger('click')
    expect(wrapper.emitted('toggle-collapse')).toHaveLength(1)
  })

  it('closes mobile drawer when backdrop is clicked', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }],
    })

    const wrapper = mount(Sidebar, {
      props: { collapsed: false, mobileOpen: true },
      global: { plugins: [router] },
    })

    await wrapper.get('[data-testid="sidebar-backdrop"]').trigger('click')
    expect(wrapper.emitted('close-mobile')).toHaveLength(1)
  })

  it('closes mobile drawer from the close control', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }],
    })

    const wrapper = mount(Sidebar, {
      props: { collapsed: false, mobileOpen: true },
      global: { plugins: [router] },
    })

    await wrapper.get('[data-testid="sidebar-mobile-close"]').trigger('click')
    expect(wrapper.emitted('close-mobile')?.length).toBeGreaterThanOrEqual(1)
  })

  it('fills dashboard column height so the shell is full viewport on desktop (M9-S2-B2)', () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }],
    })

    const wrapper = mount(Sidebar, {
      props: { collapsed: false, mobileOpen: false },
      global: { plugins: [router] },
    })

    const shell = wrapper.get('[data-testid="sidebar-shell"]')
    const aside = wrapper.get('[data-testid="admin-sidebar"]')
    expect(aside.classes()).toContain('flex-1')
    expect(shell.classes()).toContain('self-stretch')
    expect(shell.classes()).toContain('flex-col')
  })
})
