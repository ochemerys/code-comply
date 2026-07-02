/**
 * IndexedDB Type Definitions for Inspector PWA
 *
 * Defines all table interfaces for the offline-first Dexie.js database.
 * These types cover inspections, deficiencies, checklists, photos, and sync queue.
 *
 * @module lib/db/types
 * @see M3-S1 - Design Complete IndexedDB Schema with Dexie.js
 */

import type {
  ChecklistExecutionDTO,
  ChecklistItemDTO,
  ChecklistResponseDTO,
  ChecklistResponseResult,
  CodeReferenceDTO,
  DeficiencyDTO,
  InspectionDTO,
  PermitListDTO,
  PhotoDTO,
} from '@codecomply/validators'

export type {
  ChecklistResponseResult,
  DeficiencySeverity,
  DeficiencyStatus,
  InspectionStatus,
  PermitStatus,
} from '@codecomply/validators'

// ─── Inspection Types ────────────────────────────────────────────────────────

export type LocalInspectionOutcome = 'ACCEPTABLE' | 'ACCEPTABLE_WITH_CONDITIONS' | 'REFUSED'

export interface LocalInspectionMetadata {
  /** Client-generated UUID for offline deduplication */
  clientId: string
  /** eSite system ID (if synced from external system) */
  esiteId?: string
  /** Permit number for display */
  permitNumber?: string
  /** Permit address for display */
  permitAddress?: string
  /** Wall-clock inspection duration in seconds (field timer, M5-S17) */
  durationSeconds?: number
  /** Legacy local index until stored rows are migrated to assignedInspectorId */
  assignedToId?: string
  /** GPS latitude at start */
  startLatitude?: number
  /** GPS longitude at start */
  startLongitude?: number
  /** GPS latitude at finalization */
  finalizeLatitude?: number
  /** GPS longitude at finalization */
  finalizeLongitude?: number
  /** GPS accuracy in meters at finalization (when available) */
  finalizeAccuracy?: number
  /** Inspection outcome selected during finalization */
  outcome?: LocalInspectionOutcome
  /** Digital signature data URL */
  signatureDataUrl?: string
  /** Certification snapshot at time of inspection (encrypted) */
  certificationSnapshot?: string
  /** ISO timestamp of last successful sync */
  syncedAt?: string
  /** Whether this record has unsynced changes */
  isDirty: boolean
  /** ETag for optimistic concurrency */
  etag?: string
}

export type LocalInspection = InspectionDTO & LocalInspectionMetadata

// ─── Deficiency Types ────────────────────────────────────────────────────────

export type CodeReference = CodeReferenceDTO & {
  description?: string
}

export interface LocalDeficiencyMetadata {
  /** eSite system ID */
  esiteId?: string
  /** ID of the inspector who created this deficiency */
  createdById: string
  /** ISO timestamp of last successful sync */
  syncedAt?: string
  /** Whether this record has unsynced changes */
  isDirty: boolean
  /** ETag for optimistic concurrency */
  etag?: string
}

export type LocalDeficiency = DeficiencyDTO & LocalDeficiencyMetadata

// ─── Checklist Types ─────────────────────────────────────────────────────────

export type ChecklistItem = ChecklistItemDTO & {
  /** Legacy display text for rows persisted before ChecklistItemDTO.text */
  description?: string
  /** Legacy single reference shape for old checklist rows */
  codeReference?: CodeReference
  /** Legacy photo-required flag for old checklist rows */
  requiresPhotoOnFail?: boolean
}

export interface LocalChecklistMetadata {
  /** Template name for display */
  templateName: string
  /** Discipline (e.g., "Building", "Fire", "Plumbing") */
  discipline: string
  /** Checklist items (JSON array) */
  items: ChecklistItem[]
  /** ISO timestamp of creation */
  createdAt: string
  /** ISO timestamp of last update */
  updatedAt: string
  /** ISO timestamp of last successful sync */
  syncedAt?: string
  /** Whether this record has unsynced changes */
  isDirty: boolean
}

export type LocalChecklist = ChecklistExecutionDTO & LocalChecklistMetadata

/**
 * Cached checklist template definition for offline execution (M5-S15).
 * Primary key in Dexie is the compound index [templateId+versionHash].
 */
