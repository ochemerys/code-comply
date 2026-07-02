/**
 * InspectorDB - Complete IndexedDB Schema using Dexie.js
 *
 * Provides offline-first storage for the Inspector PWA with:
 * - All tables defined with proper indexes
 * - Schema versioning for safe upgrades
 * - Encryption support for sensitive fields
 * - TypeScript types for all tables
 *
 * @module lib/db/dexie
 * @see M3-S1 - Design Complete IndexedDB Schema with Dexie.js
 * @see M3-S2 - Implement Data Encryption for Sensitive Fields
 * @see M-03 (Offline Workflow) - Local storage with IndexedDB
 * @see NFR-M-03 (Security) - Encryption of data in IndexedDB
 */

import Dexie, { type Table } from 'dexie'
import { applyEncryptionMiddleware } from './encryption-middleware'
import { getEncryptionService } from './encryption'
import type {
  LocalInspection,
  LocalDeficiency,
  LocalChecklist,
  LocalChecklistResponse,
  LocalChecklistTemplateCache,
  LocalPhoto,
  LocalPermit,
  SyncQueueItem,
} from './types'

/**
 * Database name constant.
 */
export const DB_NAME = 'InspectorDB'

/**
 * Current database version.
 * Increment this when making schema changes.
 */
export const DB_VERSION = 3

const TABLE_NAMES = new Set([
  'inspections',
  'deficiencies',
  'checklists',
  'checklistResponses',
  'photos',
  'syncQueue',
  'permits',
  'checklistTemplateCache',
])

/**
 * InspectorDB extends Dexie to provide a typed IndexedDB interface
 * for the Inspector PWA's offline-first data layer.
 *
 * Tables:
 * - inspections: Assigned inspections with status tracking
 * - deficiencies: Deficiencies found during inspections
 * - checklists: Checklist executions linked to inspections
 * - checklistResponses: Individual item responses (Pass/Fail/N/A)
 * - photos: Photo evidence with binary blob storage
 * - syncQueue: Queue of mutations pending server sync
 * - permits: Cached permits for offline search (M4-S9)
 * - checklistTemplateCache: Cached templates by templateId + versionHash (M5-S15)
 *
 * @example
 * ```typescript
 * import { getDb } from '@/lib/db/dexie'
 *
 * // Add an inspection
 * await getDb().inspections.add({
 *   id: 'insp-123',
 *   clientId: crypto.randomUUID(),
 *   status: 'SCHEDULED',
 *   // ...
 * })
 *
 * // Query inspections by status
 * const scheduled = await getDb().inspections
 *   .where('status')
 *   .equals('SCHEDULED')
 *   .toArray()
 * ```
 */
export class InspectorDB extends Dexie {
  /**
   * Inspections table - stores assigned inspections with full details.
   * Indexed by: id (PK), clientId, status, assignedToId, syncedAt
   */
  inspections!: Table<LocalInspection, string>

  /**
   * Deficiencies table - stores deficiencies found during inspections.
   * Indexed by: id (PK), clientId, inspectionId, status, isDirty
   */
  deficiencies!: Table<LocalDeficiency, string>

  /**
   * Checklists table - stores checklist executions.
   * Indexed by: id (PK), inspectionId, templateId
   */
  checklists!: Table<LocalChecklist, string>

  /**
   * Checklist responses table - stores individual item responses.
   * Indexed by: id (PK), checklistId, itemId
   */
  checklistResponses!: Table<LocalChecklistResponse, string>

  /**
   * Photos table - stores photo evidence with binary blobs.
   * Indexed by: id (PK), clientId, deficiencyId, inspectionId, syncedAt
   */
  photos!: Table<LocalPhoto, string>

  /**
   * Sync queue table - stores pending mutations for server sync.
   * Indexed by: id (PK), operation, status, createdAt, attempts, priority
   */
  syncQueue!: Table<SyncQueueItem, string>

  /**
   * Permits cache table - stores permits for offline local search (M4-S9).
   * Indexed by: id (PK), permitNumber, address, status, updatedAt
   */
  permits!: Table<LocalPermit, string>

