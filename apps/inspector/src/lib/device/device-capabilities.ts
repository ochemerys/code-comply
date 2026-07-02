/**
 * M11-S17 — Runtime capability probes for inspector PWA on iPad Safari.
 */

import {
  IPAD_MIN_TOUCH_TARGET_PX,
  IPAD_PERFORMANCE_LOAD_MS,
  type IPadAcceptanceCriterion,
} from './ipad-device-config'

export interface DeviceCapabilitySnapshot {
  pwaInstall: boolean
  camera: boolean
  gps: boolean
  offlineMode: boolean
  touchEvents: boolean
  performanceAcceptable: boolean
}

export interface CapabilityProbeOptions {
  loadTimeMs?: number
  minTouchTargetPx?: number
}

function hasGeolocation(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator
}

function hasCamera(): boolean {
  return (
    typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'
  )
}

function hasTouchSupport(): boolean {
  if (typeof window === 'undefined') return false
  return 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0
}

function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function hasServiceWorker(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator
}

function hasManifestLink(): boolean {
  if (typeof document === 'undefined') return false
  return document.querySelector('link[rel="manifest"]') !== null
}

function hasAppleWebAppMeta(): boolean {
  if (typeof document === 'undefined') return false
  const meta = document.querySelector('meta[name="apple-mobile-web-app-capable"]')
  return meta?.getAttribute('content') === 'yes'
}

/** PWA install readiness: manifest + Apple meta or already standalone. */
export function isPwaInstallReady(): boolean {
  return isStandalonePwa() || (hasManifestLink() && hasAppleWebAppMeta())
}

export function probeDeviceCapabilities(
  options: CapabilityProbeOptions = {},
): DeviceCapabilitySnapshot {
  const loadTimeMs = options.loadTimeMs ?? 0
  const minTouch = options.minTouchTargetPx ?? IPAD_MIN_TOUCH_TARGET_PX

  return {
    pwaInstall: isPwaInstallReady(),
    camera: hasCamera(),
    gps: hasGeolocation(),
    offlineMode: hasServiceWorker(),
    touchEvents: hasTouchSupport() && minTouch >= IPAD_MIN_TOUCH_TARGET_PX,
    performanceAcceptable: loadTimeMs <= IPAD_PERFORMANCE_LOAD_MS,
  }
}

export function snapshotToAcceptanceCriteria(
  snapshot: DeviceCapabilitySnapshot,
): IPadAcceptanceCriterion[] {
  const covered: IPadAcceptanceCriterion[] = []
  if (snapshot.pwaInstall) covered.push('pwa-install')
  if (snapshot.camera) covered.push('camera')
  if (snapshot.gps) covered.push('gps')
  if (snapshot.offlineMode) covered.push('offline-mode')
  if (snapshot.touchEvents) covered.push('touch-interactions')
  if (snapshot.performanceAcceptable) covered.push('performance')
  return covered
}

export function meetsIPadAcceptanceCriteria(
  snapshot: DeviceCapabilitySnapshot,
  options: CapabilityProbeOptions = {},
): boolean {
  const probe = options.loadTimeMs !== undefined ? probeDeviceCapabilities(options) : snapshot
  return (
    probe.pwaInstall &&
    probe.camera &&
    probe.gps &&
    probe.offlineMode &&
    probe.touchEvents &&
    probe.performanceAcceptable
  )
}
