/** Persisted timestamp of last successful app open (M-01 device unused timeout). */
export const LAST_SEEN_AT_STORAGE_KEY = 'inspector_last_seen_at'

const MS_PER_DAY = 86_400_000
const DEFAULT_MAX_OFFLINE_DAYS = 30

export function getMaxOfflineDays(): number {
  const raw = import.meta.env.VITE_MAX_OFFLINE_DAYS
  if (!raw) return DEFAULT_MAX_OFFLINE_DAYS
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_OFFLINE_DAYS
}

export function readLastSeenAt(): number | null {
  try {
    const raw = localStorage.getItem(LAST_SEEN_AT_STORAGE_KEY)
    if (!raw) return null
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function touchLastSeenAt(now = Date.now()): void {
  try {
    localStorage.setItem(LAST_SEEN_AT_STORAGE_KEY, String(now))
  } catch {
    /* ignore quota errors */
  }
}

export function clearLastSeenAt(): void {
  try {
    localStorage.removeItem(LAST_SEEN_AT_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * True when the device has not opened the app within the configured offline window.
 */
export function isDeviceIdleExceeded(now = Date.now()): boolean {
  const lastSeen = readLastSeenAt()
  if (lastSeen == null) return false
  const maxMs = getMaxOfflineDays() * MS_PER_DAY
  return now - lastSeen > maxMs
}
