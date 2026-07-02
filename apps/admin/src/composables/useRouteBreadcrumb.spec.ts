import { describe, it, expect } from 'vitest'
import { useRouteBreadcrumb, APP_BREADCRUMB } from './useRouteBreadcrumb'
import { createRouter, createMemoryHistory } from 'vue-router'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'

function mountWithRoute(routes: Parameters<typeof createRouter>[0]['routes'], path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes,
  })

  const Probe = defineComponent({
    setup() {
      return useRouteBreadcrumb()
    },
    template: '<div />',
  })

  return router.push(path).then(async () => {
    await router.isReady()
    const wrapper = mount(Probe, { global: { plugins: [router] } })
    return { wrapper, router }
  })
}

describe('useRouteBreadcrumb', () => {
  it('prepends the app root and uses route meta for the current page', async () => {
    const { wrapper } = await mountWithRoute(
      [{ path: '/reports', component: { template: '<div />' }, meta: { title: 'Reports' } }],
      '/reports',
    )

    expect(wrapper.vm.pageTitle).toBe('Reports')
    expect(wrapper.vm.items).toEqual([APP_BREADCRUMB, { label: 'Reports', to: '/reports' }])
    expect(wrapper.vm.parentItems).toEqual([APP_BREADCRUMB])
  })

  it('builds full breadcrumb trail for nested routes', async () => {
    const Parent = { template: '<router-view />' }
    const Child = { template: '<div />' }

    const { wrapper } = await mountWithRoute(
      [
        {
          path: '/parent',
          component: Parent,
          meta: { title: 'Parent' },
          children: [
            {
              path: 'child',
              name: 'child',
              component: Child,
              meta: { title: 'Child' },
            },
          ],
        },
      ],
      '/parent/child',
    )

    expect(wrapper.vm.pageTitle).toBe('Child')
    expect(wrapper.vm.items).toEqual([
      APP_BREADCRUMB,
      { label: 'Parent', to: '/parent' },
      { label: 'Child', to: '/parent/child' },
    ])
  })
})
