import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import BulkAssignment from './BulkAssignment.vue'

const inspectors = [{ id: 'insp-alex', name: 'Alex Inspector' }]
const inspections = [
  { id: 'ins-401', permitId: 'P-24041', label: 'Initial', inspectorId: null },
  { id: 'ins-402', permitId: 'P-24042', label: 'Reinspection', inspectorId: null },
]

describe('BulkAssignment', () => {
  it('renders shell and selector', () => {
    const wrapper = mount(BulkAssignment, { props: { inspectors, inspections } })
    expect(wrapper.find('[data-testid="bulk-assignment"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="inspection-selector"]').exists()).toBe(true)
  })

  it('shows preview when inspector and inspections are selected', async () => {
    const wrapper = mount(BulkAssignment, { props: { inspectors, inspections } })
    await wrapper.get('[data-testid="inspection-selector-check-ins-401"]').setValue(true)
    await wrapper.get('[data-testid="bulk-assignment-inspector"]').setValue('insp-alex')
    await flushPromises()

    expect(wrapper.find('[data-testid="bulk-assignment-preview"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="bulk-assignment-preview-row-ins-401"]').exists()).toBe(true)
  })

  it('emits confirm on bulk assign', async () => {
    const wrapper = mount(BulkAssignment, { props: { inspectors, inspections } })
    await wrapper.get('[data-testid="inspection-selector-check-ins-401"]').setValue(true)
    await wrapper.get('[data-testid="bulk-assignment-inspector"]').setValue('insp-alex')
    await wrapper.get('[data-testid="bulk-assignment-confirm"]').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('confirm')?.[0]?.[0]).toEqual({
      inspectionIds: ['ins-401'],
      inspectorId: 'insp-alex',
    })
  })

  it('shows error when confirming without inspector', async () => {
    const wrapper = mount(BulkAssignment, { props: { inspectors, inspections } })
    await wrapper.get('[data-testid="inspection-selector-check-ins-401"]').setValue(true)
    await wrapper.get('[data-testid="bulk-assignment-confirm"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="bulk-assignment-feedback"]').text()).toContain(
      'Choose an inspector',
    )
  })

  it('shows success via exposed helper', async () => {
    const wrapper = mount(BulkAssignment, { props: { inspectors, inspections } })
    wrapper.vm.showSuccess('Assigned 1 inspection to Alex Inspector.')
    await flushPromises()
    expect(wrapper.get('[data-testid="bulk-assignment-feedback"]').text()).toContain('Assigned')
  })
})
