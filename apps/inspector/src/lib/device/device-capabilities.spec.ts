import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isPwaInstallReady,
  meetsIPadAcceptanceCriteria,
  probeDeviceCapabilities,
  snapshotToAcceptanceCriteria,
} from './device-capabilities'

describe('device-capabilities (M11-S17)', () => {
  const originalNavigator = global.navigator
  const originalWindow = global.window

  beforeEach(() => {
    vi.stubGlobal('navigator', {
      geolocation: {},
      mediaDevices: { getUserMedia: vi.fn() },
      serviceWorker: {},
      maxTouchPoints: 5,
    })
    vi.stubGlobal('window', {
      matchMedia: vi.fn(() => ({ matches: false })),
      navigator: global.navigator,
      ontouchstart: true,
    })
    document.head.innerHTML = `
      <link rel="manifest" href="/manifest.webmanifest" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
    `
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    global.navigator = originalNavigator
    global.window = originalWindow
    document.head.innerHTML = ''
  })

  it('probeDeviceCapabilities reports all six acceptance areas when APIs exist', () => {
    const snapshot = probeDeviceCapabilities({ loadTimeMs: 1200 })
    expect(snapshot).toEqual({
      pwaInstall: true,
      camera: true,
      gps: true,
      offlineMode: true,
      touchEvents: true,
      performanceAcceptable: true,
    })
    expect(snapshotToAcceptanceCriteria(snapshot)).toHaveLength(6)
    expect(meetsIPadAcceptanceCriteria(snapshot)).toBe(true)
  })

  it('isPwaInstallReady is true when already in standalone mode', () => {
    vi.stubGlobal('window', {
      matchMedia: vi.fn(() => ({ matches: true })),
      navigator: global.navigator,
    })
    document.head.innerHTML = ''
    expect(isPwaInstallReady()).toBe(true)
  })

  it('flags slow load times as unacceptable performance', () => {
    const snapshot = probeDeviceCapabilities({ loadTimeMs: 5000 })
    expect(snapshot.performanceAcceptable).toBe(false)
    expect(meetsIPadAcceptanceCriteria(snapshot)).toBe(false)
  })

  it('reports missing camera when getUserMedia is unavailable', () => {
    vi.stubGlobal('navigator', {
      geolocation: {},
      mediaDevices: undefined,
      maxTouchPoints: 5,
    })
    const snapshot = probeDeviceCapabilities({ loadTimeMs: 1000 })
    expect(snapshot.camera).toBe(false)
  })

  it('reports missing GPS when geolocation is unavailable', () => {
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn() },
      maxTouchPoints: 5,
    })
    const snapshot = probeDeviceCapabilities({ loadTimeMs: 1000 })
    expect(snapshot.gps).toBe(false)
  })
})
