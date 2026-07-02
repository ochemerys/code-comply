import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import InspectionSummary from './InspectionSummary.vue'

describe('InspectionSummary', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders permit number, address, status, date and inspector name', () => {
    const wrapper = mount(InspectionSummary, {
      props: {
        inspection: {
          id: 'insp-1',
          clientId: 'c-1',
          permitId: 'perm-1',
          permitNumber: 'BP-2026-001',
          permitAddress: '100 Test St',
          status: 'IN_PROGRESS',
          scheduledDate: '2026-04-01T10:00:00.000Z',
          assignedToId: 'u-1',
          createdAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-04-01T10:00:00.000Z',
          isDirty: false,
        },
      },
    })

    expect(wrapper.find('[data-testid="inspection-summary"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="inspection-summary-permit"]').text()).toContain(
      'BP-2026-001',
    )
    expect(wrapper.find('[data-testid="inspection-summary-address"]').text()).toContain(
      '100 Test St',
    )
    expect(wrapper.find('[data-testid="inspection-summary-status"]').text()).toContain(
      'IN_PROGRESS',
    )
    expect(wrapper.find('[data-testid="inspection-summary-date"]').text().length).toBeGreaterThan(0)
    expect(wrapper.find('[data-testid="inspection-summary-inspector"]').text()).toContain(
      'Inspector',
    )
  })

  it('falls back to raw date string when scheduledDate is invalid', () => {
    const wrapper = mount(InspectionSummary, {
      props: {
        inspection: {
          id: 'insp-2',
          clientId: 'c-2',
          permitId: 'perm-2',
          status: 'SCHEDULED',
          scheduledDate: 'not-a-date',
          assignedToId: 'u-2',
          createdAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-04-01T10:00:00.000Z',
          isDirty: false,
        },
      },
    })
    expect(wrapper.find('[data-testid="inspection-summary-date"]').text()).toContain('not-a-date')
  })
})
