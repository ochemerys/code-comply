/**
 * Browser hooks for Playwright E2E (Docker production builds).
 * Mounted on `window.__inspectorE2eBridge` when VITE_ENABLE_E2E_ROUTES=true.
 */
import { backgroundSyncManager, createBackgroundSyncManager } from '@/lib/db/background-sync'
import { isEncryptionServiceInitialized } from '@/lib/db/encryption'
import { getDb, openInspectorDBAtRest } from '@/lib/db/dexie'

export type BackgroundSyncStatusSnapshot = {
  isSupported: boolean
  isRegistered: boolean
  registeredTags: string[]
  isFallbackActive: boolean
}

async function initBackgroundSyncAndGetStatus(): Promise<BackgroundSyncStatusSnapshot> {
  await backgroundSyncManager.destroy()
  await backgroundSyncManager.init()
  const status = await backgroundSyncManager.getStatus()
  return {
    isSupported: status.isSupported,
    isRegistered: status.isRegistered,
    registeredTags: [...status.registeredTags],
    isFallbackActive: status.isFallbackActive,
  }
}

async function initBackgroundSyncWithoutApiSupport(): Promise<{
  isRegistered: boolean
  isFallbackActive: boolean
  registeredTags: string[]
}> {
  const win = window as Window & { SyncManager?: unknown }
  const originalSyncManager = win.SyncManager
  delete win.SyncManager

  try {
    const manager = createBackgroundSyncManager({
      autoRegister: true,
      fallbackInterval: 5_000,
    })
    await manager.init()
    const status = await manager.getStatus()
    await manager.destroy()
    return {
      isRegistered: status.isRegistered,
      isFallbackActive: status.isFallbackActive,
      registeredTags: [...status.registeredTags],
    }
  } finally {
    if (originalSyncManager !== undefined) {
      win.SyncManager = originalSyncManager
    }
  }
}

async function destroyBackgroundSyncManager(): Promise<void> {
  await backgroundSyncManager.destroy()
}

async function waitForEncryptionInitialized(): Promise<boolean> {
  return isEncryptionServiceInitialized()
}

async function storeInspectionLocally(args: {
  inspectionId: string
  notes: string
  status?: string
}): Promise<void> {
  const now = new Date().toISOString()
  await getDb().inspections.put({
    id: args.inspectionId,
    clientId: crypto.randomUUID(),
    permitId: 'e2e-permit-enc',
    status: (args.status ?? 'IN_PROGRESS') as 'IN_PROGRESS',
    scheduledDate: now,
    assignedToId: 'e2e-inspector',
    notes: args.notes,
    createdAt: now,
    updatedAt: now,
    isDirty: true,
  })
}

async function storeDeficiencyLocally(args: {
  deficiencyId: string
  description: string
}): Promise<void> {
  const now = new Date().toISOString()
  await getDb().deficiencies.put({
    id: args.deficiencyId,
    clientId: crypto.randomUUID(),
    inspectionId: 'e2e-enc-insp-def',
    createdById: 'e2e-inspector',
    description: args.description,
    severity: 'MAJOR',
    status: 'OPEN',
    isStopWork: false,
    isUnsafe: false,
    createdAt: now,
    updatedAt: now,
    isDirty: true,
  })
}

async function readRawFieldAtRest(args: {
  table: 'inspections' | 'deficiencies'
  id: string
  field: string
}): Promise<string | null> {
  const db = openInspectorDBAtRest()
  try {
    const table = db[args.table] as {
      get: (id: string) => Promise<Record<string, unknown> | undefined>
    }
    const row = await table.get(args.id)
    const value = row?.[args.field]
    return typeof value === 'string' ? value : value == null ? null : String(value)
  } finally {
    db.close()
  }
}

async function readDecryptedFieldThroughApp(args: {
  table: 'inspections' | 'deficiencies'
  id: string
  field: string
}): Promise<string | null> {
  const table = getDb()[args.table] as {
    get: (id: string) => Promise<Record<string, unknown> | undefined>
  }
  const row = await table.get(args.id)
  const value = row?.[args.field]
  return typeof value === 'string' ? value : value == null ? null : String(value)
}

export const inspectorE2eBridge = {
  initBackgroundSyncAndGetStatus,
  initBackgroundSyncWithoutApiSupport,
  destroyBackgroundSyncManager,
  waitForEncryptionInitialized,
  storeInspectionLocally,
  storeDeficiencyLocally,
  readRawFieldAtRest,
  readDecryptedFieldThroughApp,
} as const

export type InspectorE2eBridge = typeof inspectorE2eBridge

declare global {
  interface Window {
    __inspectorE2eBridge?: InspectorE2eBridge
  }
}

export function mountInspectorE2eBridge(): void {
  window.__inspectorE2eBridge = inspectorE2eBridge
}
