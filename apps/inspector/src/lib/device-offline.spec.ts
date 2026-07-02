import { describe, it, expect, afterEach } from 'vitest'
import { isDeviceOffline, isNetworkFailure } from './device-offline'

describe('isDeviceOffline', () => {
  const originalOnLine = navigator.onLine

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true })
  })

  it('returns true when network store reports offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    expect(isDeviceOffline(false)).toBe(true)
  })

  it('returns true when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    expect(isDeviceOffline(true)).toBe(true)
  })

  it('returns false when both store and navigator report online', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    expect(isDeviceOffline(true)).toBe(false)
  })
})

describe('isNetworkFailure', () => {
  it('detects failed to fetch errors', () => {
    expect(isNetworkFailure(new TypeError('Failed to fetch'))).toBe(true)
  })

  it('ignores HTTP API errors', () => {
    expect(isNetworkFailure(new Error('Request failed (500)'))).toBe(false)
  })
})
