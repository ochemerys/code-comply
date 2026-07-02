import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DeficiencyFilters from './DeficiencyFilters.vue'

describe('DeficiencyFilters', () => {
  it('renders status and severity selects', () => {
    const wrapper = mount(DeficiencyFilters, {
      props: { statusFilter: 'all', severityFilter: 'all' },
    })
    expect(wrapper.find('[data-testid="deficiency-filters"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="deficiency-filter-status"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="deficiency-filter-severity"]').exists()).toBe(true)
  })

  it('emits update when status changes', async () => {
    const wrapper = mount(DeficiencyFilters, {
      props: { statusFilter: 'all', severityFilter: 'all' },
    })
    const sel = wrapper.find('[data-testid="deficiency-filter-status"]')
      .element as HTMLSelectElement
    sel.value = 'OPEN'
    await wrapper.find('[data-testid="deficiency-filter-status"]').trigger('change')
    expect(wrapper.emitted('update:statusFilter')?.[0]).toEqual(['OPEN'])
  })

  it('emits update when severity changes', async () => {
    const wrapper = mount(DeficiencyFilters, {
      props: { statusFilter: 'all', severityFilter: 'all' },
    })
    const sel = wrapper.find('[data-testid="deficiency-filter-severity"]')
      .element as HTMLSelectElement
    sel.value = 'CRITICAL'
    await wrapper.find('[data-testid="deficiency-filter-severity"]').trigger('change')
    expect(wrapper.emitted('update:severityFilter')?.[0]).toEqual(['CRITICAL'])
  })
})
