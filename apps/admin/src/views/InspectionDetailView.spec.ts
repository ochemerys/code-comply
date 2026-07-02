import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import InspectionDetailView from './InspectionDetailView.vue'

const workflow = {
  inspectionId: 'insp-1',
  permitNumber: 'P-100',
  address: '1 Main St',
  status: 'IN_PROGRESS' as const,
  isFinalized: false,
  stages: ['FOUNDATION' as const],
  noFurtherInspectionsRequired: false,
  reInspectionFeeFlagged: false,
  permitReInspectionFeeFlagged: false,
}

vi.mock('../composables/useAdminInspectionDetail', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../composables/useAdminInspectionDetail')>()
  return {
    ...actual,
    isSessionExpiredRedirectError: () => false,
    useAdminInspectionWorkflow: () => ({
      data: ref(workflow),
      isPending: ref(false),
      error: ref(null),
      refetch: vi.fn(),
    }),
    useUpdateInspectionWorkflowMutation: () => ({
      mutateAsync: vi.fn(),
      isPending: ref(false),
    }),
    useNoEntryLetterMutation: () => ({
      mutateAsync: vi.fn(),
      isPending: ref(false),
    }),
  }
})

describe('InspectionDetailView', () => {
  it('renders workflow panels for an inspection', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/inspections/:id',
          name: 'inspection-detail',
          component: InspectionDetailView,
        },
        {
          path: '/inspections/monitor',
          name: 'inspection-monitor',
          component: { template: '<div />' },
        },
        {
          path: '/compliance/records/:id',
          name: 'inspection-record',
          component: { template: '<div />' },
        },
        {
          path: '/inspections/:id/documents',
          name: 'inspection-documents',
          component: { template: '<div />' },
        },
      ],
    })
    await router.push('/inspections/insp-1')

    const wrapper = mount(InspectionDetailView, {
      global: {
        plugins: [router, [VueQueryPlugin, { queryClient: new QueryClient() }]],
      },
    })

    expect(wrapper.find('[data-testid="inspection-detail-view"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="inspection-dates-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="inspection-stages-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="unable-to-enter-panel"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('P-100')
  })
})
