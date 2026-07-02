import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChecklistFilter from './ChecklistFilter.vue'

describe('ChecklistFilter', () => {
  it('renders options and counts', () => {
    const wrapper = mount(ChecklistFilter, {
      props: { modelValue: 'all', failedCount: 2, unansweredCount: 5 },
    })
    expect(wrapper.find('[data-testid="checklist-filter-all"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="checklist-filter-failed"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="checklist-filter-unanswered"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="checklist-filter-failed-count"]').text()).toBe('2')
    expect(wrapper.find('[data-testid="checklist-filter-unanswered-count"]').text()).toBe('5')
  })

  it('emits update when option is clicked', async () => {
    const wrapper = mount(ChecklistFilter, {
      props: { modelValue: 'all', failedCount: 0, unansweredCount: 0 },
    })
    await wrapper.find('[data-testid="checklist-filter-failed"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['failed'])
  })
})
