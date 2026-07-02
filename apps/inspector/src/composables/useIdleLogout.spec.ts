import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import IdleLogoutDialog from '../components/IdleLogoutDialog.vue'
import { useIdleLogout } from './useIdleLogout'

const logout = vi.fn().mockResolvedValue(undefined)

vi.mock('./useAuth', () => ({
  useAuth: () => ({ logout }),
}))

vi.mock('../lib/idle-logout-config', () => ({
  getIdleLogoutConfig: () => ({
    warnAfterMs: 100,
    logoutAfterMs: 200,
  }),
}))

const TestHost = defineComponent({
  components: { IdleLogoutDialog },
  setup() {
    const enabled = ref(true)
    const idle = useIdleLogout({ enabled })
    return { enabled, ...idle }
  },
  template: `
    <div>
      <IdleLogoutDialog
        v-model="showWarnDialog"
        @stay-signed-in="staySignedIn"
      />
    </div>
  `,
})

describe('useIdleLogout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      writable: true,
      value: false,
    })
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      writable: true,
      value: false,
    })
    document.body.innerHTML = ''
  })

  async function mountHost() {
    const wrapper = mount(TestHost, {
      attachTo: document.body,
      global: { stubs: { teleport: true } },
    })
    await nextTick()
    return wrapper
  }

  it('shows warn dialog after warn threshold', async () => {
    const wrapper = await mountHost()
    await vi.advanceTimersByTimeAsync(100)
    await nextTick()
    expect(wrapper.find('[data-testid="idle-logout-dialog"]').exists()).toBe(true)
  })

  it('calls logout after logout threshold', async () => {
    await mountHost()
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()
    expect(logout).toHaveBeenCalledWith({ reason: 'idle' })
  })

  it('resets warn timer on pointer activity before warn threshold', async () => {
    const wrapper = await mountHost()
    await vi.advanceTimersByTimeAsync(50)
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
    await vi.advanceTimersByTimeAsync(60)
    await nextTick()
    expect(wrapper.find('[data-testid="idle-logout-dialog"]').exists()).toBe(false)
  })

  it('resets warn timer on keyboard activity before warn threshold', async () => {
    const wrapper = await mountHost()
    await vi.advanceTimersByTimeAsync(50)
    window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }))
    await vi.advanceTimersByTimeAsync(60)
    await nextTick()
    expect(wrapper.find('[data-testid="idle-logout-dialog"]').exists()).toBe(false)
  })

  it('does not logout while the tab is hidden', async () => {
    await mountHost()
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()
    expect(logout).not.toHaveBeenCalled()
  })

  it('stay signed in dismisses dialog and resets timers', async () => {
    const wrapper = await mountHost()
    await vi.advanceTimersByTimeAsync(100)
    await nextTick()
    expect(wrapper.find('[data-testid="idle-logout-dialog"]').exists()).toBe(true)
    await wrapper.find('[data-testid="idle-logout-stay"]').trigger('click')
    await nextTick()
    expect(wrapper.find('[data-testid="idle-logout-dialog"]').exists()).toBe(false)
    logout.mockClear()
    await vi.advanceTimersByTimeAsync(100)
    await nextTick()
    expect(wrapper.find('[data-testid="idle-logout-dialog"]').exists()).toBe(true)
    expect(logout).not.toHaveBeenCalled()
  })
})
