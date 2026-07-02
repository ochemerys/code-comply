import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import InspectionStatusList from './InspectionStatusList.vue'

const inspectionDetailRoute = {
  path: '/inspections/:id',
  name: 'inspection-detail',
  component: { template: '<div />' },
}

describe('InspectionStatusList', () => {
  it('renders rows with sync, pending submission, and stop work badges', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [inspectionDetailRoute],
    })

    const wrapper = mount(InspectionStatusList, {
      global: { plugins: [router] },
      props: {
        loading: false,
        items: [
          {
            id: 'i1',
            permitId: 'P-1',
            status: 'IN_PROGRESS',
            inspectorName: 'Alex',
            syncStatus: 'SYNCING',
            pendingSubmission: true,
            stopWorkAlert: true,
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    })
    await router.isReady()

    expect(wrapper.find('[data-testid="inspection-status"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="inspection-workflow-link-i1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="inspection-status-row-i1"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="inspection-sync-i1"]').text()).toContain('SYNCING')
    expect(wrapper.get('[data-testid="inspection-pending-i1"]').text()).toContain(
      'Pending submission',
    )
    expect(wrapper.get('[data-testid="inspection-stop-work-i1"]').text()).toContain('Stop Work')
  })

  it('shows empty state when no items', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [inspectionDetailRoute],
    })

    const wrapper = mount(InspectionStatusList, {
      global: { plugins: [router] },
      props: { loading: false, items: [] },
    })
    await router.isReady()
    expect(wrapper.get('[data-testid="inspection-status-empty"]').text()).toContain(
      'No active inspections',
    )
  })
})
