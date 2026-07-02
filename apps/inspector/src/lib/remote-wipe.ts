/**
 * Remote wipe for lost/stolen inspector devices (M11-S4).
 *
 * Clears service worker caches, IndexedDB, localStorage, and forces logout.
 *
 * @module lib/remote-wipe
 */

import type { RemoteWipeStatus } from '@codecomply/validators'
import * as Sentry from '@sentry/vue'
import { db } from './db'
import { teardownEncryptionSession } from './db/encryption-bootstrap'
import { getApiBaseUrl } from './api-base'
import { clearLastSeenAt } from './auth/device-idle'
import { FIRST_ASSIGNED_SYNC_STORAGE_KEY } from './permit-orphan-sync'
import type { useAuthStore } from '../stores/auth'

const USER_PROFILE_STORAGE_KEY = 'inspector_user_profile'

export const REMOTE_WIPE_MESSAGE = 'Device wiped by administrator'
export const REMOTE_WIPE_SYNC_CACHE_TTL_MS = 60 * 1000

export type AuthStore = ReturnType<typeof useAuthStore>

type RemoteWipeCheckOutcome =
  | 'success'
  | 'wiped'
  | 'skipped-auth'
  | 'skipped-cached'
  | 'status-unavailable'

export interface RemoteWipeCheckOptions {
  reason?: string
  cacheTtlMs?: number
  force?: boolean
  now?: () => number
}

export interface RemoteWipeCheckResult {
  wiped: boolean
  checked: boolean
  skipped: boolean
  outcome: RemoteWipeCheckOutcome
}

let lastSuccessfulRemoteWipeCheckAt = 0
let inFlightRemoteWipeCheck: Promise<RemoteWipeCheckResult> | null = null

function readStoreValue<T>(value: T | { value: T }): T {
  if (value && typeof value === 'object' && 'value' in value) {
    return (value as { value: T }).value
  }
  return value as T
}

function addRemoteWipeBreadcrumb(
  outcome: RemoteWipeCheckOutcome,
  reason: string,
  data: Record<string, unknown> = {},
): void {
  Sentry.addBreadcrumb({
    category: 'remote-wipe',
    message: 'remote-wipe.check',
    level: outcome === 'wiped' ? 'warning' : 'info',
    data: {
      outcome,
      reason,
      ...data,
    },
  })
}

export function resetRemoteWipeCheckCache(): void {
  lastSuccessfulRemoteWipeCheckAt = 0
  inFlightRemoteWipeCheck = null
}

/**
 * Clear all Cache Storage entries and unregister service workers.
 */
export async function clearServiceWorkerCaches(): Promise<void> {
  if (typeof caches !== 'undefined') {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
  }

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))
  }
}

/**
 * Clear all IndexedDB tables used by the inspector offline layer.
 */
export async function clearIndexedDB(): Promise<void> {
  await db.clearAllData()
}

/**
 * Remove inspector auth and offline keys from localStorage.
 */
export function clearLocalStorage(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem(USER_PROFILE_STORAGE_KEY)
  localStorage.removeItem(FIRST_ASSIGNED_SYNC_STORAGE_KEY)
  clearLastSeenAt()
}

/**
 * Execute full local wipe and logout.
 */
export async function executeRemoteWipe(authStore: AuthStore): Promise<void> {
  teardownEncryptionSession()
  await clearServiceWorkerCaches()
  await clearIndexedDB()
  clearLocalStorage()
  await authStore.logout()
}

export async function fetchRemoteWipeStatus(accessToken: string): Promise<RemoteWipeStatus | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/device/remote-wipe/status`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    if (!response.ok) return null
    return (await response.json()) as RemoteWipeStatus
  } catch {
    return null
  }
}

export async function confirmRemoteWipeToServer(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/device/remote-wipe/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Check server wipe flag; clear device data and confirm when pending.
 */
export async function runRemoteWipeCheck(
  authStore: AuthStore,
  options: RemoteWipeCheckOptions = {},
): Promise<RemoteWipeCheckResult> {
  const reason = options.reason ?? 'manual'
  const now = options.now?.() ?? Date.now()
  const token = readStoreValue(authStore.accessToken)
  if (!token) {
    addRemoteWipeBreadcrumb('skipped-auth', reason)
    return { wiped: false, checked: false, skipped: true, outcome: 'skipped-auth' }
  }

  const cacheTtlMs = options.cacheTtlMs ?? 0
  if (
    !options.force &&
    cacheTtlMs > 0 &&
    lastSuccessfulRemoteWipeCheckAt > 0 &&
    now - lastSuccessfulRemoteWipeCheckAt < cacheTtlMs
  ) {
    addRemoteWipeBreadcrumb('skipped-cached', reason, {
      ageMs: now - lastSuccessfulRemoteWipeCheckAt,
    })
    return { wiped: false, checked: false, skipped: true, outcome: 'skipped-cached' }
  }

  if (inFlightRemoteWipeCheck) {
    addRemoteWipeBreadcrumb('skipped-cached', reason, { cache: 'in-flight' })
    return inFlightRemoteWipeCheck
  }

  inFlightRemoteWipeCheck = (async () => {
    const status = await fetchRemoteWipeStatus(token)
    if (!status) {
      addRemoteWipeBreadcrumb('status-unavailable', reason)
      return { wiped: false, checked: false, skipped: false, outcome: 'status-unavailable' }
    }

    lastSuccessfulRemoteWipeCheckAt = options.now?.() ?? Date.now()

    if (!status.pending) {
      addRemoteWipeBreadcrumb('success', reason, { pending: false })
      return { wiped: false, checked: true, skipped: false, outcome: 'success' }
    }

    const confirmed = await confirmRemoteWipeToServer(token)
    await executeRemoteWipe(authStore)
    addRemoteWipeBreadcrumb('wiped', reason, { confirmed })

    return { wiped: true, checked: true, skipped: false, outcome: 'wiped' }
  })()

  try {
    return await inFlightRemoteWipeCheck
  } finally {
    inFlightRemoteWipeCheck = null
  }
}

export async function checkAndHandleRemoteWipe(
  authStore: AuthStore,
  options: RemoteWipeCheckOptions = {},
): Promise<boolean> {
  const result = await runRemoteWipeCheck(authStore, options)
  return result.wiped
}
