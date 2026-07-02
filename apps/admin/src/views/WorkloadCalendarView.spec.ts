import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import WorkloadCalendarView from './WorkloadCalendarView.vue'

vi.mock('../composables/useAdminAssignments', () => ({
  isSessionExpiredRedirectError: () => false,
  defaultCalendarWorkloadRange: () => ({
    from: '2024-05-01T00:00:00.000Z',
    to: '2024-05-31T23:59:59.999Z',
  }),
  useCalendarWorkload: () => ({
    data: ref({ inspectors: [], events: [] }),
    isPending: ref(false),
    isFetching: ref(false),
    error: ref(null),
  }),
}))

describe('WorkloadCalendarView', () => {
  it('renders the workload calendar view shell', () => {
    const wrapper = mount(WorkloadCalendarView)
    expect(wrapper.get('[data-testid="workload-calendar-view"]').text()).toContain(
      'Browse inspector workload by month or week',
    )
    expect(wrapper.find('[data-testid="workload-calendar"]').exists()).toBe(true)
  })
})
