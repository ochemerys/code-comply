import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DashboardCharts from './DashboardCharts.vue'

describe('DashboardCharts (M11-S8)', () => {
  it('renders stat cards and bar chart when stats are provided', () => {
    const wrapper = mount(DashboardCharts, {
      props: {
        stats: {
          activeInspectors: 8,
          pendingInspections: 12,
          completedToday: 4,
          stopWorkOrders: 1,
        },
      },
    })

    expect(wrapper.find('[data-testid="dashboard-charts"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Active inspectors')
    expect(wrapper.find('[data-testid="dashboard-charts-bars"]').exists()).toBe(true)
  })

  it('shows loading state when loading prop is true', () => {
    const wrapper = mount(DashboardCharts, {
      props: {
        loading: true,
        stats: {
          activeInspectors: 1,
          pendingInspections: 2,
          completedToday: 3,
          stopWorkOrders: 0,
        },
      },
    })

    expect(wrapper.find('[data-testid="dashboard-charts-loading"]').exists()).toBe(true)
  })
})
