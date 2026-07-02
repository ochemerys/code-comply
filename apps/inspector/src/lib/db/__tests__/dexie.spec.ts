/**
 * Unit tests for InspectorDB (Dexie.js IndexedDB schema)
 *
 * Tests database initialization, table creation, schema versioning,
 * index creation, and data insertion/retrieval.
 *
 * @see M3-S1 - Design Complete IndexedDB Schema with Dexie.js
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db, getDb, resetInspectorDBSingleton, InspectorDB, DB_NAME, DB_VERSION } from '../dexie'
import { initEncryptionService, resetEncryptionService } from '../encryption'
import type {
  LocalInspection,
  LocalDeficiency,
  LocalChecklist,
  LocalChecklistResponse,
  LocalPhoto,
  SyncQueueItem,
} from '../types'

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function createTestInspection(overrides?: Partial<LocalInspection>): LocalInspection {
  return {
    id: 'insp-' + Math.random().toString(36).substr(2, 9),
    clientId: 'client-' + Math.random().toString(36).substr(2, 9),
    permitId: 'permit-123',
    permitNumber: 'P-2024-001',
    permitAddress: '123 Main St',
    status: 'SCHEDULED',
    scheduledDate: '2024-03-15T09:00:00.000Z',
    assignedToId: 'user-456',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDirty: false,
    ...overrides,
  }
}

function createTestDeficiency(overrides?: Partial<LocalDeficiency>): LocalDeficiency {
  return {
    id: 'def-' + Math.random().toString(36).substr(2, 9),
    clientId: 'client-' + Math.random().toString(36).substr(2, 9),
    inspectionId: 'insp-123',
    createdById: 'user-456',
    description: 'Missing fire extinguisher in hallway',
    location: 'Room 101',
    severity: 'MAJOR',
    status: 'OPEN',
    isStopWork: false,
    isUnsafe: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDirty: false,
    ...overrides,
  }
}

function createTestChecklist(overrides?: Partial<LocalChecklist>): LocalChecklist {
  return {
    id: 'cl-' + Math.random().toString(36).substr(2, 9),
    inspectionId: 'insp-123',
    templateId: 'tmpl-789',
    versionHash: 'hash-abc123',
    templateName: 'Building Inspection Checklist',
    discipline: 'Building',
    items: [
      {
        id: 'item-1',
        description: 'Foundation integrity',
        isRequired: true,
        requiresPhotoOnFail: true,
        order: 1,
      },
      {
        id: 'item-2',
        description: 'Framing inspection',
        isRequired: true,
        requiresPhotoOnFail: false,
        order: 2,
        codeReference: { code: 'NBC', section: '9.10.1' },
      },
    ],
    progress: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDirty: false,
    ...overrides,
  }
}

function createTestChecklistResponse(
  overrides?: Partial<LocalChecklistResponse>,
): LocalChecklistResponse {
  return {
    id: 'resp-' + Math.random().toString(36).substr(2, 9),
    checklistId: 'cl-123',
    itemId: 'item-1',
    result: 'PASS',
    respondedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function createTestPhoto(overrides?: Partial<LocalPhoto>): LocalPhoto {
  return {
    id: 'photo-' + Math.random().toString(36).substr(2, 9),
    clientId: 'client-' + Math.random().toString(36).substr(2, 9),
    inspectionId: 'insp-123',
    filename: 'deficiency-photo.jpg',
    mimeType: 'image/jpeg',
    size: 245000,
    metadata: {
      timestamp: new Date().toISOString(),
      latitude: 51.0447,
      longitude: -114.0719,
      inspectorId: 'user-456',
      permitNumber: 'P-2024-001',
      hasWatermark: false,
    },
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function createTestSyncQueueItem(overrides?: Partial<SyncQueueItem>): SyncQueueItem {
  return {
    id: 'sync-' + Math.random().toString(36).substr(2, 9),
    clientId: 'client-' + Math.random().toString(36).substr(2, 9),
    operation: 'deficiency.create',
    payload: { description: 'Test deficiency' },
    status: 'PENDING',
    attempts: 0,
    maxAttempts: 3,
    createdAt: new Date().toISOString(),
    priority: 1,
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('InspectorDB', () => {
  let testDb: InspectorDB

  beforeEach(async () => {
    // Create a unique database name for each test to avoid conflicts
    const dbName = `TestDB-${Math.random().toString(36).substr(2, 9)}`
    testDb = new InspectorDB(dbName)
    await testDb.open()
  })

  afterEach(async () => {
    if (testDb.isOpen()) {
      testDb.close()
    }
    await testDb.delete()
  })

  describe('Encrypted singleton', () => {
    let singletonDb: InspectorDB | null = null

    afterEach(async () => {
      if (singletonDb) {
        await singletonDb.delete()
        singletonDb = null
      }
      resetInspectorDBSingleton()
      resetEncryptionService()
    })

    it('should throw before encryption is initialized', () => {
      resetEncryptionService()
      expect(() => getDb()).toThrow(/EncryptionService not initialized/)
    })

    it('should create the singleton lazily after encryption is initialized', () => {
      initEncryptionService('test-singleton-key')

      singletonDb = getDb()

      expect(singletonDb.name).toBe(DB_NAME)
      expect(getDb()).toBe(singletonDb)
    })

    it('should reject table writes through the compatibility facade before init', async () => {
      resetEncryptionService()

      await expect(
        db.inspections.add(createTestInspection({ id: 'insp-before-encryption' })),
      ).rejects.toThrow(/EncryptionService not initialized/)
    })
  })

  // ─── Database Initialization ─────────────────────────────────────────────

  describe('Database Initialization', () => {
    it('should create database with correct name', () => {
      expect(testDb.name).toContain('TestDB')
    })

    it('should open successfully', () => {
      expect(testDb.isOpen()).toBe(true)
    })

    it('should use default DB_NAME when no name provided', () => {
      const defaultDb = new InspectorDB()
      expect(defaultDb.name).toBe(DB_NAME)
      defaultDb.close()
    })

    it('should export correct DB_VERSION', () => {
      expect(DB_VERSION).toBe(3)
    })

    it('should export correct DB_NAME', () => {
      expect(DB_NAME).toBe('InspectorDB')
    })
  })

  // ─── Table Creation ──────────────────────────────────────────────────────

  describe('Table Creation', () => {
    it('should have inspections table', () => {
      expect(testDb.inspections).toBeDefined()
      expect(testDb.inspections.name).toBe('inspections')
    })

    it('should have deficiencies table', () => {
      expect(testDb.deficiencies).toBeDefined()
      expect(testDb.deficiencies.name).toBe('deficiencies')
    })

    it('should have checklists table', () => {
      expect(testDb.checklists).toBeDefined()
      expect(testDb.checklists.name).toBe('checklists')
    })

    it('should have checklistResponses table', () => {
      expect(testDb.checklistResponses).toBeDefined()
      expect(testDb.checklistResponses.name).toBe('checklistResponses')
    })

    it('should have photos table', () => {
      expect(testDb.photos).toBeDefined()
      expect(testDb.photos.name).toBe('photos')
    })

    it('should have syncQueue table', () => {
      expect(testDb.syncQueue).toBeDefined()
      expect(testDb.syncQueue.name).toBe('syncQueue')
    })

    it('should have permits table', () => {
      expect(testDb.permits).toBeDefined()
      expect(testDb.permits.name).toBe('permits')
    })

    it('should have checklistTemplateCache table', () => {
      expect(testDb.checklistTemplateCache).toBeDefined()
      expect(testDb.checklistTemplateCache.name).toBe('checklistTemplateCache')
    })

    it('should have exactly 8 tables', () => {
      expect(testDb.tables.length).toBe(8)
    })
  })

  // ─── Index Creation ──────────────────────────────────────────────────────

  describe('Index Creation', () => {
    it('should have correct indexes on inspections table', () => {
      const schema = testDb.inspections.schema
      const indexNames = schema.indexes.map((idx) => idx.name)

      expect(indexNames).toContain('clientId')
      expect(indexNames).toContain('status')
      expect(indexNames).toContain('assignedToId')
      expect(indexNames).toContain('syncedAt')
      expect(indexNames).toContain('permitId')
      expect(indexNames).toContain('scheduledDate')
      expect(indexNames).toContain('isDirty')
    })

    it('should have correct indexes on deficiencies table', () => {
      const schema = testDb.deficiencies.schema
      const indexNames = schema.indexes.map((idx) => idx.name)

      expect(indexNames).toContain('clientId')
      expect(indexNames).toContain('inspectionId')
      expect(indexNames).toContain('status')
      expect(indexNames).toContain('isDirty')
      expect(indexNames).toContain('severity')
      expect(indexNames).toContain('syncedAt')
      expect(indexNames).toContain('isStopWork')
    })

    it('should have correct indexes on checklists table', () => {
      const schema = testDb.checklists.schema
      const indexNames = schema.indexes.map((idx) => idx.name)

      expect(indexNames).toContain('inspectionId')
      expect(indexNames).toContain('templateId')
      expect(indexNames).toContain('isDirty')
      expect(indexNames).toContain('progress')
    })

    it('should have correct indexes on checklistResponses table', () => {
      const schema = testDb.checklistResponses.schema
      const indexNames = schema.indexes.map((idx) => idx.name)

      expect(indexNames).toContain('checklistId')
      expect(indexNames).toContain('itemId')
      expect(indexNames).toContain('[checklistId+itemId]')
    })

    it('should have correct indexes on photos table', () => {
      const schema = testDb.photos.schema
      const indexNames = schema.indexes.map((idx) => idx.name)

      expect(indexNames).toContain('clientId')
      expect(indexNames).toContain('deficiencyId')
      expect(indexNames).toContain('inspectionId')
      expect(indexNames).toContain('checklistItemId')
      expect(indexNames).toContain('syncedAt')
    })

    it('should have correct indexes on syncQueue table', () => {
      const schema = testDb.syncQueue.schema
      const indexNames = schema.indexes.map((idx) => idx.name)

      expect(indexNames).toContain('operation')
      expect(indexNames).toContain('status')
      expect(indexNames).toContain('createdAt')
      expect(indexNames).toContain('attempts')
      expect(indexNames).toContain('priority')
      expect(indexNames).toContain('[status+priority+createdAt]')
    })

    it('should have correct indexes on checklistTemplateCache table', () => {
      const schema = testDb.checklistTemplateCache.schema
      const indexNames = schema.indexes.map((idx) => idx.name)

      expect(schema.primKey.name).toBe('[templateId+versionHash]')
      expect(indexNames).toContain('templateId')
      expect(indexNames).toContain('versionHash')
      expect(indexNames).toContain('cachedAt')
    })

    it('should use id as primary key for all tables', () => {
      const tables = [
        testDb.inspections,
        testDb.deficiencies,
        testDb.checklists,
        testDb.checklistResponses,
        testDb.photos,
        testDb.syncQueue,
      ]

      for (const table of tables) {
        expect(table.schema.primKey.name).toBe('id')
      }
    })
  })

  // ─── Data Insertion and Retrieval ────────────────────────────────────────

  describe('Inspections CRUD', () => {
    it('should insert and retrieve an inspection', async () => {
      const inspection = createTestInspection({ id: 'insp-test-1' })
      await testDb.inspections.add(inspection)

      const retrieved = await testDb.inspections.get('insp-test-1')
      expect(retrieved).toBeDefined()
      expect(retrieved!.id).toBe('insp-test-1')
      expect(retrieved!.status).toBe('SCHEDULED')
      expect(retrieved!.permitNumber).toBe('P-2024-001')
    })

    it('should query inspections by status', async () => {
      await testDb.inspections.bulkAdd([
        createTestInspection({ id: 'insp-1', status: 'SCHEDULED' }),
        createTestInspection({ id: 'insp-2', status: 'IN_PROGRESS' }),
        createTestInspection({ id: 'insp-3', status: 'SCHEDULED' }),
        createTestInspection({ id: 'insp-4', status: 'PASSED' }),
      ])

      const scheduled = await testDb.inspections.where('status').equals('SCHEDULED').toArray()

      expect(scheduled.length).toBe(2)
    })

    it('should query inspections by assignedToId', async () => {
      await testDb.inspections.bulkAdd([
        createTestInspection({ id: 'insp-1', assignedToId: 'user-A' }),
        createTestInspection({ id: 'insp-2', assignedToId: 'user-B' }),
        createTestInspection({ id: 'insp-3', assignedToId: 'user-A' }),
      ])

      const userAInspections = await testDb.inspections
        .where('assignedToId')
        .equals('user-A')
        .toArray()

      expect(userAInspections.length).toBe(2)
    })

    it('should update an inspection', async () => {
      const inspection = createTestInspection({ id: 'insp-update' })
      await testDb.inspections.add(inspection)

      await testDb.inspections.update('insp-update', {
        status: 'IN_PROGRESS',
        isDirty: true,
      })

      const updated = await testDb.inspections.get('insp-update')
      expect(updated!.status).toBe('IN_PROGRESS')
      expect(updated!.isDirty).toBe(true)
    })

    it('should delete an inspection', async () => {
      await testDb.inspections.add(createTestInspection({ id: 'insp-delete' }))
      await testDb.inspections.delete('insp-delete')

      const deleted = await testDb.inspections.get('insp-delete')
      expect(deleted).toBeUndefined()
    })
  })

  describe('Deficiencies CRUD', () => {
    it('should insert and retrieve a deficiency', async () => {
      const deficiency = createTestDeficiency({ id: 'def-test-1' })
      await testDb.deficiencies.add(deficiency)

      const retrieved = await testDb.deficiencies.get('def-test-1')
      expect(retrieved).toBeDefined()
      expect(retrieved!.severity).toBe('MAJOR')
      expect(retrieved!.description).toContain('fire extinguisher')
    })

    it('should query deficiencies by inspectionId', async () => {
      await testDb.deficiencies.bulkAdd([
        createTestDeficiency({ id: 'def-1', inspectionId: 'insp-A' }),
        createTestDeficiency({ id: 'def-2', inspectionId: 'insp-B' }),
        createTestDeficiency({ id: 'def-3', inspectionId: 'insp-A' }),
      ])

      const inspADeficiencies = await testDb.deficiencies
        .where('inspectionId')
        .equals('insp-A')
        .toArray()

      expect(inspADeficiencies.length).toBe(2)
    })

    it('should query deficiencies by severity', async () => {
      await testDb.deficiencies.bulkAdd([
        createTestDeficiency({ id: 'def-1', severity: 'MINOR' }),
        createTestDeficiency({ id: 'def-2', severity: 'CRITICAL' }),
        createTestDeficiency({ id: 'def-3', severity: 'CRITICAL' }),
      ])

      const critical = await testDb.deficiencies.where('severity').equals('CRITICAL').toArray()

      expect(critical.length).toBe(2)
    })

    it('should query stop work deficiencies', async () => {
      await testDb.deficiencies.bulkAdd([
        createTestDeficiency({ id: 'def-1', isStopWork: false }),
        createTestDeficiency({ id: 'def-2', isStopWork: true }),
        createTestDeficiency({ id: 'def-3', isStopWork: true }),
      ])

      // Filter stop work deficiencies using Dexie filter
      const allDefs = await testDb.deficiencies.toArray()
      const stopWork = allDefs.filter((d) => d.isStopWork === true)

      expect(stopWork.length).toBe(2)
      expect(stopWork.every((d) => d.isStopWork)).toBe(true)
    })

    it('should store code reference as JSON', async () => {
      const deficiency = createTestDeficiency({
        id: 'def-code',
        codeReference: { code: 'NBC', section: '9.10.1', title: 'Fire Safety' },
      })
      await testDb.deficiencies.add(deficiency)

      const retrieved = await testDb.deficiencies.get('def-code')
      expect(retrieved!.codeReference).toEqual({
        code: 'NBC',
        section: '9.10.1',
        title: 'Fire Safety',
      })
    })
  })

  describe('Checklists CRUD', () => {
    it('should insert and retrieve a checklist', async () => {
      const checklist = createTestChecklist({ id: 'cl-test-1' })
      await testDb.checklists.add(checklist)

      const retrieved = await testDb.checklists.get('cl-test-1')
      expect(retrieved).toBeDefined()
      expect(retrieved!.templateName).toBe('Building Inspection Checklist')
      expect(retrieved!.items.length).toBe(2)
    })

    it('should query checklists by inspectionId', async () => {
      await testDb.checklists.bulkAdd([
        createTestChecklist({ id: 'cl-1', inspectionId: 'insp-A' }),
        createTestChecklist({ id: 'cl-2', inspectionId: 'insp-B' }),
        createTestChecklist({ id: 'cl-3', inspectionId: 'insp-A' }),
      ])

      const inspAChecklists = await testDb.checklists
        .where('inspectionId')
        .equals('insp-A')
        .toArray()

      expect(inspAChecklists.length).toBe(2)
    })

    it('should store checklist items as JSON array', async () => {
      const checklist = createTestChecklist({ id: 'cl-items' })
      await testDb.checklists.add(checklist)

      const retrieved = await testDb.checklists.get('cl-items')
      expect(Array.isArray(retrieved!.items)).toBe(true)
      expect(retrieved!.items[0].description).toBe('Foundation integrity')
      expect(retrieved!.items[1].codeReference).toEqual({
        code: 'NBC',
        section: '9.10.1',
      })
    })
  })

  describe('Checklist Responses CRUD', () => {
    it('should insert and retrieve a checklist response', async () => {
      const response = createTestChecklistResponse({ id: 'resp-test-1' })
      await testDb.checklistResponses.add(response)

      const retrieved = await testDb.checklistResponses.get('resp-test-1')
      expect(retrieved).toBeDefined()
      expect(retrieved!.result).toBe('PASS')
    })

    it('should query responses by checklistId', async () => {
      await testDb.checklistResponses.bulkAdd([
        createTestChecklistResponse({
          id: 'resp-1',
          checklistId: 'cl-A',
          itemId: 'item-1',
        }),
        createTestChecklistResponse({
          id: 'resp-2',
          checklistId: 'cl-B',
          itemId: 'item-1',
        }),
        createTestChecklistResponse({
          id: 'resp-3',
          checklistId: 'cl-A',
          itemId: 'item-2',
        }),
      ])

      const clAResponses = await testDb.checklistResponses
        .where('checklistId')
        .equals('cl-A')
        .toArray()

      expect(clAResponses.length).toBe(2)
    })

    it('should query responses by compound index [checklistId+itemId]', async () => {
      await testDb.checklistResponses.bulkAdd([
        createTestChecklistResponse({
          id: 'resp-1',
          checklistId: 'cl-A',
          itemId: 'item-1',
        }),
        createTestChecklistResponse({
          id: 'resp-2',
          checklistId: 'cl-A',
          itemId: 'item-2',
        }),
        createTestChecklistResponse({
          id: 'resp-3',
          checklistId: 'cl-B',
          itemId: 'item-1',
        }),
      ])

      const specific = await testDb.checklistResponses
        .where('[checklistId+itemId]')
        .equals(['cl-A', 'item-1'])
        .toArray()

      expect(specific.length).toBe(1)
      expect(specific[0].id).toBe('resp-1')
    })

    it('should store all response result types', async () => {
      await testDb.checklistResponses.bulkAdd([
        createTestChecklistResponse({
          id: 'resp-pass',
          result: 'PASS',
        }),
        createTestChecklistResponse({
          id: 'resp-fail',
          result: 'FAIL',
          codeReference: { code: 'NBC', section: '9.10.1' },
        }),
        createTestChecklistResponse({
          id: 'resp-na',
          result: 'NA',
        }),
      ])

      const pass = await testDb.checklistResponses.get('resp-pass')
      const fail = await testDb.checklistResponses.get('resp-fail')
      const na = await testDb.checklistResponses.get('resp-na')

      expect(pass!.result).toBe('PASS')
      expect(fail!.result).toBe('FAIL')
      expect(fail!.codeReference).toEqual({ code: 'NBC', section: '9.10.1' })
      expect(na!.result).toBe('NA')
    })
  })

  describe('Photos CRUD', () => {
    it('should insert and retrieve a photo', async () => {
      const photo = createTestPhoto({ id: 'photo-test-1' })
      await testDb.photos.add(photo)

      const retrieved = await testDb.photos.get('photo-test-1')
      expect(retrieved).toBeDefined()
      expect(retrieved!.filename).toBe('deficiency-photo.jpg')
      expect(retrieved!.metadata.latitude).toBe(51.0447)
    })

    it('should query photos by inspectionId', async () => {
      await testDb.photos.bulkAdd([
        createTestPhoto({ id: 'photo-1', inspectionId: 'insp-A' }),
        createTestPhoto({ id: 'photo-2', inspectionId: 'insp-B' }),
        createTestPhoto({ id: 'photo-3', inspectionId: 'insp-A' }),
      ])

      const inspAPhotos = await testDb.photos.where('inspectionId').equals('insp-A').toArray()

      expect(inspAPhotos.length).toBe(2)
    })

    it('should query photos by deficiencyId', async () => {
      await testDb.photos.bulkAdd([
        createTestPhoto({ id: 'photo-1', deficiencyId: 'def-A' }),
        createTestPhoto({ id: 'photo-2', deficiencyId: 'def-B' }),
        createTestPhoto({ id: 'photo-3', deficiencyId: 'def-A' }),
      ])

      const defAPhotos = await testDb.photos.where('deficiencyId').equals('def-A').toArray()

      expect(defAPhotos.length).toBe(2)
    })

    it('should store photo metadata as JSON', async () => {
      const photo = createTestPhoto({
        id: 'photo-meta',
        metadata: {
          timestamp: '2024-03-15T10:30:00.000Z',
          latitude: 51.0447,
          longitude: -114.0719,
          inspectorId: 'user-789',
          permitNumber: 'P-2024-002',
          hasWatermark: true,
        },
      })
      await testDb.photos.add(photo)

      const retrieved = await testDb.photos.get('photo-meta')
      expect(retrieved!.metadata.inspectorId).toBe('user-789')
      expect(retrieved!.metadata.hasWatermark).toBe(true)
    })
  })

  describe('Sync Queue CRUD', () => {
    it('should insert and retrieve a sync queue item', async () => {
      const item = createTestSyncQueueItem({ id: 'sync-test-1' })
      await testDb.syncQueue.add(item)

      const retrieved = await testDb.syncQueue.get('sync-test-1')
      expect(retrieved).toBeDefined()
      expect(retrieved!.operation).toBe('deficiency.create')
      expect(retrieved!.status).toBe('PENDING')
    })

    it('should query sync queue by status', async () => {
      await testDb.syncQueue.bulkAdd([
        createTestSyncQueueItem({ id: 'sync-1', status: 'PENDING' }),
        createTestSyncQueueItem({ id: 'sync-2', status: 'COMPLETED' }),
        createTestSyncQueueItem({ id: 'sync-3', status: 'PENDING' }),
        createTestSyncQueueItem({ id: 'sync-4', status: 'FAILED' }),
      ])

      const pending = await testDb.syncQueue.where('status').equals('PENDING').toArray()

      expect(pending.length).toBe(2)
    })

    it('should query sync queue by operation', async () => {
      await testDb.syncQueue.bulkAdd([
        createTestSyncQueueItem({
          id: 'sync-1',
          operation: 'deficiency.create',
        }),
        createTestSyncQueueItem({
          id: 'sync-2',
          operation: 'photo.upload',
        }),
        createTestSyncQueueItem({
          id: 'sync-3',
          operation: 'deficiency.create',
        }),
      ])

      const defCreates = await testDb.syncQueue
        .where('operation')
        .equals('deficiency.create')
        .toArray()

      expect(defCreates.length).toBe(2)
    })

    it('should order sync queue by createdAt', async () => {
      const now = Date.now()
      await testDb.syncQueue.bulkAdd([
        createTestSyncQueueItem({
          id: 'sync-3',
          createdAt: new Date(now + 2000).toISOString(),
        }),
        createTestSyncQueueItem({
          id: 'sync-1',
          createdAt: new Date(now).toISOString(),
        }),
        createTestSyncQueueItem({
          id: 'sync-2',
          createdAt: new Date(now + 1000).toISOString(),
        }),
      ])

      const ordered = await testDb.syncQueue.orderBy('createdAt').toArray()

      expect(ordered[0].id).toBe('sync-1')
      expect(ordered[1].id).toBe('sync-2')
      expect(ordered[2].id).toBe('sync-3')
    })

    it('should increment attempts on retry', async () => {
      await testDb.syncQueue.add(createTestSyncQueueItem({ id: 'sync-retry', attempts: 0 }))

      await testDb.syncQueue.update('sync-retry', {
        attempts: 1,
        lastError: 'Network error',
        lastAttemptAt: new Date().toISOString(),
      })

      const updated = await testDb.syncQueue.get('sync-retry')
      expect(updated!.attempts).toBe(1)
      expect(updated!.lastError).toBe('Network error')
    })
  })

  // ─── Utility Methods ─────────────────────────────────────────────────────

  describe('clearAllData', () => {
    it('should clear all tables', async () => {
      // Add data to all tables
      await testDb.inspections.add(createTestInspection({ id: 'insp-1' }))
      await testDb.deficiencies.add(createTestDeficiency({ id: 'def-1' }))
      await testDb.checklists.add(createTestChecklist({ id: 'cl-1' }))
      await testDb.checklistResponses.add(createTestChecklistResponse({ id: 'resp-1' }))
      await testDb.photos.add(createTestPhoto({ id: 'photo-1' }))
      await testDb.syncQueue.add(createTestSyncQueueItem({ id: 'sync-1' }))
      await testDb.permits.add({
        id: 'permit-clear-1',
        permitNumber: 'P-CLEAR',
        address: '1 Clear St',
        status: 'ACTIVE',
        updatedAt: new Date().toISOString(),
      })
      await testDb.checklistTemplateCache.put({
        templateId: 'tpl-clear',
        versionHash: 'h-clear',
        name: 'Clear',
        discipline: 'D',
        version: 1,
        items: [{ id: 'i1', order: 1, text: 'q', isRequired: true, requiresPhoto: false }],
        cachedAt: new Date().toISOString(),
      })

      // Verify data exists
      const countsBefore = await testDb.getTableCounts()
      expect(countsBefore.inspections).toBe(1)
      expect(countsBefore.deficiencies).toBe(1)
      expect(countsBefore.permits).toBe(1)
      expect(countsBefore.checklistTemplateCache).toBe(1)

      // Clear all data
      await testDb.clearAllData()

      // Verify all tables are empty
      const countsAfter = await testDb.getTableCounts()
      expect(countsAfter.inspections).toBe(0)
      expect(countsAfter.deficiencies).toBe(0)
      expect(countsAfter.checklists).toBe(0)
      expect(countsAfter.checklistResponses).toBe(0)
      expect(countsAfter.photos).toBe(0)
      expect(countsAfter.syncQueue).toBe(0)
      expect(countsAfter.permits).toBe(0)
      expect(countsAfter.checklistTemplateCache).toBe(0)
    })
  })

  describe('getTableCounts', () => {
    it('should return correct counts for all tables', async () => {
      await testDb.inspections.bulkAdd([
        createTestInspection({ id: 'insp-1' }),
        createTestInspection({ id: 'insp-2' }),
      ])
      await testDb.deficiencies.add(createTestDeficiency({ id: 'def-1' }))
      await testDb.syncQueue.bulkAdd([
        createTestSyncQueueItem({ id: 'sync-1' }),
        createTestSyncQueueItem({ id: 'sync-2' }),
        createTestSyncQueueItem({ id: 'sync-3' }),
      ])

      const counts = await testDb.getTableCounts()

      expect(counts.inspections).toBe(2)
      expect(counts.deficiencies).toBe(1)
      expect(counts.checklists).toBe(0)
      expect(counts.checklistResponses).toBe(0)
      expect(counts.photos).toBe(0)
      expect(counts.syncQueue).toBe(3)
      expect(counts.permits).toBe(0)
      expect(counts.checklistTemplateCache).toBe(0)
    })
  })

  describe('getPendingSyncCount', () => {
    it('should return count of pending sync items', async () => {
      await testDb.syncQueue.bulkAdd([
        createTestSyncQueueItem({ id: 'sync-1', status: 'PENDING' }),
        createTestSyncQueueItem({ id: 'sync-2', status: 'COMPLETED' }),
        createTestSyncQueueItem({ id: 'sync-3', status: 'PENDING' }),
        createTestSyncQueueItem({ id: 'sync-4', status: 'FAILED' }),
      ])

      const count = await testDb.getPendingSyncCount()
      expect(count).toBe(2)
    })

    it('should return 0 when no pending items', async () => {
      const count = await testDb.getPendingSyncCount()
      expect(count).toBe(0)
    })
  })

  describe('getNextSyncItems', () => {
    it('should return pending items ordered by priority and createdAt', async () => {
      const now = Date.now()
      await testDb.syncQueue.bulkAdd([
        createTestSyncQueueItem({
          id: 'sync-low-old',
          status: 'PENDING',
          priority: 2,
          createdAt: new Date(now).toISOString(),
        }),
        createTestSyncQueueItem({
          id: 'sync-high-new',
          status: 'PENDING',
          priority: 0,
          createdAt: new Date(now + 1000).toISOString(),
        }),
        createTestSyncQueueItem({
          id: 'sync-high-old',
          status: 'PENDING',
          priority: 0,
          createdAt: new Date(now).toISOString(),
        }),
        createTestSyncQueueItem({
          id: 'sync-completed',
          status: 'COMPLETED',
          priority: 0,
          createdAt: new Date(now).toISOString(),
        }),
      ])

      const items = await testDb.getNextSyncItems(10)

      // Should only include PENDING items
      expect(items.length).toBe(3)
      // Should be ordered by priority (ascending) then createdAt
      expect(items[0].id).toBe('sync-high-old')
      expect(items[1].id).toBe('sync-high-new')
      expect(items[2].id).toBe('sync-low-old')
    })

    it('should respect the limit parameter', async () => {
      await testDb.syncQueue.bulkAdd([
        createTestSyncQueueItem({
          id: 'sync-1',
          status: 'PENDING',
          priority: 1,
        }),
        createTestSyncQueueItem({
          id: 'sync-2',
          status: 'PENDING',
          priority: 1,
        }),
        createTestSyncQueueItem({
          id: 'sync-3',
          status: 'PENDING',
          priority: 1,
        }),
      ])

      const items = await testDb.getNextSyncItems(2)
      expect(items.length).toBe(2)
    })
  })

  // ─── Schema Versioning ───────────────────────────────────────────────────

  describe('Schema Versioning', () => {
    it('should be at version 3', () => {
      expect(testDb.verno).toBe(3)
    })

    it('should handle database re-open', async () => {
      // Add data
      await testDb.inspections.add(createTestInspection({ id: 'insp-reopen' }))

      // Close and re-open
      testDb.close()
      await testDb.open()

      // Data should persist
      const retrieved = await testDb.inspections.get('insp-reopen')
      expect(retrieved).toBeDefined()
      expect(retrieved!.id).toBe('insp-reopen')
    })
  })

  // ─── Transaction Support ─────────────────────────────────────────────────

  describe('Transaction Support', () => {
    it('should support transactions across multiple tables', async () => {
      await testDb.transaction('rw', [testDb.inspections, testDb.deficiencies], async () => {
        await testDb.inspections.add(createTestInspection({ id: 'insp-tx' }))
        await testDb.deficiencies.add(
          createTestDeficiency({
            id: 'def-tx',
            inspectionId: 'insp-tx',
          }),
        )
      })

      const inspection = await testDb.inspections.get('insp-tx')
      const deficiency = await testDb.deficiencies.get('def-tx')

      expect(inspection).toBeDefined()
      expect(deficiency).toBeDefined()
      expect(deficiency!.inspectionId).toBe('insp-tx')
    })

    it('should rollback transaction on error', async () => {
      try {
        await testDb.transaction('rw', [testDb.inspections, testDb.deficiencies], async () => {
          await testDb.inspections.add(createTestInspection({ id: 'insp-rollback' }))
          // This should cause an error (duplicate key)
          await testDb.inspections.add(createTestInspection({ id: 'insp-rollback' }))
        })
      } catch {
        // Expected error
      }

      // The first insert should have been rolled back
      const inspection = await testDb.inspections.get('insp-rollback')
      expect(inspection).toBeUndefined()
    })
  })

  // ─── Bulk Operations ─────────────────────────────────────────────────────

  describe('Bulk Operations', () => {
    it('should support bulk add', async () => {
      const inspections = Array.from({ length: 50 }, (_, i) =>
        createTestInspection({ id: `insp-bulk-${i}` }),
      )

      await testDb.inspections.bulkAdd(inspections)

      const count = await testDb.inspections.count()
      expect(count).toBe(50)
    })

    it('should support bulk put (upsert)', async () => {
      // Add initial data
      await testDb.inspections.add(createTestInspection({ id: 'insp-upsert', status: 'SCHEDULED' }))

      // Upsert with updated status
      await testDb.inspections.bulkPut([
        createTestInspection({ id: 'insp-upsert', status: 'IN_PROGRESS' }),
        createTestInspection({ id: 'insp-new', status: 'SCHEDULED' }),
      ])

      const updated = await testDb.inspections.get('insp-upsert')
      const newRecord = await testDb.inspections.get('insp-new')

      expect(updated!.status).toBe('IN_PROGRESS')
      expect(newRecord).toBeDefined()
    })

    it('should support bulk delete', async () => {
      await testDb.inspections.bulkAdd([
        createTestInspection({ id: 'insp-del-1' }),
        createTestInspection({ id: 'insp-del-2' }),
        createTestInspection({ id: 'insp-del-3' }),
      ])

      await testDb.inspections.bulkDelete(['insp-del-1', 'insp-del-3'])

      const remaining = await testDb.inspections.toArray()
      expect(remaining.length).toBe(1)
      expect(remaining[0].id).toBe('insp-del-2')
    })
  })
})
