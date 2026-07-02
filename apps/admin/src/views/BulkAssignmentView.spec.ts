import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import BulkAssignmentView from './BulkAssignmentView.vue'

vi.mock('../composables/useAdminAssignments', () => ({
  isSessionExpiredRedirectError: () => false,
  useBulkAssignmentData: () => ({
    inspectorsQuery: {
      data: ref([]),
      isPending: ref(false),
      error: ref(null),
      refetch: vi.fn(),
    },
    inspectionsQuery: {
      data: ref([]),
      isPending: ref(false),
      error: ref(null),
      refetch: vi.fn(),
    },
  }),
  useBulkAssignMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: ref(false),
  }),
}))

describe('BulkAssignmentView', () => {
  it('renders description and bulk assignment component', () => {
    const wrapper = mount(BulkAssignmentView)
    expect(wrapper.find('[data-testid="bulk-assignment-view"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Select inspections, choose an inspector')
    expect(wrapper.find('[data-testid="bulk-assignment"]').exists()).toBe(true)
  })
})