export interface LocalChecklistTemplateCache {
  templateId: string
  versionHash: string
  name: string
  discipline: string
  version: number
  /** Line items in ChecklistItemDTO shape (text, not description) */
  items: CachedChecklistTemplateItem[]
  /** When this cache row was written (ISO); used for TTL and LRU eviction */
  cachedAt: string
}

/** Subset aligned with @codecomply/validators ChecklistItemDTO for JSON storage */
export interface CachedChecklistTemplateItem {
  id: string
  order: number
  text: string
  category?: string
  isRequired?: boolean
  requiresPhoto?: boolean
  codeReferences?: CodeReference[]
}

// ─── Checklist Response Types ────────────────────────────────────────────────

export interface LocalChecklistResponse {
  /** Unique response ID */
  id: string
  /** Parent checklist ID */
  checklistId: string
  /** Checklist item ID this response is for */
  itemId: string
  /** The result: Pass, Fail, or N/A */
  result: ChecklistResponseResult
  /** Code reference selected on failure */
  codeReference?: CodeReference
  /** Additional notes */
  notes?: string
  /** ISO timestamp of when the response was recorded */
  respondedAt: string
  /** ISO timestamp of last update */
  updatedAt: string
  /** Pending sync to server (M5-S16) */
  isDirty?: boolean
  /** Last successful push to server */
  syncedAt?: string
}

export type LocalChecklistResponseDTO = ChecklistResponseDTO

// ─── Photo Types ─────────────────────────────────────────────────────────────

export interface PhotoMetadata extends Record<string, unknown> {
  /** Capture timestamp */
  timestamp: string
  /** GPS latitude */
  latitude?: number
  /** GPS longitude */
  longitude?: number
  /** Geolocation accuracy in meters when available */
  accuracyMeters?: number
  /** Inspector ID */
  inspectorId: string
  /** Inspector display name (reports / watermark) */
  inspectorName?: string
  /** Permit number */
  permitNumber?: string
  /** Typical source: navigator.userAgent */
  deviceInfo?: string
  /** Whether watermark is applied */
  hasWatermark: boolean
}

export interface LocalPhotoMetadata {
  /** Associated checklist item ID (optional) */
  checklistItemId?: string
  /** Binary blob data stored in IndexedDB */
  blob?: Blob
  /** Base64 thumbnail for quick display */
  thumbnail?: string
  /** S3 storage key (after upload) */
  storageKey?: string
  /** Photo metadata (timestamp, GPS, etc.) */
  metadata: PhotoMetadata
  /** Annotation data (drawing overlays) */
  annotations?: string
}

export type LocalPhoto = PhotoDTO & LocalPhotoMetadata

// ─── Local Permit Cache (M4-S9 – local search) ────────────────────────────────

export interface LocalPermitMetadata {
  /** When this record was cached (for TTL / refresh) */
  updatedAt: string
}

export type LocalPermit = PermitListDTO & LocalPermitMetadata

// ─── Sync Queue Types ────────────────────────────────────────────────────────

export type SyncOperation =
  | 'inspection.create'
  | 'inspection.update'
  | 'inspection.finalize'
  | 'deficiency.create'
  | 'deficiency.update'
  | 'deficiency.delete'
  | 'deficiency.voc.submit'
  | 'checklist.update'
  | 'checklistResponse.update'
  | 'photo.upload'
  | 'photo.delete'
  | 'permit.sync'

export type SyncStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'

export interface SyncQueueItem {
  /** Unique queue item ID */
  id: string
  /** Client ID for deduplication */
  clientId: string
  /** The operation to perform */
  operation: SyncOperation
  /** The payload to send to the server */
  payload: Record<string, unknown>
  /** Current status */
  status: SyncStatus
  /** Number of sync attempts */
  attempts: number
  /** Maximum number of retry attempts */
  maxAttempts: number
  /** Last error message */
  lastError?: string
  /** ISO timestamp of creation */
  createdAt: string
  /** ISO timestamp of last attempt */
  lastAttemptAt?: string
  /** Priority (lower = higher priority) */
  priority: number
}

// ─── Database Schema Version Types ───────────────────────────────────────────

export interface SchemaVersion {
  /** Version number */
  version: number
  /** Description of changes in this version */
  description: string
  /** ISO timestamp of when this version was applied */
  appliedAt: string
}
