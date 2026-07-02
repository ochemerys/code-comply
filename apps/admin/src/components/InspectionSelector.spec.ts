import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import InspectionSelector from './InspectionSelector.vue'

const rows = [
  { id: 'a', permitId: 'P-1', label: 'Initial' },
  { id: 'b', permitId: 'P-2', label: 'Follow-up' },
]

describe('InspectionSelector', () => {
  it('renders rows and toggles selection', async () => {
    const wrapper = mount(InspectionSelector, {
      props: { inspections: rows, selectedIds: [] },
    })

    expect(wrapper.find('[data-testid="inspection-selector"]').exists()).toBe(true)
    await wrapper.get('[data-testid="inspection-selector-check-a"]').setValue(true)
    expect(wrapper.emitted('update:selectedIds')?.[0]).toEqual([['a']])
  })

  it('select all emits all ids', async () => {
    const wrapper = mount(InspectionSelector, {
      props: { inspections: rows, selectedIds: [] },
    })

    await wrapper.get('[data-testid="inspection-selector-select-all"]').trigger('click')
    expect(wrapper.emitted('update:selectedIds')?.[0]).toEqual([['a', 'b']])
  })

  it('clear emits empty selection', async () => {
    const wrapper = mount(InspectionSelector, {
      props: { inspections: rows, selectedIds: ['a'] },
    })

    await wrapper.get('[data-testid="inspection-selector-clear"]').trigger('click')
    expect(wrapper.emitted('update:selectedIds')?.[0]).toEqual([[]])
  })

  it('shows empty state when there are no inspections', () => {
    const wrapper = mount(InspectionSelector, {
      props: { inspections: [], selectedIds: [] },
    })

    expect(wrapper.find('[data-testid="inspection-selector-empty"]').exists()).toBe(true)
  })
})
