/**
 * Unit tests for PermitDetailView (M4-S11)
 * Renders permit details, schedule list, actions; loading and error states.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import type { PermitDTO } from '@codecomply/validators'
import PermitDetailView from './PermitDetailView.vue'
import PermitsView from './PermitsView.vue'
import { usePermitDetail } from '@/composables/usePermitDetail'
import { resolveChecklistExecutionRouteForConnectivity } from '@/composables/useStartInspectionNavigation'

vi.mock('@/composables/usePermitDetail')
vi.mock('@/composables/useStartInspectionNavigation', () => ({
  resolveChecklistExecutionRouteForConnectivity: vi.fn(),
}))
vi.mock('@/components/GeofenceWarning.vue', () => ({
  default: { name: 'GeofenceWarning', template: '<div data-testid="geofence-stub" />' },
}))

const mockPermit: PermitDTO = {
  id: 'permit-1',
  permitNumber: 'BP-2024-001',
  address: '123 Main St',
  scope: 'Building',
  status: 'ACTIVE',
  latitude: 51.04,
  longitude: -114.06,
  createdAt: '2024-01-15T00:00:00.000Z',
  updatedAt: '2024-01-15T00:00:00.000Z',
  inspections: [
    {
      id: 'insp-1',
      status: 'SCHEDULED',
      scheduledDate: '2024-06-01T10:00:00.000Z',
      assignedInspectorName: 'Jane Doe',
    },
  ],
}

function createRouterWithPermitDetail() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/permits', name: 'permits', component: PermitsView },
      { path: '/permits/:id', name: 'permit-detail', component: PermitDetailView },
      {
        path: '/inspections/:inspectionId/checklist/:executionId',
        name: 'checklist-execution',
        component: { template: '<div data-testid="checklist-route-stub" />' },
      },
      {
        path: '/inspections/:inspectionId/unable-to-enter',
        name: 'unable-to-enter',
        component: { template: '<div data-testid="unable-to-enter-route-stub" />' },
      },
    ],
  })
}

describe('PermitDetailView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(resolveChecklistExecutionRouteForConnectivity).mockResolvedValue({
      inspectionId: 'insp-1',
      executionId: 'exec-test-1',
    })
    vi.mocked(usePermitDetail).mockReturnValue({
      permit: ref(mockPermit),
      isLoading: ref(false),
      error: ref(null),
      isOffline: ref(false),
      refresh: vi.fn(),
    })
  })

  it('renders permit details when permit is loaded', async () => {
    const router = createRouterWithPermitDetail()
    await router.push({ name: 'permit-detail', params: { id: 'permit-1' } })
    const wrapper = mount(PermitDetailView, {
      global: {
        plugins: [router, createPinia()],
      },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('Permit details')
    expect(wrapper.text()).toContain('BP-2024-001')
    expect(wrapper.text()).toContain('Scheduled Inspections')
    expect(wrapper.find('[data-testid="start-inspection-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="start-inspection-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="geofence-stub"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="get-directions-button"]').exists()).toBe(true)
  })

  it('start inspection from schedule tile navigates to checklist execution', async () => {
    const router = createRouterWithPermitDetail()
    await router.push({ name: 'permit-detail', params: { id: 'permit-1' } })
    const wrapper = mount(PermitDetailView, {
      global: {
        plugins: [router, createPinia()],
      },
    })
    await flushPromises()
    await wrapper.find('[data-testid="start-inspection-btn"]').trigger('click')
    await flushPromises()
    expect(resolveChecklistExecutionRouteForConnectivity).toHaveBeenCalled()
    expect(router.currentRoute.value.name).toBe('checklist-execution')
    expect(router.currentRoute.value.params).toMatchObject({
      inspectionId: 'insp-1',
      executionId: 'exec-test-1',
    })
    expect(router.currentRoute.value.query.fromPermit).toBe('permit-1')
  })

  it('shows loading state', async () => {
    vi.mocked(usePermitDetail).mockReturnValue({
      permit: ref(null),
      isLoading: ref(true),
      error: ref(null),
      isOffline: ref(false),
      refresh: vi.fn(),
    })
    const router = createRouterWithPermitDetail()
    await router.push({ name: 'permit-detail', params: { id: 'permit-1' } })
    const wrapper = mount(PermitDetailView, {
      global: { plugins: [router, createPinia()] },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="permit-detail-loading"]').exists()).toBe(true)
  })

  it('shows error state with Try again button', async () => {
    vi.mocked(usePermitDetail).mockReturnValue({
      permit: ref(null),
      isLoading: ref(false),
      error: ref(new Error('Failed to load')),
      isOffline: ref(false),
      refresh: vi.fn(),
    })
    const router = createRouterWithPermitDetail()
    await router.push({ name: 'permit-detail', params: { id: 'permit-1' } })
    const wrapper = mount(PermitDetailView, {
      global: { plugins: [router, createPinia()] },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="permit-detail-error"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Failed to load')
    expect(wrapper.text()).toContain('Try again')
  })

  it('back button navigates to permits list', async () => {
    const router = createRouterWithPermitDetail()
    await router.push({ name: 'permit-detail', params: { id: 'permit-1' } })
    const wrapper = mount(PermitDetailView, {
      global: { plugins: [router, createPinia()] },
    })
    await flushPromises()
    await wrapper.find('[data-testid="back-to-permits"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('permits')
  })

  it('VC-ESCAL-03: shows Unable to enter when a scheduled inspection exists', async () => {
    const router = createRouterWithPermitDetail()
    await router.push({ name: 'permit-detail', params: { id: 'permit-1' } })
    const wrapper = mount(PermitDetailView, {
      global: { plugins: [router, createPinia()] },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="unable-to-enter-button"]').exists()).toBe(true)
    await wrapper.find('[data-testid="unable-to-enter-button"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('unable-to-enter')
    expect(router.currentRoute.value.params.inspectionId).toBe('insp-1')
    expect(router.currentRoute.value.query.fromPermit).toBe('permit-1')
  })
})
