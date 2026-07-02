/**
 * Unit tests for SyncStatus component
 *
 * @see M3-S5 - Create Sync Status Indicator Components
 * @see Testing Strategy §4.4 - Frontend Component Testing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, computed } from 'vue'
import SyncStatus from './SyncStatus.vue'
import SyncStatusBadge from './SyncStatusBadge.vue'
import SyncProgressBar from './SyncProgressBar.vue'
import { useSyncStatus } from '@/composables/useSyncStatus'

// Mock the composable
vi.mock('@/composables/useSyncStatus')

describe('SyncStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock implementation
    vi.mocked(useSyncStatus).mockReturnValue({
      status: computed(() => 'online'),
      isOnline: ref(true),
      isSyncing: ref(false),
      pendingCount: ref(0),
      failedCount: ref(0),
      lastSyncedAt: ref(null),
      lastError: ref(null),
      triggerSync: vi.fn(),
      retryFailed: vi.fn(),
      clearFailed: vi.fn(),
    } as any)
  })

  describe('compact variant', () => {
    it('should render only badge in compact mode', () => {
      const wrapper = mount(SyncStatus, {
        props: {
          variant: 'compact',
        },
      })

      expect(wrapper.findComponent(SyncStatusBadge).exists()).toBe(true)
      expect(wrapper.find('button').exists()).toBe(false)
    })

    it('should pass correct props to badge', () => {
      const wrapper = mount(SyncStatus, {
        props: {
          variant: 'compact',
        },
      })

      const badge = wrapper.findComponent(SyncStatusBadge)
      expect(badge.props('status')).toBe('online')
      expect(badge.props('pendingCount')).toBe(0)
      expect(badge.props('showCount')).toBe(true)
      expect(badge.props('size')).toBe('sm')
    })
  })

  describe('detailed variant', () => {
    it('should render badge, progress bar, and sync button', () => {
      const wrapper = mount(SyncStatus, {
        props: {
          variant: 'detailed',
        },
      })

      expect(wrapper.findComponent(SyncStatusBadge).exists()).toBe(true)
      expect(wrapper.findComponent(SyncProgressBar).exists()).toBe(true)
      expect(wrapper.find('button').exists()).toBe(true)
    })

    it('should show pending count', () => {
      vi.mocked(useSyncStatus).mockReturnValue({
        status: computed(() => 'online'),
        isOnline: ref(true),
        isSyncing: ref(false),
        pendingCount: ref(5),
        failedCount: ref(0),
        lastSyncedAt: ref(null),
        lastError: ref(null),
        triggerSync: vi.fn(),
        retryFailed: vi.fn(),
        clearFailed: vi.fn(),
      } as any)

      const wrapper = mount(SyncStatus, {
        props: {
          variant: 'detailed',
        },
      })

      expect(wrapper.text()).toContain('5 pending')
    })

    it('should show last sync time', () => {
      const lastSync = new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
      vi.mocked(useSyncStatus).mockReturnValue({
        status: { value: 'online' },
        isOnline: { value: true },
        isSyncing: { value: false },
        pendingCount: { value: 0 },
        failedCount: { value: 0 },
        lastSyncedAt: { value: lastSync },
        lastError: { value: null },
        triggerSync: vi.fn(),
        retryFailed: vi.fn(),
        clearFailed: vi.fn(),
      } as any)

      const wrapper = mount(SyncStatus, {
        props: {
          variant: 'detailed',
          showLastSync: true,
        },
      })

      expect(wrapper.text()).toContain('5m ago')
    })

    it('should show error message when present', () => {
      vi.mocked(useSyncStatus).mockReturnValue({
        status: { value: 'error' },
        isOnline: { value: true },
        isSyncing: { value: false },
        pendingCount: { value: 0 },
        failedCount: { value: 0 },
        lastSyncedAt: { value: null },
        lastError: { value: 'Network error' },
        triggerSync: vi.fn(),
        retryFailed: vi.fn(),
        clearFailed: vi.fn(),
      } as any)

      const wrapper = mount(SyncStatus, {
        props: {
          variant: 'detailed',
        },
      })

      expect(wrapper.text()).toContain('Network error')
      expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    })

    it('should not show sync button when showSyncButton is false', () => {
      const wrapper = mount(SyncStatus, {
        props: {
          variant: 'detailed',
          showSyncButton: false,
        },
      })

      expect(wrapper.find('button').exists()).toBe(false)
    })
  })

  describe('full variant', () => {
    it('should render all elements', () => {
      const wrapper = mount(SyncStatus, {
        props: {
          variant: 'full',
        },
      })

      expect(wrapper.findComponent(SyncStatusBadge).exists()).toBe(true)
      expect(wrapper.findComponent(SyncProgressBar).exists()).toBe(true)
      expect(wrapper.find('h3').text()).toBe('Sync Status')
      expect(wrapper.find('.grid').exists()).toBe(true) // Stats grid
    })

    it('should show stats grid with pending and failed counts', () => {
      vi.mocked(useSyncStatus).mockReturnValue({
        status: { value: 'online' },
        isOnline: { value: true },
        isSyncing: { value: false },
        pendingCount: { value: 5 },
        failedCount: { value: 2 },
        lastSyncedAt: { value: null },
        lastError: { value: null },
        triggerSync: vi.fn(),
        retryFailed: vi.fn(),
        clearFailed: vi.fn(),
      } as any)

      const wrapper = mount(SyncStatus, {
        props: {
          variant: 'full',
        },
      })

      const statsGrid = wrapper.find('.grid')
      expect(statsGrid.text()).toContain('5')
      expect(statsGrid.text()).toContain('2')
    })

    it('should show failed items management when failed count > 0', () => {
      vi.mocked(useSyncStatus).mockReturnValue({
        status: computed(() => 'online'),
        isOnline: ref(true),
        isSyncing: ref(false),
        pendingCount: ref(0),
        failedCount: ref(3),
        lastSyncedAt: ref(null),
        lastError: ref(null),
        triggerSync: vi.fn(),
        retryFailed: vi.fn(),
        clearFailed: vi.fn(),
      } as any)

      const wrapper = mount(SyncStatus, {
        props: {
          variant: 'full',
          showFailed: true,
        },
      })

      expect(wrapper.text()).toContain('Failed Items (3)')
      expect(wrapper.text()).toContain('Retry All')
      expect(wrapper.text()).toContain('Clear Failed')
    })

    it('should not show failed items management when failed count is 0', () => {
      const wrapper = mount(SyncStatus, {
        props: {
          variant: 'full',
          showFailed: true,
        },
      })

      expect(wrapper.text()).not.toContain('Failed Items')
      expect(wrapper.text()).not.toContain('Retry All')
    })

    it('should not show failed items management when showFailed is false', () => {
      vi.mocked(useSyncStatus).mockReturnValue({
        status: { value: 'online' },
        isOnline: { value: true },
        isSyncing: { value: false },
        pendingCount: { value: 0 },
        failedCount: { value: 3 },
        lastSyncedAt: { value: null },
        lastError: { value: null },
        triggerSync: vi.fn(),
        retryFailed: vi.fn(),
        clearFailed: vi.fn(),
      } as any)

      const wrapper = mount(SyncStatus, {
        props: {
          variant: 'full',
          showFailed: false,
        },
      })

      expect(wrapper.text()).not.toContain('Failed Items')
    })
  })

  describe('sync button', () => {
    it('should call triggerSync when clicked', async () => {
      const triggerSync = vi.fn()
      vi.mocked(useSyncStatus).mockReturnValue({
        status: { value: 'online' },
        isOnline: { value: true },
        isSyncing: { value: false },
        pendingCount: { value: 0 },
        failedCount: { value: 0 },
        lastSyncedAt: { value: null },
        lastError: { value: null },
        triggerSync,
        retryFailed: vi.fn(),
        clearFailed: vi.fn(),
      } as any)

      const wrapper = mount(SyncStatus, {
        props: {
          variant: 'detailed',
        },
      })

      await wrapper.find('button').trigger('click')
      expect(triggerSync).toHaveBeenCalled()
    })

    it('should be disabled when offline', () => {
      vi.mocked(useSyncStatus).mockReturnValue({
        status: { value: 'offline' },
        isOnline: { value: false },
        isSyncing: { value: false },
        pendingCount: { value: 0 },
        failedCount: { value: 0 },
        lastSyncedAt: { value: null },
        lastError: { value: null },
        triggerSync: vi.fn(),
        retryFailed: vi.fn(),
        clearFailed: vi.fn(),
      } as any)

      const wrapper = mount(SyncStatus, {
        props: {
          variant: 'detailed',
        },
      })

      const button = wrapper.find('button')
      expect(button.attributes('disabled')).toBeDefined()
    })

    it('should be disabled when syncing', () => {
      vi.mocked(useSyncStatus).mockReturnValue({
        status: { value: 'syncing' },
        isOnline: { value: true },
        isSyncing: { value: true },
        pendingCount: { value: 5 },
        failedCount: { value: 0 },
        lastSyncedAt: { value: null },
        lastError: { value: null },
        triggerSync: vi.fn(),
        retryFailed: vi.fn(),
        clearFailed: vi.fn(),
      } as any)

      const wrapper = mount(SyncStatus, {
        props: {
          variant: 'detailed',
        },
      })

      const button = wrapper.find('button')
      expect(button.attributes('disabled')).toBeDefined()
    })

    it('should show "Syncing..." text when syncing', () => {
      vi.mocked(useSyncStatus).mockReturnValue({
        status: { value: 'syncing' },
        isOnline: { value: true },
        isSyncing: { value: true },
        pendingCount: { value: 5 },
        failedCount: { value: 0 },
        lastSyncedAt: { value: null },
        lastError: { value: null },
        triggerSync: vi.fn(),
        retryFailed: vi.fn(),
        clearFailed: vi.fn(),
      } as any)

      const wrapper = mount(SyncStatus, {
        props: {
          variant: 'detailed',
        },
      })

      expect(wrapper.find('button').text()).toContain('Syncing...')
    })

    it('should show "Offline" text when offline', () => {
      vi.mocked(useSyncStatus).mockReturnValue({
        status: { value: 'offline' },
        isOnline: { value: false },
        isSyncing: { value: false },
        pendingCount: { value: 0 },
        failedCount: { value: 0 },
        lastSyncedAt: { value: null },
        lastError: { value: null },
        triggerSync: vi.fn(),
        retryFailed: vi.fn(),
        clearFailed: vi.fn(),
      } as any)

      const wrapper = mount(SyncStatus, {
        props: {
          variant: 'detailed',
        },
      })

      expect(wrapper.find('button').text()).toContain('Offline')
    })

    it('should show spinning icon when syncing', () => {
      vi.mocked(useSyncStatus).mockReturnValue({
        status: { value: 'syncing' },
        isOnline: { value: true },
        isSyncing: { value: true },
        pendingCount: { value: 5 },
        failedCount: { value: 0 },
        lastSyncedAt: { value: null },
        lastError: { value: null },
        triggerSync: vi.fn(),
        retryFailed: vi.fn(),
        clearFailed: vi.fn(),
      } as any)

      const wrapper = mount(SyncStatus, {
        props: {
          variant: 'detailed',
        },
      })

      const icon = wrapper.find('button svg')
      expect(icon.classes()).toContain('animate-spin')
    })
  })

  describe('failed items management', () => {
    it('should call retryFailed when Retry All clicked', async () => {
      const retryFailed = vi.fn()
      vi.mocked(useSyncStatus).mockReturnValue({
        status: { value: 'online' },
        isOnline: { value: true },
        isSyncing: { value: false },
        pendingCount: { value: 0 },
        failedCount: { value: 3 },
        lastSyncedAt: { value: null },
        lastError: { value: null },
        triggerSync: vi.fn(),
        retryFailed,
        clearFailed: vi.fn(),
      } as any)

      const wrapper = mount(SyncStatus, {
        props: {
          variant: 'full',
          showFailed: true,
        },
      })

      const buttons = wrapper.findAll('button')
      const retryButton = buttons.find((btn) => btn.text().includes('Retry All'))
      await retryButton?.trigger('click')

      expect(retryFailed).toHaveBeenCalled()
    })

    it('should call clearFailed when Clear Failed clicked', async () => {
      const clearFailed = vi.fn()
      vi.mocked(useSyncStatus).mockReturnValue({
        status: { value: 'online' },
        isOnline: { value: true },
        isSyncing: { value: false },
        pendingCount: { value: 0 },
        failedCount: { value: 3 },
        lastSyncedAt: { value: null },
        lastError: { value: null },
        triggerSync: vi.fn(),
        retryFailed: vi.fn(),
        clearFailed,
      } as any)

      const wrapper = mount(SyncStatus, {
        props: {
          variant: 'full',
          showFailed: true,
        },
      })

      const buttons = wrapper.findAll('button')
      const clearButton = buttons.find((btn) => btn.text().includes('Clear Failed'))
      await clearButton?.trigger('click')

      expect(clearFailed).toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('should have proper button labels', () => {
      const wrapper = mount(SyncStatus, {
        props: {
          variant: 'detailed',
        },
      })

      const button = wrapper.find('button')
      expect(button.attributes('aria-label')).toBe('Sync Now')
    })

    it('should have role="alert" on error message', () => {
      vi.mocked(useSyncStatus).mockReturnValue({
        status: { value: 'error' },
        isOnline: { value: true },
        isSyncing: { value: false },
        pendingCount: { value: 0 },
        failedCount: { value: 0 },
        lastSyncedAt: { value: null },
        lastError: { value: 'Network error' },
        triggerSync: vi.fn(),
        retryFailed: vi.fn(),
        clearFailed: vi.fn(),
      } as any)

      const wrapper = mount(SyncStatus, {
        props: {
          variant: 'detailed',
        },
      })

      const alert = wrapper.find('[role="alert"]')
      expect(alert.exists()).toBe(true)
    })
  })

  describe('styling', () => {
    it('should have touch-friendly button height in full variant', () => {
      const wrapper = mount(SyncStatus, {
        props: {
          variant: 'full',
        },
      })

      const buttons = wrapper.findAll('button')
      const syncButton = buttons[buttons.length - 1] // Last button is sync button
      expect(syncButton.classes()).toContain('h-touch')
    })

    it('should have minimum touch target height in detailed variant', () => {
      const wrapper = mount(SyncStatus, {
        props: {
          variant: 'detailed',
        },
      })

      const button = wrapper.find('button')
      expect(button.classes()).toContain('h-11')
    })

    it('should have active scale feedback', () => {
      const wrapper = mount(SyncStatus, {
        props: {
          variant: 'detailed',
        },
      })

      const button = wrapper.find('button')
      expect(button.classes()).toContain('active:scale-95')
    })

    it('should have transition classes', () => {
      const wrapper = mount(SyncStatus, {
        props: {
          variant: 'detailed',
        },
      })

      const button = wrapper.find('button')
      expect(button.classes()).toContain('transition-all')
      expect(button.classes()).toContain('duration-200')
      expect(button.classes()).toContain('ease-out')
    })
  })
})
