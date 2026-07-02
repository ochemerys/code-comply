/**
 * Offline detection for mutation routing — aligns Pinia network state with navigator.onLine.
 * Playwright E2E uses context.setOffline(); the store may lag until the offline event fires.
 */
export function isDeviceOffline(networkStoreOnline?: boolean): boolean {
  if (networkStoreOnline === false) return true
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  return false
}

/** True when fetch failed because the browser has no connectivity (not HTTP 4xx/5xx). */
export function isNetworkFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    error.name === 'TypeError' ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('err_internet_disconnected')
  )
}
