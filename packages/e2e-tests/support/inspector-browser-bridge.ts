/**
 * Functions passed to Playwright `page.evaluate` — they run in the Inspector PWA origin
 * and call `window.__inspectorE2eBridge` (mounted when VITE_ENABLE_E2E_ROUTES=true).
 *
 * Each function must be self-contained (no cross-function calls) so Playwright can serialize it.
 */

export type StoredEntityRef = {
  table: 'inspections' | 'deficiencies'
  id: string
  sensitiveField: 'notes' | 'description' | 'certificationSnapshot'
  plaintextField?: 'status'
}

export async function waitForEncryptionInitialized(): Promise<boolean> {
  const bridge = (
    window as Window & {
      __inspectorE2eBridge?: { waitForEncryptionInitialized: () => Promise<boolean> }
    }
  ).__inspectorE2eBridge
  if (!bridge) {
    throw new Error(
      'Inspector E2E bridge is not mounted. Rebuild the E2E image with VITE_ENABLE_E2E_ROUTES=true.',
    )
  }
  return bridge.waitForEncryptionInitialized()
}

export async function storeInspectionLocally(args: {
  inspectionId: string
  notes: string
  status?: string
}): Promise<void> {
  const bridge = (
    window as Window & {
      __inspectorE2eBridge?: {
        storeInspectionLocally: (a: {
          inspectionId: string
          notes: string
          status?: string
        }) => Promise<void>
      }
    }
  ).__inspectorE2eBridge
  if (!bridge) {
    throw new Error(
      'Inspector E2E bridge is not mounted. Rebuild the E2E image with VITE_ENABLE_E2E_ROUTES=true.',
    )
  }
  await bridge.storeInspectionLocally(args)
}

export async function storeDeficiencyLocally(args: {
  deficiencyId: string
  description: string
}): Promise<void> {
  const bridge = (
    window as Window & {
      __inspectorE2eBridge?: {
        storeDeficiencyLocally: (a: { deficiencyId: string; description: string }) => Promise<void>
      }
    }
  ).__inspectorE2eBridge
  if (!bridge) {
    throw new Error(
      'Inspector E2E bridge is not mounted. Rebuild the E2E image with VITE_ENABLE_E2E_ROUTES=true.',
    )
  }
  await bridge.storeDeficiencyLocally(args)
}

export async function readRawFieldAtRest(args: {
  table: StoredEntityRef['table']
  id: string
  field: string
}): Promise<string | null> {
  const bridge = (
    window as Window & {
      __inspectorE2eBridge?: {
        readRawFieldAtRest: (a: {
          table: StoredEntityRef['table']
          id: string
          field: string
        }) => Promise<string | null>
      }
    }
  ).__inspectorE2eBridge
  if (!bridge) {
    throw new Error(
      'Inspector E2E bridge is not mounted. Rebuild the E2E image with VITE_ENABLE_E2E_ROUTES=true.',
    )
  }
  return bridge.readRawFieldAtRest(args)
}

export async function readDecryptedFieldThroughApp(args: {
  table: StoredEntityRef['table']
  id: string
  field: string
}): Promise<string | null> {
  const bridge = (
    window as Window & {
      __inspectorE2eBridge?: {
        readDecryptedFieldThroughApp: (a: {
          table: StoredEntityRef['table']
          id: string
          field: string
        }) => Promise<string | null>
      }
    }
  ).__inspectorE2eBridge
  if (!bridge) {
    throw new Error(
      'Inspector E2E bridge is not mounted. Rebuild the E2E image with VITE_ENABLE_E2E_ROUTES=true.',
    )
  }
  return bridge.readDecryptedFieldThroughApp(args)
}

export async function installMockServiceWorkerForBackgroundSync(): Promise<void> {
  ;(globalThis as unknown as { __name?: (x: unknown) => unknown }).__name = (x) => x

  if (!('serviceWorker' in navigator)) {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {},
    })
  }

  const registeredTags: string[] = []
  ;(window as unknown as { __e2eBgSyncRegisteredTags?: string[] }).__e2eBgSyncRegisteredTags =
    registeredTags

  const mockRegistration = {
    scope: `${location.origin}/`,
    active: { state: 'activated' },
    sync: {
      register: async (tag: string) => {
        registeredTags.push(tag)
      },
      getTags: async () => [...registeredTags],
    },
  }

  Object.defineProperty(navigator.serviceWorker, 'ready', {
    configurable: true,
    get() {
      return Promise.resolve(mockRegistration as unknown as ServiceWorkerRegistration)
    },
  })
  ;(window as Window & { SyncManager?: unknown }).SyncManager = function SyncManager() {
    /* E2E stub for Background Sync API feature detection */
  }
}

export async function initBackgroundSyncAndGetStatus(): Promise<{
  isSupported: boolean
  isRegistered: boolean
  registeredTags: string[]
  isFallbackActive: boolean
}> {
  const bridge = (
    window as Window & {
      __inspectorE2eBridge?: {
        initBackgroundSyncAndGetStatus: () => Promise<{
          isSupported: boolean
          isRegistered: boolean
          registeredTags: string[]
          isFallbackActive: boolean
        }>
      }
    }
  ).__inspectorE2eBridge
  if (!bridge) {
    throw new Error(
      'Inspector E2E bridge is not mounted. Rebuild the E2E image with VITE_ENABLE_E2E_ROUTES=true.',
    )
  }
  return bridge.initBackgroundSyncAndGetStatus()
}

export async function initBackgroundSyncWithoutApiSupport(): Promise<{
  isRegistered: boolean
  isFallbackActive: boolean
  registeredTags: string[]
}> {
  const bridge = (
    window as Window & {
      __inspectorE2eBridge?: {
        initBackgroundSyncWithoutApiSupport: () => Promise<{
          isRegistered: boolean
          isFallbackActive: boolean
          registeredTags: string[]
        }>
      }
    }
  ).__inspectorE2eBridge
  if (!bridge) {
    throw new Error(
      'Inspector E2E bridge is not mounted. Rebuild the E2E image with VITE_ENABLE_E2E_ROUTES=true.',
    )
  }
  return bridge.initBackgroundSyncWithoutApiSupport()
}

export async function destroyBackgroundSyncManager(): Promise<void> {
  const bridge = (
    window as Window & {
      __inspectorE2eBridge?: { destroyBackgroundSyncManager: () => Promise<void> }
    }
  ).__inspectorE2eBridge
  if (!bridge) {
    throw new Error(
      'Inspector E2E bridge is not mounted. Rebuild the E2E image with VITE_ENABLE_E2E_ROUTES=true.',
    )
  }
  await bridge.destroyBackgroundSyncManager()
}
