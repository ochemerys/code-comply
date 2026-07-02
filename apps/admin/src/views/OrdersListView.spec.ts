import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import OrdersListView from './OrdersListView.vue'

const orderRows = ref<unknown[]>([])

vi.mock('../composables/useAdminOrders', () => ({
  useAdminOrders: () => ({
    data: orderRows,
    isPending: ref(false),
    isFetching: ref(false),
    refetch: vi.fn(),
  }),
}))

const routerStub = { RouterLink: { template: '<a><slot /></a>' } }

describe('OrdersListView', () => {
  it('renders the orders list view', () => {
    orderRows.value = []
    const wrapper = mount(OrdersListView, {
      global: { stubs: routerStub },
    })
    expect(wrapper.find('[data-testid="orders-list-view"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="orders-empty"]').text()).toContain('No active')
  })

  it('renders both desktop table and mobile card layouts', () => {
    orderRows.value = [
      {
        deficiencyId: 'def-1',
        permitNumber: 'P-2025-001',
        orderType: 'STOP_WORK',
        inspectorName: 'Alice',
        appealDaysRemaining: 5,
        lockedOut: true,
      },
    ]
    const wrapper = mount(OrdersListView, {
      global: { stubs: routerStub },
    })

    const desktop = wrapper.get('[data-testid="orders-desktop"]')
    expect(desktop.classes()).toContain('hidden')
    expect(desktop.classes()).toContain('md:block')

    const mobile = wrapper.get('[data-testid="orders-mobile"]')
    expect(mobile.classes()).toContain('md:hidden')

    const card = wrapper.get('[data-testid="orders-card-def-1"]')
    expect(card.text()).toContain('P-2025-001')
    expect(card.text()).toContain('Stop Work')
    expect(card.text()).toContain('Alice')
    expect(card.text()).toContain('Locked')
  })
})
