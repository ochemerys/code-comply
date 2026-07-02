import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RecentInspections from './RecentInspections.vue'

describe('RecentInspections', () => {
  it('shows loading text', () => {
    const wrapper = mount(RecentInspections, {
      props: { items: [], loading: true },
    })
    expect(wrapper.text()).toContain('Loading')
  })

  it('lists rows when loaded', () => {
    const wrapper = mount(RecentInspections, {
      props: {
        loading: false,
        items: [
          {
            id: '1',
            permitId: 'P-1',
            status: 'DONE',
            inspectorName: 'Pat',
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    })
    expect(wrapper.text()).toContain('P-1')
    expect(wrapper.text()).toContain('Pat')
  })
})
