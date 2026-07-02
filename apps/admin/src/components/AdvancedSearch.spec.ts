import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AdvancedSearch from './AdvancedSearch.vue'
import { EMPTY_COMPLIANCE_SEARCH_CRITERIA } from '../composables/useAdminComplianceSearch'

describe('AdvancedSearch (M10-S16)', () => {
  it('renders all FOIP search fields', () => {
    const wrapper = mount(AdvancedSearch, {
      props: {
        criteria: { ...EMPTY_COMPLIANCE_SEARCH_CRITERIA },
        inspectors: [{ id: 'u1', name: 'Alice' }],
      },
    })

    expect(wrapper.find('[data-testid="advanced-search-legal-land"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="advanced-search-permit"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="advanced-search-date-from"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="advanced-search-date-to"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="advanced-search-inspector"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="advanced-search-status"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="advanced-search-outcome"]').exists()).toBe(true)
  })

  it('emits search on submit', async () => {
    const wrapper = mount(AdvancedSearch, {
      props: {
        criteria: { ...EMPTY_COMPLIANCE_SEARCH_CRITERIA, permitNumber: 'P-001' },
        inspectors: [],
      },
    })

    await wrapper.find('[data-testid="advanced-search-form"]').trigger('submit.prevent')
    expect(wrapper.emitted('search')).toHaveLength(1)
  })

  it('emits reset when reset clicked', async () => {
    const wrapper = mount(AdvancedSearch, {
      props: {
        criteria: { ...EMPTY_COMPLIANCE_SEARCH_CRITERIA },
        inspectors: [],
      },
    })

    await wrapper.find('[data-testid="advanced-search-reset"]').trigger('click')
    expect(wrapper.emitted('reset')).toHaveLength(1)
  })
})
