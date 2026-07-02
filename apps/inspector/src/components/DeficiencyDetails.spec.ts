import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DeficiencyDetails from './DeficiencyDetails.vue'
import type { LocalDeficiency } from '@/lib/db/types'

function def(overrides: Partial<LocalDeficiency> = {}): LocalDeficiency {
  return {
    id: 'd1',
    clientId: 'c1',
    inspectionId: 'insp-1',
    createdById: 'u1',
    description: 'Sample deficiency description with enough text for the view.',
    location: 'Mechanical room',
    severity: 'MAJOR',
    status: 'OPEN',
    codeReference: { code: 'NBC', section: '6.2.3', title: 'Means of egress' },
    isStopWork: false,
    isUnsafe: true,
    dueDate: '2026-08-01T12:00:00.000Z',
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-02T15:30:00.000Z',
    isDirty: false,
    ...overrides,
  }
}

describe('DeficiencyDetails', () => {
  it('renders fields, code reference, and status history', () => {
    const d = def()
    const history = [
      {
        at: d.createdAt,
        label: 'Recorded',
        detail: 'Created',
        status: 'OPEN' as const,
      },
      {
        at: d.updatedAt,
        label: 'Last updated',
        detail: 'Saved',
        status: 'OPEN' as const,
      },
    ]
    const wrapper = mount(DeficiencyDetails, {
      props: {
        deficiency: d,
        statusHistory: history,
      },
    })
    expect(wrapper.find('[data-testid="deficiency-detail-description"]').text()).toContain(
      'Sample deficiency',
    )
    expect(wrapper.find('[data-testid="deficiency-detail-location"]').text()).toContain(
      'Mechanical',
    )
    expect(wrapper.find('[data-testid="deficiency-detail-code-reference"]').text()).toContain('NBC')
    expect(
      wrapper.find('[data-testid="deficiency-detail-status-history"]').findAll('li').length,
    ).toBe(2)
  })

  it('shows unsafe condition badge when isUnsafe (M6-S16)', () => {
    const wrapper = mount(DeficiencyDetails, {
      props: {
        deficiency: def({ isUnsafe: true }),
        statusHistory: [],
      },
    })
    expect(wrapper.find('[data-testid="deficiency-detail-unsafe"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="deficiency-detail-unsafe"]').text()).toMatch(/unsafe/i)
  })

  it('hides unsafe badge when not unsafe', () => {
    const wrapper = mount(DeficiencyDetails, {
      props: {
        deficiency: def({ isUnsafe: false }),
        statusHistory: [],
      },
    })
    expect(wrapper.find('[data-testid="deficiency-detail-unsafe"]').exists()).toBe(false)
  })

  it('shows empty code state when no reference', () => {
    const wrapper = mount(DeficiencyDetails, {
      props: {
        deficiency: def({ codeReference: undefined }),
        statusHistory: [],
      },
    })
    expect(wrapper.find('[data-testid="deficiency-detail-code-empty"]').exists()).toBe(true)
  })

  it('emits edit and delete-request for parent-managed confirmation dialog', async () => {
    const wrapper = mount(DeficiencyDetails, {
      props: {
        deficiency: def(),
        statusHistory: [],
      },
    })
    await wrapper.find('[data-testid="deficiency-detail-edit"]').trigger('click')
    expect(wrapper.emitted('edit')).toBeTruthy()

    await wrapper.find('[data-testid="deficiency-detail-delete"]').trigger('click')
    expect(wrapper.emitted('delete-request')).toBeTruthy()
  })

  it('emits stop-work-request from Stop Work CTA when not already issued', async () => {
    const wrapper = mount(DeficiencyDetails, {
      props: {
        deficiency: def({ isStopWork: false }),
        statusHistory: [],
      },
    })
    expect(wrapper.find('[data-testid="deficiency-stop-work-section"]').exists()).toBe(true)
    await wrapper.find('[data-testid="stop-work-order-button"]').trigger('click')
    expect(wrapper.emitted('stop-work-request')).toBeTruthy()
  })

  it('hides Stop Work CTA when deficiency already has Stop Work', () => {
    const wrapper = mount(DeficiencyDetails, {
      props: {
        deficiency: def({ isStopWork: true }),
        statusHistory: [],
      },
    })
    expect(wrapper.find('[data-testid="deficiency-stop-work-section"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="deficiency-detail-stop-work"]').exists()).toBe(true)
  })

  it('disables mark resolved when already closed', () => {
    const wrapper = mount(DeficiencyDetails, {
      props: {
        deficiency: def({ status: 'CLOSED' }),
        statusHistory: [],
      },
    })
    const btn = wrapper.find('[data-testid="deficiency-detail-mark-resolved"]')
    expect(btn.attributes('disabled')).toBeDefined()
  })
})
