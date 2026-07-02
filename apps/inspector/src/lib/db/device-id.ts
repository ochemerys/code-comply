/**
 * Stable per-installation device identifier for key derivation and device APIs.
 */

const DEVICE_ID_STORAGE_KEY = 'inspector_device_id'

function generateDeviceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `device-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Returns a stable device id persisted in localStorage (survives logout).
 */
export function getOrCreateDeviceId(): string {
  if (typeof localStorage === 'undefined') {
    return generateDeviceId()
  }
  const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY)
  if (existing) return existing
  const id = generateDeviceId()
  localStorage.setItem(DEVICE_ID_STORAGE_KEY, id)
  return id
}
