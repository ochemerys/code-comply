import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import AssignmentGridView from './AssignmentGridView.vue'

vi.mock('../composables/useAdminAssignments', () => ({
  startOfWeekMondayIso: () => '2026-05-18',
  isSessionExpiredRedirectError: () => false,
  useAssignmentGrid: () => ({
    data: ref({ inspectors: [], unassigned: [], assignments: [] }),
    isPending: ref(false),
    isFetching: ref(false),
    error: ref(null),
    refetch: vi.fn(),
  }),
  useAssignInspectionMutation: () => ({
    mutateAsync: vi.fn(),
    error: ref(null),
  }),
}))

describe('AssignmentGridView', () => {
  it('renders the assignment grid view shell', () => {
    const wrapper = mount(AssignmentGridView)
    expect(wrapper.get('[data-testid="assignment-grid-view"]').text()).toContain(
      'Plan and rebalance inspector workloads',
    )
    expect(wrapper.find('[data-testid="assignment-grid"]').exists()).toBe(true)
  })
})
