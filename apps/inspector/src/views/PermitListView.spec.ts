/**
 * Unit tests for PermitListView (M4-S10)
 * List renders permits, card fields, empty state.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PermitListView from './PermitListView.vue'
import type { PermitListDTO } from '@codecomply/validators'

const mockPermit: PermitListDTO = {
  id: 'p1',
  permitNumber: 'BP-2024-001',
  address: '123 Main St',
  status: 'ACTIVE',
  nextInspectionDate: '2024-06-01T00:00:00.000Z',
  distance: 500,
}

describe('PermitListView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders header and count when loaded', async () => {
    const wrapper = mount(PermitListView, {
      props: {
        permits: [mockPermit],
        isLoading: false,
        searchQuery: '',
      },
      global: { plugins: [createPinia()] },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('Your permits')
    expect(wrapper.find('[data-testid="permit-list-count"]').text()).toContain('1 permit')
  })

  it('shows loading state when isLoading', () => {
    const wrapper = mount(PermitListView, {
      props: {
        permits: [],
        isLoading: true,
        searchQuery: '',
      },
      global: { plugins: [createPinia()] },
    })
    expect(wrapper.find('[data-testid="permit-list-loading"]').exists()).toBe(true)
  })

  it('shows list of cards when data is ready', () => {
    const wrapper = mount(PermitListView, {
      props: {
        permits: [mockPermit],
        isLoading: false,
        searchQuery: '',
      },
      global: { plugins: [createPinia()] },
    })
    expect(wrapper.find('[data-testid="permit-list-cards"]').exists()).toBe(true)
    expect(wrapper.findAllComponents({ name: 'PermitCard' })).toHaveLength(1)
    expect(wrapper.text()).toContain('BP-2024-001')
  })

  it('shows empty state when no permits', () => {
    const wrapper = mount(PermitListView, {
      props: {
        permits: [],
        isLoading: false,
        searchQuery: '',
      },
      global: { plugins: [createPinia()] },
    })
    expect(wrapper.find('[data-testid="permit-list-empty"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('No permits to show')
    expect(wrapper.text()).toContain('Refresh')
  })

  it('emits select-permit when a card is clicked', async () => {
    const wrapper = mount(PermitListView, {
      props: {
        permits: [mockPermit],
        isLoading: false,
        searchQuery: '',
      },
      global: { plugins: [createPinia()] },
    })
    const card = wrapper.findComponent({ name: 'PermitCard' })
    const permit = card.props('permit')
    await card.find('[role="button"]').trigger('click')
    const emitted = wrapper.emitted('select-permit')
    expect(emitted).toBeDefined()
    expect(emitted).toHaveLength(1)
    expect(emitted![0][0]).toMatchObject({
      id: permit.id,
      permitNumber: permit.permitNumber,
      address: permit.address,
    })
  })

  it('emits refresh when empty state Refresh is clicked', async () => {
    const wrapper = mount(PermitListView, {
      props: {
        permits: [],
        isLoading: false,
        searchQuery: '',
      },
      global: { plugins: [createPinia()] },
    })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })
})
