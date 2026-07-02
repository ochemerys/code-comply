import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import Header from './Header.vue'

describe('Header', () => {
  it('emits toggle-mobile-sidebar when nav button is used', async () => {
    setActivePinia(createPinia())
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' }, meta: { title: 'Dashboard' } }],
    })
    await router.push('/')
    await router.isReady()

    const wrapper = mount(Header, {
      props: { showNavToggle: true },
      global: {
        plugins: [router],
        stubs: { UserMenu: { template: '<div />' } },
      },
    })

    await wrapper.get('[data-testid="mobile-nav-open"]').trigger('click')
    expect(wrapper.emitted('toggle-mobile-sidebar')).toHaveLength(1)
  })

  it('shows app root and page title in breadcrumb style', async () => {
    setActivePinia(createPinia())
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/reports', component: { template: '<div />' }, meta: { title: 'Reports' } },
      ],
    })
    await router.push('/reports')
    await router.isReady()

    const wrapper = mount(Header, {
      global: {
        plugins: [router],
        stubs: { UserMenu: { template: '<div />' } },
      },
    })

    const breadcrumb = wrapper.get('[data-testid="breadcrumb"]')
    expect(breadcrumb.text()).toContain('CodeComply Admin')
    expect(breadcrumb.text()).toContain('Reports')
    expect(wrapper.get('[data-testid="page-title"]').text()).toBe('Reports')
    expect(breadcrumb.find('a[href="/"]').exists()).toBe(true)
  })

  it('renders full breadcrumb trail for nested routes', async () => {
    setActivePinia(createPinia())
    const Parent = { template: '<router-view />' }
    const Child = { template: '<div />' }

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/users',
          component: Parent,
          meta: { title: 'Users' },
          children: [
            {
              path: ':id',
              name: 'user-detail',
              component: Child,
              meta: { title: 'User details' },
            },
          ],
        },
      ],
    })

    await router.push('/users/abc')
    await router.isReady()

    const wrapper = mount(Header, {
      global: {
        plugins: [router],
        stubs: { UserMenu: { template: '<div />' } },
      },
    })

    const breadcrumb = wrapper.get('[data-testid="breadcrumb"]')
    expect(breadcrumb.text()).toContain('CodeComply Admin')
    expect(breadcrumb.text()).toContain('Users')
    expect(wrapper.get('[data-testid="page-title"]').text()).toBe('User details')
    expect(breadcrumb.find('a[href="/users"]').exists()).toBe(true)
  })
})
