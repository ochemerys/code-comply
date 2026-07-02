import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatsCard from './StatsCard.vue'

describe('StatsCard', () => {
  it('renders label and value', () => {
    const wrapper = mount(StatsCard, {
      props: { label: 'Test metric', value: 42 },
    })
    expect(wrapper.text()).toContain('Test metric')
    expect(wrapper.text()).toContain('42')
  })

  it('applies danger styling when requested', () => {
    const wrapper = mount(StatsCard, {
      props: { label: 'Alerts', value: 3, variant: 'danger' },
    })
    expect(wrapper.get('[data-testid="stats-card"]').classes()).toContain('border-red-200')
  })
})
