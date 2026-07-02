import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { registerServiceWorker } from './lib/service-worker'

// Mock the service worker API
const mockServiceWorker = {
  register: vi.fn(),
}
const legacyPwaDevFlagName = ['VITE', 'ENABLE', 'SW', 'DEV'].join('_')

describe('ServiceWorker Registration', () => {
  let originalNavigator: any
  let originalAddEventListener: any

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VITE_ENABLE_PWA_DEV', undefined)
    vi.stubEnv(legacyPwaDevFlagName, '')

    // Reset mocks
    mockServiceWorker.register.mockReset()

    // Store originals
    originalNavigator = global.navigator
    originalAddEventListener = global.addEventListener

    // Mock navigator
    Object.defineProperty(global, 'navigator', {
      value: {
        serviceWorker: mockServiceWorker,
      },
      writable: true,
    })

    // Mock addEventListener
    const mockAddEventListener = vi.fn()
    Object.defineProperty(global, 'addEventListener', {
      value: mockAddEventListener,
      writable: true,
    })
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
    })

    // Make it available for the test
    ;(global as any).mockAddEventListener = mockAddEventListener
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    // Restore originals
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
    })
    Object.defineProperty(global, 'addEventListener', {
      value: originalAddEventListener,
      writable: true,
    })
  })

  it('should register service worker successfully when sw.js exists', async () => {
    vi.stubEnv('VITE_ENABLE_PWA_DEV', 'true')

    // Mock successful registration
    mockServiceWorker.register.mockResolvedValue({
      scope: 'http://localhost:3000/',
    })

    // Call the registration function
    registerServiceWorker()

    // Trigger the load event
    const mockAddEventListener = (global as any).mockAddEventListener
    const loadHandler = mockAddEventListener.mock.calls.find((call: any) => call[0] === 'load')?.[1]
    if (loadHandler) {
      await loadHandler()
    }

    expect(mockServiceWorker.register).toHaveBeenCalledWith('/sw.js')
  })

  it('should warn when service worker registration is rejected by origin security', async () => {
    vi.stubEnv('VITE_ENABLE_PWA_DEV', 'true')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Mock registration failure
    const error = new Error(
      'ServiceWorker registration failed: DOMException: The operation is insecure',
    )
    mockServiceWorker.register.mockRejectedValue(error)

    // Call the registration function
    registerServiceWorker()

    // Trigger the load event
    const mockAddEventListener = (global as any).mockAddEventListener
    const loadHandler = mockAddEventListener.mock.calls.find((call: any) => call[0] === 'load')?.[1]
    if (loadHandler) {
      await loadHandler()
    }

    expect(mockServiceWorker.register).toHaveBeenCalledWith('/sw.js')
    expect(warnSpy).toHaveBeenCalledWith(
      '[PWA] Service worker registration skipped: browser rejected this origin.',
    )
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('should skip service worker registration in dev when PWA dev is not enabled', async () => {
    await registerServiceWorker()

    const mockAddEventListener = (global as any).mockAddEventListener
    expect(mockAddEventListener).not.toHaveBeenCalledWith('load', expect.any(Function))
    expect(mockServiceWorker.register).not.toHaveBeenCalled()
  })

  it('should register service worker in production regardless of the PWA dev flag', async () => {
    vi.stubEnv('PROD', true)
    mockServiceWorker.register.mockResolvedValue({
      scope: 'https://inspector.example.com/',
    })

    await registerServiceWorker()

    const mockAddEventListener = (global as any).mockAddEventListener
    const loadHandler = mockAddEventListener.mock.calls.find((call: any) => call[0] === 'load')?.[1]
    if (loadHandler) {
      await loadHandler()
    }

    expect(mockServiceWorker.register).toHaveBeenCalledWith('/sw.js')
  })

  it('should warn when the legacy dev service worker flag is set', async () => {
    vi.stubEnv(legacyPwaDevFlagName, 'true')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await registerServiceWorker()

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Use VITE_ENABLE_PWA_DEV=true'))
    expect(mockServiceWorker.register).not.toHaveBeenCalled()
  })

  it('should not register service worker when not supported', () => {
    vi.stubEnv('VITE_ENABLE_PWA_DEV', 'true')

    // Mock navigator without service worker support
    Object.defineProperty(global, 'navigator', {
      value: {},
      writable: true,
    })

    // Call the registration function
    registerServiceWorker()

    const mockAddEventListener = (global as any).mockAddEventListener
    expect(mockAddEventListener).not.toHaveBeenCalled()
  })

  it('should not register service worker outside a secure context', async () => {
    vi.stubEnv('VITE_ENABLE_PWA_DEV', 'true')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    Object.defineProperty(window, 'isSecureContext', {
      value: false,
      configurable: true,
    })

    await registerServiceWorker()

    const mockAddEventListener = (global as any).mockAddEventListener
    expect(mockAddEventListener).not.toHaveBeenCalled()
    expect(mockServiceWorker.register).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      '[PWA] Service worker registration skipped: page is not in a secure context.',
    )
  })
})
