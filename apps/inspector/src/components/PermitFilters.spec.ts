/**
 * Unit tests for PermitFilters component (M4-S10)
 * Filter by status, hasScheduledInspection; sort by date, distance, permitNumber.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PermitFilters from './PermitFilters.vue'

describe('PermitFilters', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders status filter with options', () => {
    const wrapper = mount(PermitFilters, {
      props: {
        statusFilter: 'ALL',
        hasScheduledInspectionOnly: false,
        sortBy: 'permitNumber',
      },
      global: { plugins: [createPinia()] },
    })
    const statusSelect = wrapper.find('#permit-status-filter')
    expect(statusSelect.exists()).toBe(true)
    expect(statusSelect.element.tagName).toBe('SELECT')
    expect(wrapper.text()).toContain('All statuses')
    expect(wrapper.text()).toContain('Active')
  })

  it('renders sort select with options', () => {
    const wrapper = mount(PermitFilters, {
      props: {
        statusFilter: 'ALL',
        hasScheduledInspectionOnly: false,
        sortBy: 'permitNumber',
      },
      global: { plugins: [createPinia()] },
    })
    const sortSelect = wrapper.find('#permit-sort')
    expect(sortSelect.exists()).toBe(true)
    expect(wrapper.text()).toContain('Permit number')
    expect(wrapper.text()).toContain('Next inspection date')
    expect(wrapper.text()).toContain('Distance')
  })

  it('renders has scheduled inspection checkbox', () => {
    const wrapper = mount(PermitFilters, {
      props: {
        statusFilter: 'ALL',
        hasScheduledInspectionOnly: false,
        sortBy: 'permitNumber',
      },
      global: { plugins: [createPinia()] },
    })
    const checkbox = wrapper.find('#permit-has-scheduled')
    expect(checkbox.exists()).toBe(true)
    expect(checkbox.element.tagName).toBe('INPUT')
    expect((checkbox.element as HTMLInputElement).type).toBe('checkbox')
    expect(wrapper.text()).toContain('Only with scheduled inspection')
  })

  it('emits update:statusFilter when status select changes', async () => {
    const wrapper = mount(PermitFilters, {
      props: {
        statusFilter: 'ALL',
        hasScheduledInspectionOnly: false,
        sortBy: 'permitNumber',
      },
      global: { plugins: [createPinia()] },
    })
    await wrapper.find('#permit-status-filter').setValue('ACTIVE')
    expect(wrapper.emitted('update:statusFilter')).toHaveLength(1)
    expect(wrapper.emitted('update:statusFilter')![0]).toEqual(['ACTIVE'])
  })

  it('emits update:sortBy when sort select changes', async () => {
    const wrapper = mount(PermitFilters, {
      props: {
        statusFilter: 'ALL',
        hasScheduledInspectionOnly: false,
        sortBy: 'permitNumber',
      },
      global: { plugins: [createPinia()] },
    })
    await wrapper.find('#permit-sort').setValue('distance')
    expect(wrapper.emitted('update:sortBy')).toHaveLength(1)
    expect(wrapper.emitted('update:sortBy')![0]).toEqual(['distance'])
  })

  it('emits update:hasScheduledInspectionOnly when checkbox toggled', async () => {
    const wrapper = mount(PermitFilters, {
      props: {
        statusFilter: 'ALL',
        hasScheduledInspectionOnly: false,
        sortBy: 'permitNumber',
      },
      global: { plugins: [createPinia()] },
    })
    await wrapper.find('#permit-has-scheduled').setValue(true)
    expect(wrapper.emitted('update:hasScheduledInspectionOnly')).toHaveLength(1)
    expect(wrapper.emitted('update:hasScheduledInspectionOnly')![0]).toEqual([true])
  })

  it('disables controls when disabled prop is true', () => {
    const wrapper = mount(PermitFilters, {
      props: {
        statusFilter: 'ALL',
        hasScheduledInspectionOnly: false,
        sortBy: 'permitNumber',
        disabled: true,
      },
      global: { plugins: [createPinia()] },
    })
    expect((wrapper.find('#permit-status-filter').element as HTMLSelectElement).disabled).toBe(true)
    expect((wrapper.find('#permit-sort').element as HTMLSelectElement).disabled).toBe(true)
    expect((wrapper.find('#permit-has-scheduled').element as HTMLInputElement).disabled).toBe(true)
  })
})
