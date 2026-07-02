import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { UserDTO } from '@codecomply/validators'
import { useRemoteWipeWatcher, REMOTE_WIPE_VISIBILITY_RECHECK_MS } from './useRemoteWipeWatcher'
import { useAuthStore } from '../stores/auth'
import { useNetworkStore } from '../stores/network'
import { runRemoteWipeCheck } from '../lib/remote-wipe'

const routerReplace = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const remoteWipeMocks = vi.hoisted(() => ({
  executeRemoteWipe: vi.fn().mockResolvedValue(undefined),
  runRemoteWipeCheck: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    replace: routerReplace,
  }),
}))

vi.mock('../lib/remote-wipe', () => remoteWipeMocks)

vi.mock('../lib/db/sync-engine', () => ({
  syncEngine: {
    pauseSync: vi.fn(),
    resumeSync: vi.fn().mockResolvedValue(undefined),
    setAuthCheck: vi.fn(),
  },
}))

vi.mock('@/lib/db/dexie', () => ({
  db: {
    syncQueue: {
      hook: vi.fn(() => ({ unsubscribe: vi.fn() })),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          count: vi.fn().mockResolvedValue(0),
        })),
      })),
    },
  },
}))

const TestHost = defineComponent({
  setup() {
    useRemoteWipeWatcher()
    return {}
  },
  template: '<div />',
})

function userProfile(): UserDTO {
  return {
    id: 'user-1',
    email: 'inspector@example.com',
    name: 'Inspector One',
    role: 'SCO',
    certifications: [],
    disciplines: [],
    designationId: 'SCO-001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function mountWatcher(expiryMs = 60 * 60 * 1000) {
  const pinia = createPinia()
  setActivePinia(pinia)

  const authStore = useAuthStore()
  authStore.accessToken = 'access-token'
  authStore.refreshToken = 'refresh-token'
  authStore.user = userProfile()
  authStore.offlineGracePeriodExpiry = new Date(Date.now() + expiryMs)

  const networkStore = useNetworkStore()
  networkStore.isOnline = true

  const wrapper = mount(TestHost, {
    global: { plugins: [pinia] },
  })

  return { authStore, networkStore, wrapper }
}

describe('useRemoteWipeWatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    vi.mocked(runRemoteWipeCheck).mockResolvedValue({
      wiped: false,
      checked: true,
      skipped: false,
      outcome: 'success',
    })
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
  })

  it('runs a fresh check on offline to online transition', async () => {
    const { authStore, networkStore, wrapper } = mountWatcher()

    networkStore.isOnline = false
    await nextTick()
    networkStore.isOnline = true
    await nextTick()
    await flushPromises()

    expect(runRemoteWipeCheck).toHaveBeenCalledWith(
      authStore,
      expect.objectContaining({ reason: 'online-transition', force: true }),
    )

    wrapper.unmount()
  })

  it('runs a fresh check when a hidden tab is visible after five minutes', async () => {
    const { authStore, wrapper } = mountWatcher()

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    })
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(REMOTE_WIPE_VISIBILITY_RECHECK_MS)

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()

    expect(runRemoteWipeCheck).toHaveBeenCalledWith(
      authStore,
      expect.objectContaining({ reason: 'visibility-regain', force: true }),
    )

    wrapper.unmount()
  })

  it('logs out when the grace period expires offline', async () => {
    const { authStore, networkStore, wrapper } = mountWatcher(1000)
    const logoutSpy = vi.spyOn(authStore, 'logout')
    networkStore.isOnline = false

    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()

    expect(logoutSpy).toHaveBeenCalled()
    expect(routerReplace).toHaveBeenCalledWith({ path: '/login', query: { reason: 'stale' } })
    expect(runRemoteWipeCheck).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('extends the grace period after an online expiry check succeeds', async () => {
    const { authStore, wrapper } = mountWatcher(1000)

    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()

    expect(runRemoteWipeCheck).toHaveBeenCalledWith(
      authStore,
      expect.objectContaining({ reason: 'offline-grace-expiry', force: true }),
    )
    expect(authStore.offlineGracePeriodExpiry!.getTime()).toBeGreaterThan(
      Date.now() + 7 * 60 * 60 * 1000,
    )

    wrapper.unmount()
  })
})
