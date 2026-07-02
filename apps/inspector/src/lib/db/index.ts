/**
 * Database module - Offline-first data layer for Inspector PWA
 *
 * @module lib/db
 */

export {
  db,
  getDb,
  resetInspectorDBSingleton,
  InspectorDB,
  createInspectorDB,
  DB_NAME,
  DB_VERSION,
} from './dexie'
export {
  SyncEngine,
  syncEngine,
  createSyncEngine,
  type SyncEngineStatus,
  type SyncEvent,
  type SyncEventType,
  type SyncEventListener,
  type RetryConfig,
  type MutationProcessor,
  type AuthCheckFunction,
} from './sync-engine'
export type {
  LocalInspection,
  LocalDeficiency,
  LocalChecklist,
  LocalChecklistResponse,
  LocalPhoto,
  LocalPermit,
  SyncQueueItem,
  SyncOperation,
  SyncStatus,
  InspectionStatus,
  DeficiencySeverity,
  DeficiencyStatus,
  CodeReference,
  ChecklistItem,
  ChecklistResponseResult,
  PhotoMetadata,
  SchemaVersion,
} from './types'
export {
  encrypt,
  decrypt,
  encryptObject,
  decryptObject,
  generateEncryptionKey,
  hashSHA256,
  EncryptionService,
  initEncryptionService,
  getEncryptionService,
  isEncryptionServiceInitialized,
  resetEncryptionService,
  deriveKey,
  isEncrypted,
  clearDerivedKeyCache,
  SENSITIVE_FIELDS,
  ENCRYPTED_PREFIX,
  ENCRYPTED_PREFIX_V2,
  PBKDF2_ITERATIONS,
} from './encryption'
export { applyEncryptionMiddleware } from './encryption-middleware'
export {
  initEncryptionForSession,
  teardownEncryptionSession,
  bootstrapEncryptionSession,
  migratePlaintextSensitiveFields,
  migrateLegacyDerivationSalt,
  reencryptSensitiveFieldsForRotatedKey,
} from './encryption-bootstrap'
export type { BootstrapEncryptionSessionOptions } from './encryption-bootstrap'
export { getOrCreateDeviceId } from './device-id'
export {
  BackgroundSyncManager,
  backgroundSyncManager,
  createBackgroundSyncManager,
  handleSyncEvent,
  SYNC_TAGS,
  type SyncTag,
  type BackgroundSyncStatus,
  type BackgroundSyncEvent,
  type BackgroundSyncEventType,
  type BackgroundSyncEventListener,
  type BackgroundSyncConfig,
} from './background-sync'
