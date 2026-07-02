import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import SyncStatusBanner from './SyncStatusBanner.vue'
import { useSyncStatus } from '@/composables/useSyncStatus'

vi.mock('@/composables/useSyncStatus')

describe('SyncStatusBanner', () => {
  const triggerSync = vi.fn()
  const retryFailed = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSyncStatus).mockReturnValue({
      status: computed(() => 'online'),
      isOnline: ref(true),
      isSyncing: ref(false),
      pendingCount: ref(0),
      failedCount: ref(0),
      conflictCount: ref(0),
      lastSyncedAt: ref(null),
      lastError: ref(null),
      triggerSync,
      retryFailed,
      clearFailed: vi.fn(),
    })
  })

  it('does not render when online with no queued work', () => {
    const wrapper = mount(SyncStatusBanner)

    expect(wrapper.find('[data-testid="sync-status-banner"]').exists()).toBe(false)
  })

  it('does not render for online with pending work only (header toolbar handles it)', () => {
    const wrapper = mount(SyncStatusBanner, {
      props: {
        statusOverride: 'online',
        pendingCountOverride: 2,
        fixed: false,
      },
    })

    expect(wrapper.find('[data-testid="sync-status-banner"]').exists()).toBe(false)
  })

  it('renders the banner for offline status', () => {
    const wrapper = mount(SyncStatusBanner, {
      props: {
        statusOverride: 'offline',
        fixed: false,
      },
    })

    expect(wrapper.find('[data-testid="sync-status-banner"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('You are offline')
    expect(wrapper.text()).toContain('Changes are saved locally')
  })

  it('renders while syncing', () => {
    const wrapper = mount(SyncStatusBanner, {
      props: {
        statusOverride: 'syncing',
        syncingOverride: true,
        fixed: false,
      },
    })

    expect(wrapper.find('[data-testid="sync-status-banner"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Syncing changes')
  })

  it('offers retry when the queue is stuck', async () => {
    const wrapper = mount(SyncStatusBanner, {
      props: {
        statusOverride: 'online',
        failedCountOverride: 2,
        fixed: false,
      },
    })

    const button = wrapper.find('button')
    expect(wrapper.text()).toContain('Sync needs attention')
    expect(button.text()).toBe('Retry')

    await button.trigger('click')
    expect(retryFailed).toHaveBeenCalledTimes(1)
  })
})