  /**
   * Cached checklist templates for offline execution (M5-S15).
   * Compound primary key [templateId+versionHash].
   */
  checklistTemplateCache!: Table<LocalChecklistTemplateCache, [string, string]>

  constructor(dbName: string = DB_NAME) {
    super(dbName)

    // ─── Version 1: Initial Schema ────────────────────────────────────
    this.version(1).stores({
      // Inspections: Primary key 'id', indexed fields after comma
      inspections: 'id, clientId, status, assignedToId, syncedAt, permitId, scheduledDate, isDirty',

      // Deficiencies: Primary key 'id', indexed fields
      deficiencies: 'id, clientId, inspectionId, status, isDirty, severity, syncedAt, isStopWork',

      // Checklists: Primary key 'id', indexed fields
      checklists: 'id, inspectionId, templateId, isDirty, progress',

      // Checklist Responses: Primary key 'id', compound index for lookups
      checklistResponses: 'id, checklistId, itemId, [checklistId+itemId]',

      // Photos: Primary key 'id', indexed fields
      photos: 'id, clientId, deficiencyId, inspectionId, checklistItemId, syncedAt',

      // Sync Queue: Primary key 'id', indexed for ordered processing
      syncQueue:
        'id, operation, status, createdAt, attempts, priority, [status+priority+createdAt]',
    })

    // ─── Version 2: Permits cache for local search (M4-S9) ─────────────────────
    this.version(2).stores({
      permits: 'id, permitNumber, address, status, updatedAt',
    })

    // ─── Version 3: Checklist template cache for offline execution (M5-S15) ───
    this.version(3).stores({
      checklistTemplateCache: '[templateId+versionHash], templateId, versionHash, cachedAt',
    })

    // ─── Future Version Template ──────────────────────────────────────
    // When adding new tables or indexes, add a new version block:
    //
    // this.version(2).stores({
    //   // Only specify tables that change
    //   inspections: 'id, clientId, status, assignedToId, syncedAt, permitId, scheduledDate, isDirty, newField',
    // }).upgrade(tx => {
    //   // Migration logic
    //   return tx.table('inspections').toCollection().modify(record => {
    //     record.newField = 'default-value';
    //   });
    // });
  }

  /**
   * Clears all data from all tables.
   * Useful for logout/remote wipe scenarios.
   *
   * @returns Promise that resolves when all tables are cleared
   */
  async clearAllData(): Promise<void> {
    await this.transaction(
      'rw',
      [
        this.inspections,
        this.deficiencies,
        this.checklists,
        this.checklistResponses,
        this.photos,
        this.syncQueue,
        this.permits,
        this.checklistTemplateCache,
      ],
      async () => {
        await Promise.all([
          this.inspections.clear(),
          this.deficiencies.clear(),
          this.checklists.clear(),
          this.checklistResponses.clear(),
          this.photos.clear(),
          this.syncQueue.clear(),
          this.permits.clear(),
          this.checklistTemplateCache.clear(),
        ])
      },
    )
  }

  /**
   * Gets the count of records in each table.
   * Useful for debugging and sync status display.
   *
   * @returns Object with table names and their record counts
   */
  async getTableCounts(): Promise<Record<string, number>> {
    const [
      inspections,
      deficiencies,
      checklists,
      checklistResponses,
      photos,
      syncQueue,
      permits,
      checklistTemplateCache,
    ] = await Promise.all([
      this.inspections.count(),
      this.deficiencies.count(),
      this.checklists.count(),
      this.checklistResponses.count(),
      this.photos.count(),
      this.syncQueue.count(),
      this.permits.count(),
      this.checklistTemplateCache.count(),
    ])

    return {
      inspections,
      deficiencies,
      checklists,
      checklistResponses,
      photos,
      syncQueue,
      permits,
      checklistTemplateCache,
    }
  }

