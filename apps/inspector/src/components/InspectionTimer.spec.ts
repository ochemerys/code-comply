import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import InspectionTimer from './InspectionTimer.vue'

describe('InspectionTimer', () => {
  it('renders display time and running test id when active', () => {
    const w = mount(InspectionTimer, {
      props: { displayTime: '00:01:30', isRunning: true },
    })
    expect(w.find('[data-testid="inspection-timer"]').exists()).toBe(true)
    expect(w.text()).toContain('00:01:30')
    expect(w.find('[data-testid="inspection-timer-running"]').exists()).toBe(true)
    w.unmount()
  })

  it('uses stopped test id when not running', () => {
    const w = mount(InspectionTimer, {
      props: { displayTime: '00:05:00', isRunning: false },
    })
    expect(w.find('[data-testid="inspection-timer-stopped"]').exists()).toBe(true)
    w.unmount()
  })
})
