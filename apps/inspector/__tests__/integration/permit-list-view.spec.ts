/**
 * Integration tests for Permit List View (M4-S10).
 * Uses real IndexedDB (fake-indexeddb); list is driven by props from parent in production.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { db } from '../../src/lib/db'
import PermitListView from '../../src/views/PermitListView.vue'
import type { LocalPermit } from '../../src/lib/db/types'
import type { PermitListDTO } from '@codecomply/validators'

function toLocalPermit(
  id: string,
  permitNumber: string,
  address: string,
  status: LocalPermit['status'],
  overrides: Partial<LocalPermit> = {},
): LocalPermit {
  return {
    id,
    permitNumber,
    address,
    status,
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function localToDto(p: LocalPermit): PermitListDTO {
  return {
    id: p.id,
    permitNumber: p.permitNumber,
    address: p.address,
    status: p.status,
    nextInspectionDate: p.nextInspectionDate,
    distance: p.distance,
  }
}

describe('Permit List View Integration', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await db.permits.clear()
  })

  it('displays cards when permits are provided as props', async () => {
    await db.permits.bulkAdd([
      toLocalPermit('p1', 'BP-2024-001', '123 Main St', 'ACTIVE', {
        nextInspectionDate: '2024-06-01T00:00:00.000Z',
        distance: 500,
      }),
      toLocalPermit('p2', 'BP-2024-002', '456 Oak Ave', 'COMPLETED'),
    ])

    const rows = await db.permits.toArray()
    const permits = rows.map(localToDto)

    const wrapper = mount(PermitListView, {
      props: {
        permits,
        isLoading: false,
        searchQuery: '',
      },
      global: { plugins: [createPinia()] },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('BP-2024-001')
    expect(wrapper.text()).toContain('123 Main St')
    expect(wrapper.text()).toContain('BP-2024-002')
    expect(wrapper.text()).toContain('456 Oak Ave')
    const list = wrapper.find('[data-testid="permit-list-cards"]')
    expect(list.exists()).toBe(true)
    expect(wrapper.findAllComponents({ name: 'PermitCard' })).toHaveLength(2)
  })

  it('shows empty state when no permits in cache', async () => {
    const wrapper = mount(PermitListView, {
      props: {
        permits: [],
        isLoading: false,
        searchQuery: '',
      },
      global: { plugins: [createPinia()] },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="permit-list-empty"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('No permits to show')
  })

  it('emits select-permit when a card is clicked', async () => {
    await db.permits.bulkAdd([toLocalPermit('p1', 'BP-2024-001', '123 Main St', 'ACTIVE')])

    const rows = await db.permits.toArray()
    const permits = rows.map(localToDto)

    const wrapper = mount(PermitListView, {
      props: {
        permits,
        isLoading: false,
        searchQuery: '',
      },
      global: { plugins: [createPinia()] },
    })
    await flushPromises()

    const cards = wrapper.findAllComponents({ name: 'PermitCard' })
    expect(cards.length).toBeGreaterThanOrEqual(1)
    await cards[0].find('.permit-card [role="button"]').trigger('click')

    const emitted = wrapper.emitted('select-permit')
    expect(emitted).toBeDefined()
    expect(emitted!).toHaveLength(1)
    expect(emitted![0][0]).toMatchObject({
      id: 'p1',
      permitNumber: 'BP-2024-001',
      address: '123 Main St',
    })
  })
})