  /**
   * Gets the count of dirty (unsynced) records across all tables.
   *
   * @returns Total count of records needing sync
   */
  async getDirtyRecordCount(): Promise<number> {
    const [inspections, deficiencies, checklists] = await Promise.all([
      this.inspections.filter((r) => r.isDirty === true).count(),
      this.deficiencies.filter((r) => r.isDirty === true).count(),
      this.checklists.filter((r) => r.isDirty === true).count(),
    ])

    return inspections + deficiencies + checklists
  }

  /**
   * Gets the count of pending sync queue items.
   *
   * @returns Count of items in the sync queue with PENDING status
   */
  async getPendingSyncCount(): Promise<number> {
    return this.syncQueue.where('status').equals('PENDING').count()
  }

  /**
   * Gets sync queue items ordered by priority and creation time (FIFO within priority).
   *
   * @param limit - Maximum number of items to return
   * @returns Array of sync queue items ordered for processing
   */
  async getNextSyncItems(limit: number = 10): Promise<SyncQueueItem[]> {
    const items = await this.syncQueue.where('status').equals('PENDING').sortBy('priority')
    return items
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority
        return a.createdAt.localeCompare(b.createdAt)
      })
      .slice(0, limit)
  }
}

/**
 * Creates and configures a new InspectorDB instance with encryption middleware.
 *
 * @param dbName - Optional database name (defaults to DB_NAME)
 * @returns Configured InspectorDB instance with encryption middleware applied
 */
export function createInspectorDB(dbName: string = DB_NAME): InspectorDB {
  const database = new InspectorDB(dbName)
  applyEncryptionMiddleware(database)
  return database
}

/**
 * Opens InspectorDB without encryption middleware so reads return on-disk ciphertext.
 * Used during refresh-token rotation to avoid decrypting with the wrong session key.
 */
export function openInspectorDBAtRest(dbName: string = DB_NAME): InspectorDB {
  return new InspectorDB(dbName)
}

let dbInstance: InspectorDB | null = null

/**
 * Lazily constructs the singleton database after encryption has been initialized.
 * Use this throughout the application for all IndexedDB operations.
 *
 * Sensitive fields (notes, certificationSnapshot, description) are
 * automatically encrypted before storage and decrypted on retrieval.
 * Calling this before initEncryptionService() fails closed to avoid plaintext
 * writes during app bootstrap.
 *
 * @example
 * ```typescript
 * import { getDb } from '@/lib/db/dexie'
 *
 * // Data is automatically encrypted when stored
 * await getDb().inspections.add({
 *   id: 'insp-123',
 *   notes: 'Sensitive inspection notes', // Encrypted transparently
 *   // ...
 * })
 *
 * // Data is automatically decrypted when retrieved
 * const inspection = await getDb().inspections.get('insp-123')
 * console.log(inspection.notes) // 'Sensitive inspection notes' (plaintext)
 * ```
 *
 * @see M3-S2 - Implement Data Encryption for Sensitive Fields
 */
export function getDb(): InspectorDB {
  getEncryptionService()

  if (!dbInstance) {
    dbInstance = createInspectorDB()
  }

  return dbInstance
}

/**
 * Closes the lazy singleton. Called when the encrypted session is torn down so
 * later accesses must pass through getDb() and verify encryption is ready again.
 */
export function resetInspectorDBSingleton(): void {
  dbInstance?.close()
  dbInstance = null
}

function unavailableTableProxy(): object {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') return undefined
        return () => Promise.reject(new Error('EncryptionService not initialized'))
      },
    },
  )
}

/**
 * Compatibility facade for older call sites. It is intentionally a lazy proxy,
 * not a Dexie instance, so importing this module cannot open IndexedDB before
 * the encryption service exists.
 */
export const db = new Proxy({} as InspectorDB, {
  get(_target, prop) {
    try {
      const database = getDb()
      const value = database[prop as keyof InspectorDB]
      return typeof value === 'function' ? value.bind(database) : value
    } catch (err) {
      if (typeof prop === 'string' && TABLE_NAMES.has(prop)) {
        return unavailableTableProxy()
      }
      throw err
    }
  },
})
