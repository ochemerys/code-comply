import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import PermitsView from './PermitsView.vue'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

const { mockRefresh } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
}))

vi.mock('@/composables/usePermitList', async () => {
  const { ref, computed } = await import('vue')
  return {
    usePermitList: () => ({
      permits: computed(() => []),
      allPermits: ref([]),
      isLoading: ref(false),
      statusFilter: ref('ALL'),
      hasScheduledInspectionOnly: ref(false),
      sortBy: ref('permitNumber'),
      refresh: mockRefresh,
    }),
  }
})

// Mock the composables
vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({
    user: { value: { name: 'Test User', email: 'test@example.com' } },
    isAuthenticated: true,
    logout: vi.fn(),
  }),
}))

vi.mock('../composables/useSyncStatus', () => ({
  useSyncStatus: () => ({
    status: 'online',
    pendingCount: 0,
  }),
}))

vi.mock('../composables/useNearbyPermits', () => ({
  useNearbyPermits: () => ({
    permits: { value: [] },
    isLoading: { value: false },
    error: { value: null },
    position: { value: null },
    gpsError: { value: null },
    isGettingLocation: { value: false },
    isGpsSupported: { value: true },
    radius: { value: 5000 },
    fetchNearbyPermits: vi.fn(),
    refetch: vi.fn(),
  }),
}))

describe('PermitsView', () => {
  let router: Router
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.accessToken = 'test-token'

    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    } as Response)

    // Create a router with the necessary routes
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/',
          name: 'home',
          component: { template: '<div>Home</div>' },
        },
        {
          path: '/permits',
          name: 'permits',
          component: PermitsView,
        },
        {
          path: '/permits/:id',
          name: 'permit-detail',
          component: { template: '<div>Permit Detail</div>' },
        },
      ],
    })
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  describe('component structure', () => {
    it('should render the page header with title', () => {
      const wrapper = mount(PermitsView, {
        global: {
          plugins: [router],
          stubs: {
            AppHeader: true,
            FindNearbyPermits: true,
            PermitListView: true,
          },
        },
      })

      const header = wrapper.find('header')
      expect(header.exists()).toBe(true)
      expect(header.find('h1').text()).toBe('Permits')
    })

    it('should render the page description', () => {
      const wrapper = mount(PermitsView, {
        global: {
          plugins: [router],
          stubs: {
            AppHeader: true,
            FindNearbyPermits: true,
            PermitListView: true,
          },
        },
      })

      const description = wrapper.find('header p.text-sm.text-text-dim')
      expect(description.exists()).toBe(true)
      expect(description.text()).toContain(
        'Assigned permits sync to this device when you open the page',
      )
    })

    it('should leave application chrome to AppShell', () => {
      const wrapper = mount(PermitsView, {
        global: {
          plugins: [router],
          stubs: {
            AppHeader: true,
            FindNearbyPermits: true,
            PermitListView: true,
          },
        },
      })

      expect(wrapper.findComponent({ name: 'AppHeader' }).exists()).toBe(false)
    })

    it('should render FindNearbyPermits component', () => {
      const wrapper = mount(PermitsView, {
        global: {
          plugins: [router],
          stubs: {
            AppHeader: true,
            FindNearbyPermits: true,
            PermitListView: true,
          },
        },
      })

      expect(wrapper.findComponent({ name: 'FindNearbyPermits' }).exists()).toBe(true)
    })

    it('should render PermitListView component', () => {
      const wrapper = mount(PermitsView, {
        global: {
          plugins: [router],
          stubs: {
            AppHeader: true,
            FindNearbyPermits: true,
            PermitListView: true,
          },
        },
      })

      expect(wrapper.findComponent({ name: 'PermitListView' }).exists()).toBe(true)
    })

    it('should have proper ARIA labels for sections', () => {
      const wrapper = mount(PermitsView, {
        global: {
          plugins: [router],
          stubs: {
            AppHeader: true,
            FindNearbyPermits: true,
            PermitListView: true,
          },
        },
      })

      const filterSection = wrapper.find('[aria-label="Search and filter your list"]')
      expect(filterSection.exists()).toBe(true)

      const addFromServerSection = wrapper.find('[aria-label="Add permits from server"]')
      expect(addFromServerSection.exists()).toBe(true)

      const permitListSection = wrapper.find('[aria-label="Your permit list"]')
      expect(permitListSection.exists()).toBe(true)
    })
  })

  describe('permit selection', () => {
    it('should navigate to permit detail when permit is selected from FindNearbyPermits', async () => {
      await router.push('/permits')
      await router.isReady()

      const wrapper = mount(PermitsView, {
        global: {
          plugins: [router],
          stubs: {
            AppHeader: true,
            FindNearbyPermits: true,
            PermitListView: true,
          },
        },
      })

      const pushSpy = vi.spyOn(router, 'push')

      const findNearbyPermits = wrapper.findComponent({ name: 'FindNearbyPermits' })
      const mockPermit = { id: '123', permitNumber: 'P-123' }

      await findNearbyPermits.vm.$emit('select-permit', mockPermit)

      expect(pushSpy).toHaveBeenCalledWith({
        name: 'permit-detail',
        params: { id: '123' },
      })
    })

    it('should navigate to permit detail when permit is selected from PermitListView', async () => {
      await router.push('/permits')
      await router.isReady()

      const wrapper = mount(PermitsView, {
        global: {
          plugins: [router],
          stubs: {
            AppHeader: true,
            FindNearbyPermits: true,
            PermitListView: true,
          },
        },
      })

      const pushSpy = vi.spyOn(router, 'push')

      const permitListView = wrapper.findComponent({ name: 'PermitListView' })
      const mockPermit = { id: '456', permitNumber: 'P-456' }

      await permitListView.vm.$emit('select-permit', mockPermit)

      expect(pushSpy).toHaveBeenCalledWith({
        name: 'permit-detail',
        params: { id: '456' },
      })
    })
  })

  describe('permit list refresh', () => {
    it('should refresh permit list when permits are added', async () => {
      mockRefresh.mockClear()

      const wrapper = mount(PermitsView, {
        global: {
          plugins: [router],
          stubs: {
            AppHeader: true,
            FindNearbyPermits: true,
            PermitListView: true,
          },
        },
      })

      const findNearbyPermits = wrapper.findComponent({ name: 'FindNearbyPermits' })
      await findNearbyPermits.vm.$emit('permits-added')
      await wrapper.vm.$nextTick()

      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  describe('responsive layout', () => {
    it('should have responsive padding classes', () => {
      const wrapper = mount(PermitsView, {
        global: {
          plugins: [router],
          stubs: {
            AppHeader: true,
            FindNearbyPermits: true,
            PermitListView: true,
          },
        },
      })

      const main = wrapper.find('main')
      expect(main.classes()).toContain('px-4')
      expect(main.classes()).toContain('tablet:px-6')
    })

    it('should have max-width container for content', () => {
      const wrapper = mount(PermitsView, {
        global: {
          plugins: [router],
          stubs: {
            AppHeader: true,
            FindNearbyPermits: true,
            PermitListView: true,
          },
        },
      })

      const container = wrapper.find('.max-w-4xl')
      expect(container.exists()).toBe(true)
    })
  })
})
