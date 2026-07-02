/**
 * Test Setup for Inspector App
 *
 * Configures the test environment with necessary polyfills and mocks.
 * This file is automatically loaded before running tests.
 *
 * @see vitest.config.ts - setupFiles configuration
 */

import { vi } from 'vitest'
import 'fake-indexeddb/auto'
import { initEncryptionForSession } from '@/lib/db/encryption-bootstrap'
import { encrypt } from '@/lib/db/encryption'
import { getOrCreateDeviceId } from '@/lib/db/device-id'

const VITEST_REFRESH = 'vitest-refresh-token'
const VITEST_USER_ID = 'vitest-user-id'

/** Shared db singleton requires encryption before sensitive-field writes. */
initEncryptionForSession(VITEST_REFRESH, VITEST_USER_ID)

/** Warm PBKDF2 cache once — 100k iterations are slow under coverage instrumentation. */
encrypt('warmup', VITEST_REFRESH, `${VITEST_USER_ID}:${getOrCreateDeviceId()}`)

// Note: We don't automatically delete databases between tests
// because it would close active Dexie instances.
// Each test suite should handle its own database cleanup.

// Mock navigator.onLine for network status tests
// Make it configurable so tests can redefine it
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  configurable: true,
  value: true,
})

// Mock crypto.randomUUID if not available
if (!globalThis.crypto) {
  globalThis.crypto = {} as Crypto
}

if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    }) as `${string}-${string}-${string}-${string}-${string}`
  }
}

// jsdom does not implement media playback; camera viewfinder tests call `video.play()`.
Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  configurable: true,
  writable: true,
  value: () => Promise.resolve(),
})

let blobUrlSeq = 0
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => `blob:vitest-mock-${++blobUrlSeq}`
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => {}
}

console.log('[Test Setup] IndexedDB mock initialized')
