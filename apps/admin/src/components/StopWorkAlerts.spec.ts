import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StopWorkAlerts from './StopWorkAlerts.vue'

describe('StopWorkAlerts', () => {
  it('renders stop work alerts with appeal countdown', () => {
    const wrapper = mount(StopWorkAlerts, {
      props: {
        loading: false,
        alerts: [
          {
            id: 'esc-1',
            deficiencyId: 'def-1',
            inspectionId: 'insp-1',
            orderType: 'STOP_WORK',
            permitNumber: 'P-1',
            inspectorName: 'Alex',
            issuedAt: new Date().toISOString(),
            lockedOut: true,
            appealDeadline: new Date(Date.now() + 86400000 * 5).toISOString(),
            appealDaysRemaining: 5,
          },
          {
            id: 'esc-2',
            deficiencyId: 'def-2',
            inspectionId: 'insp-2',
            orderType: 'STOP_WORK',
            permitNumber: 'P-2',
            inspectorName: 'Sam',
            issuedAt: new Date().toISOString(),
            lockedOut: true,
            appealDeadline: new Date().toISOString(),
            appealDaysRemaining: 0,
          },
        ],
      },
      global: {
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    })

    expect(wrapper.find('[data-testid="stop-work-alerts"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="stop-work-row-def-1"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('5 day(s) remaining')
  })

  it('shows empty state when there are no alerts', () => {
    const wrapper = mount(StopWorkAlerts, {
      props: { loading: false, alerts: [] },
      global: {
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    })

    expect(wrapper.get('[data-testid="stop-work-empty"]').text()).toContain('No Stop Work alerts')
  })
})
