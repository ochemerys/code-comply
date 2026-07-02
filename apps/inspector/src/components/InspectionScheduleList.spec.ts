/**
 * Unit tests for InspectionScheduleList component (M4-S11)
 * Renders scheduled inspections and Start Inspection button for SCHEDULED.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import InspectionScheduleList from './InspectionScheduleList.vue'
import type { PermitDetailInspection } from '@/composables/usePermitDetail'

const inspections: PermitDetailInspection[] = [
  {
    id: 'insp-1',
    status: 'SCHEDULED',
    scheduledDate: '2024-06-01T10:00:00.000Z',
    assignedInspectorName: 'Jane Doe',
  },
  {
    id: 'insp-2',
    status: 'PASSED',
    scheduledDate: '2024-05-01T10:00:00.000Z',
    completedDate: '2024-05-01T12:00:00.000Z',
  },
]

describe('InspectionScheduleList', () => {
  it('renders section heading', () => {
    const wrapper = mount(InspectionScheduleList, { props: { inspections } })
    expect(wrapper.text()).toContain('Scheduled Inspections')
  })

  it('renders empty state when no inspections', () => {
    const wrapper = mount(InspectionScheduleList, { props: { inspections: [] } })
    expect(wrapper.find('[data-testid="inspection-schedule-empty"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('No scheduled inspections')
  })

  it('renders list of inspections with dates and status', () => {
    const wrapper = mount(InspectionScheduleList, { props: { inspections } })
    expect(wrapper.find('[data-testid="inspection-schedule-list"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('SCHEDULED')
    expect(wrapper.text()).toContain('PASSED')
    expect(wrapper.text()).toContain('Jane Doe')
  })

  it('shows Start Inspection button only for SCHEDULED inspection', () => {
    const wrapper = mount(InspectionScheduleList, { props: { inspections } })
    const buttons = wrapper.findAll('[data-testid="start-inspection-btn"]')
    expect(buttons).toHaveLength(1)
  })

  it('emits start-inspection when Start Inspection is clicked', async () => {
    const wrapper = mount(InspectionScheduleList, { props: { inspections } })
    await wrapper.find('[data-testid="start-inspection-btn"]').trigger('click')
    expect(wrapper.emitted('start-inspection')).toHaveLength(1)
    expect(wrapper.emitted('start-inspection')?.[0]).toEqual([inspections[0]])
  })
})
