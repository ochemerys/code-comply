import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import WorkloadCalendar from './WorkloadCalendar.vue'

const inspectors = [
  { id: 'insp-alex', name: 'Alex Inspector' },
  { id: 'insp-sam', name: 'Sam SCO' },
]

const inspections = [
  {
    id: 'wl-701',
    permitId: 'P-24001',
    title: 'Initial inspection',
    start: '2026-05-18T09:00:00.000Z',
    inspectorId: 'insp-alex',
    status: 'scheduled' as const,
  },
  {
    id: 'wl-703',
    permitId: 'P-24003',
    title: 'Reinspection',
    start: '2026-05-20T10:00:00.000Z',
    inspectorId: 'insp-sam',
    status: 'completed' as const,
  },
]

describe('WorkloadCalendar', () => {
  it('renders the calendar shell', () => {
    const wrapper = mount(WorkloadCalendar, { props: { inspectors, inspections } })
    expect(wrapper.find('[data-testid="workload-calendar"]').exists()).toBe(true)
  })

  it('renders FullCalendar chrome', async () => {
    const wrapper = mount(WorkloadCalendar, { props: { inspectors, inspections } })
    await flushPromises()
    expect(wrapper.find('.fc').exists()).toBe(true)
  })

  it('shows all inspections when no inspector filter is applied', () => {
    const wrapper = mount(WorkloadCalendar, { props: { inspectors, inspections } })
    expect(wrapper.get('[data-testid="workload-calendar-filtered-count"]').text()).toContain('2')
  })

  it('filters inspections by inspector', async () => {
    const wrapper = mount(WorkloadCalendar, { props: { inspectors, inspections } })
    const select = wrapper.get('[data-testid="workload-calendar-inspector-filter"]')
    await select.setValue('insp-alex')
    await flushPromises()

    expect(wrapper.get('[data-testid="workload-calendar-filtered-count"]').text()).toContain('1')
  })

  it('emits datesSet when the visible range changes', async () => {
    const wrapper = mount(WorkloadCalendar, { props: { inspectors, inspections } })
    await flushPromises()

    const fc = wrapper.findComponent({ name: 'FullCalendar' })
    if (fc.exists()) {
      const options = fc.props('options') as {
        datesSet?: (arg: { start: Date; end: Date }) => void
      }
      options.datesSet?.({
        start: new Date('2024-05-01T00:00:00.000Z'),
        end: new Date('2024-06-01T00:00:00.000Z'),
      } as never)
      expect(wrapper.emitted('datesSet')?.[0]?.[0]).toEqual({
        start: new Date('2024-05-01T00:00:00.000Z'),
        end: new Date('2024-06-01T00:00:00.000Z'),
      })
    }
  })

  it('opens details when an event is clicked', async () => {
    const wrapper = mount(WorkloadCalendar, { props: { inspectors, inspections } })
    await flushPromises()

    const firstEvent = wrapper.find('.fc-event')
    expect(firstEvent.exists()).toBe(true)
    await firstEvent.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="workload-calendar-details-modal"]').exists()).toBe(true)
  })
})
