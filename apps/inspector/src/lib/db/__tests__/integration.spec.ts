/**
 * Integration tests for the offline data layer
 *
 * Tests the interaction between the database, encryption, and data flow
 * to ensure the complete offline data layer works correctly.
 *
 * @see M3-S1 - Design Complete IndexedDB Schema with Dexie.js
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { InspectorDB } from '../dexie'
import { EncryptionService } from '../encryption'
import type { LocalInspection, SyncQueueItem } from '../types'

describe('Offline Data Layer Integration', () => {
  let testDb: InspectorDB
  let encryptionService: EncryptionService

  beforeEach(async () => {
    const dbName = `IntegrationTestDB-${Math.random().toString(36).substr(2, 9)}`
    testDb = new InspectorDB(dbName)
    await testDb.open()
    encryptionService = new EncryptionService('integration-test-key')
  })

  afterEach(async () => {
    if (testDb.isOpen()) {
      testDb.close()
    }
    await testDb.delete()
  })

  describe('Inspection with Encrypted Certification Snapshot', () => {
    it('should store and retrieve inspection with encrypted certification data', async () => {
      const certificationData = {
        inspectorId: 'user-123',
        name: 'Jane Smith',
        designation: 'SCO-2024-001',
        disciplines: ['Building', 'Fire'],
        expiryDate: '2025-12-31',
      }

      // Encrypt the certification snapshot
      const encryptedCert = encryptionService.encryptField(JSON.stringify(certificationData))

      const inspection: LocalInspection = {
        id: 'insp-encrypted',
        clientId: 'client-enc-1',
        permitId: 'permit-123',
        status: 'IN_PROGRESS',
        scheduledDate: '2024-03-15T09:00:00.000Z',
        assignedToId: 'user-123',
        certificationSnapshot: encryptedCert,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDirty: true,
      }

      await testDb.inspections.add(inspection)

      // Retrieve and decrypt
      const retrieved = await testDb.inspections.get('insp-encrypted')
      expect(retrieved).toBeDefined()
      expect(retrieved!.certificationSnapshot).not.toContain('Jane Smith')

      const decryptedCert = JSON.parse(
        encryptionService.decryptField(retrieved!.certificationSnapshot!),
      )
      expect(decryptedCert.name).toBe('Jane Smith')
      expect(decryptedCert.disciplines).toEqual(['Building', 'Fire'])
    })
  })

  describe('Inspection-Deficiency Relationship', () => {
    it('should link deficiencies to inspections via inspectionId', async () => {
      // Create inspection
      await testDb.inspections.add({
        id: 'insp-rel-1',
        clientId: 'client-rel-1',
        permitId: 'permit-123',
        status: 'IN_PROGRESS',
        scheduledDate: '2024-03-15T09:00:00.000Z',
        assignedToId: 'user-456',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDirty: false,
      })

      // Create deficiencies linked to the inspection
      await testDb.deficiencies.bulkAdd([
        {
          id: 'def-rel-1',
          clientId: 'client-def-1',
          inspectionId: 'insp-rel-1',
          createdById: 'user-456',
          description: 'Missing fire extinguisher',
          severity: 'MAJOR',
          status: 'OPEN',
          isStopWork: false,
          isUnsafe: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isDirty: true,
        },
        {
          id: 'def-rel-2',
          clientId: 'client-def-2',
          inspectionId: 'insp-rel-1',
          createdById: 'user-456',
          description: 'Exposed wiring',
          severity: 'CRITICAL',
          status: 'OPEN',
          isStopWork: true,
          isUnsafe: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isDirty: true,
        },
      ])

      // Query deficiencies for the inspection
      const deficiencies = await testDb.deficiencies
        .where('inspectionId')
        .equals('insp-rel-1')
        .toArray()

      expect(deficiencies.length).toBe(2)
      expect(deficiencies.some((d) => d.severity === 'CRITICAL')).toBe(true)
    })
  })

  describe('Checklist-Response Workflow', () => {
    it('should track checklist progress through responses', async () => {
      // Create checklist
      await testDb.checklists.add({
        id: 'cl-workflow',
        inspectionId: 'insp-123',
        templateId: 'tmpl-456',
        versionHash: 'hash-abc',
        templateName: 'Building Checklist',
        discipline: 'Building',
        items: [
          {
            id: 'item-1',
            description: 'Foundation',
            isRequired: true,
            requiresPhotoOnFail: true,
            order: 1,
          },
          {
            id: 'item-2',
            description: 'Framing',
            isRequired: true,
            requiresPhotoOnFail: false,
            order: 2,
          },
          {
            id: 'item-3',
            description: 'Insulation',
            isRequired: true,
            requiresPhotoOnFail: false,
            order: 3,
          },
        ],
        progress: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDirty: false,
      })

      // Add responses one by one
      await testDb.checklistResponses.add({
        id: 'resp-1',
        checklistId: 'cl-workflow',
        itemId: 'item-1',
        result: 'PASS',
        respondedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      await testDb.checklistResponses.add({
        id: 'resp-2',
        checklistId: 'cl-workflow',
        itemId: 'item-2',
        result: 'FAIL',
        codeReference: { code: 'NBC', section: '9.10.1' },
        respondedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      // Calculate progress
      const responses = await testDb.checklistResponses
        .where('checklistId')
        .equals('cl-workflow')
        .toArray()

      const checklist = await testDb.checklists.get('cl-workflow')
      const totalItems = checklist!.items.length
      const answeredItems = responses.length
      const progress = Math.round((answeredItems / totalItems) * 100)

      expect(progress).toBe(67) // 2 out of 3

      // Update checklist progress
      await testDb.checklists.update('cl-workflow', {
        progress,
        isDirty: true,
        updatedAt: new Date().toISOString(),
      })

      const updatedChecklist = await testDb.checklists.get('cl-workflow')
      expect(updatedChecklist!.progress).toBe(67)
      expect(updatedChecklist!.isDirty).toBe(true)
    })
  })

  describe('Sync Queue Workflow', () => {
    it('should queue offline mutations and process them in order', async () => {
      const now = Date.now()

      // Simulate offline mutations
      const mutations: SyncQueueItem[] = [
        {
          id: 'sync-1',
          clientId: 'client-1',
          operation: 'deficiency.create',
          payload: { description: 'First deficiency' },
          status: 'PENDING',
          attempts: 0,
          maxAttempts: 3,
          createdAt: new Date(now).toISOString(),
          priority: 1,
        },
        {
          id: 'sync-2',
          clientId: 'client-2',
          operation: 'photo.upload',
          payload: { photoId: 'photo-1' },
          status: 'PENDING',
          attempts: 0,
          maxAttempts: 3,
          createdAt: new Date(now + 1000).toISOString(),
          priority: 2, // Lower priority
        },
        {
          id: 'sync-3',
          clientId: 'client-3',
          operation: 'inspection.finalize',
          payload: { inspectionId: 'insp-1' },
          status: 'PENDING',
          attempts: 0,
          maxAttempts: 3,
          createdAt: new Date(now + 2000).toISOString(),
          priority: 0, // Highest priority
        },
      ]

      await testDb.syncQueue.bulkAdd(mutations)

      // Get items in processing order (by priority, then createdAt)
      const items = await testDb.getNextSyncItems(10)

      expect(items.length).toBe(3)
      expect(items[0].operation).toBe('inspection.finalize') // priority 0
      expect(items[1].operation).toBe('deficiency.create') // priority 1
      expect(items[2].operation).toBe('photo.upload') // priority 2

      // Simulate processing first item
      await testDb.syncQueue.update(items[0].id, {
        status: 'COMPLETED',
      })

      // Simulate failure on second item
      await testDb.syncQueue.update(items[1].id, {
        status: 'FAILED',
        attempts: 1,
        lastError: 'Network timeout',
        lastAttemptAt: new Date().toISOString(),
      })

      // Check remaining pending items
      const pendingCount = await testDb.getPendingSyncCount()
      expect(pendingCount).toBe(1) // Only the photo upload is still pending

      // Check failed item
      const failedItem = await testDb.syncQueue.get(items[1].id)
      expect(failedItem!.status).toBe('FAILED')
      expect(failedItem!.attempts).toBe(1)
      expect(failedItem!.lastError).toBe('Network timeout')
    })
  })

  describe('Photo-Deficiency Linking', () => {
    it('should link photos to deficiencies and inspections', async () => {
      // Create inspection
      await testDb.inspections.add({
        id: 'insp-photo',
        clientId: 'client-photo-insp',
        permitId: 'permit-123',
        status: 'IN_PROGRESS',
        scheduledDate: '2024-03-15T09:00:00.000Z',
        assignedToId: 'user-456',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDirty: false,
      })

      // Create deficiency
      await testDb.deficiencies.add({
        id: 'def-photo',
        clientId: 'client-photo-def',
        inspectionId: 'insp-photo',
        createdById: 'user-456',
        description: 'Cracked foundation',
        severity: 'CRITICAL',
        status: 'OPEN',
        isStopWork: false,
        isUnsafe: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDirty: true,
      })

      // Add photos linked to deficiency
      await testDb.photos.bulkAdd([
        {
          id: 'photo-1',
          clientId: 'client-photo-1',
          deficiencyId: 'def-photo',
          inspectionId: 'insp-photo',
          filename: 'crack-overview.jpg',
          mimeType: 'image/jpeg',
          size: 300000,
          metadata: {
            timestamp: new Date().toISOString(),
            latitude: 51.0447,
            longitude: -114.0719,
            inspectorId: 'user-456',
            permitNumber: 'P-2024-001',
            hasWatermark: false,
          },
          createdAt: new Date().toISOString(),
        },
        {
          id: 'photo-2',
          clientId: 'client-photo-2',
          deficiencyId: 'def-photo',
          inspectionId: 'insp-photo',
          filename: 'crack-closeup.jpg',
          mimeType: 'image/jpeg',
          size: 450000,
          metadata: {
            timestamp: new Date().toISOString(),
            latitude: 51.0447,
            longitude: -114.0719,
            inspectorId: 'user-456',
            permitNumber: 'P-2024-001',
            hasWatermark: true,
          },
          createdAt: new Date().toISOString(),
        },
      ])

      // Query photos for the deficiency
      const defPhotos = await testDb.photos.where('deficiencyId').equals('def-photo').toArray()

      expect(defPhotos.length).toBe(2)

      // Query all photos for the inspection
      const inspPhotos = await testDb.photos.where('inspectionId').equals('insp-photo').toArray()

      expect(inspPhotos.length).toBe(2)
    })
  })

  describe('Remote Wipe (clearAllData)', () => {
    it('should clear all data across all tables in a single transaction', async () => {
      // Populate all tables
      await testDb.inspections.add({
        id: 'insp-wipe',
        clientId: 'client-wipe-1',
        permitId: 'permit-123',
        status: 'IN_PROGRESS',
        scheduledDate: '2024-03-15T09:00:00.000Z',
        assignedToId: 'user-456',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDirty: false,
      })

      await testDb.deficiencies.add({
        id: 'def-wipe',
        clientId: 'client-wipe-2',
        inspectionId: 'insp-wipe',
        createdById: 'user-456',
        description: 'Test',
        severity: 'MINOR',
        status: 'OPEN',
        isStopWork: false,
        isUnsafe: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDirty: false,
      })

      await testDb.checklists.add({
        id: 'cl-wipe',
        inspectionId: 'insp-wipe',
        templateId: 'tmpl-1',
        versionHash: 'hash-1',
        templateName: 'Test',
        discipline: 'Building',
        items: [],
        progress: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDirty: false,
      })

      await testDb.checklistResponses.add({
        id: 'resp-wipe',
        checklistId: 'cl-wipe',
        itemId: 'item-1',
        result: 'PASS',
        respondedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      await testDb.photos.add({
        id: 'photo-wipe',
        clientId: 'client-wipe-3',
        inspectionId: 'insp-wipe',
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        size: 100,
        metadata: {
          timestamp: new Date().toISOString(),
          inspectorId: 'user-456',
          hasWatermark: false,
        },
        createdAt: new Date().toISOString(),
      })

      await testDb.syncQueue.add({
        id: 'sync-wipe',
        clientId: 'client-wipe-4',
        operation: 'deficiency.create',
        payload: {},
        status: 'PENDING',
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date().toISOString(),
        priority: 1,
      })

      await testDb.permits.add({
        id: 'permit-wipe',
        permitNumber: 'BP-2024-WIPE',
        address: '123 Wipe St',
        status: 'ACTIVE',
        updatedAt: new Date().toISOString(),
      })

      await testDb.checklistTemplateCache.put({
        templateId: 'tmpl-wipe',
        versionHash: 'hash-wipe',
        name: 'Wipe template',
        discipline: 'Building',
        version: 1,
        items: [{ id: 'i1', order: 1, text: 'Q' }],
        cachedAt: new Date().toISOString(),
      })

      // Verify data exists
      const countsBefore = await testDb.getTableCounts()
      expect(Object.values(countsBefore).every((c) => c > 0)).toBe(true)

      // Perform remote wipe
      await testDb.clearAllData()

      // Verify all data is gone
      const countsAfter = await testDb.getTableCounts()
      expect(Object.values(countsAfter).every((c) => c === 0)).toBe(true)
    })
  })

  describe('Dirty Record Tracking', () => {
    it('should track dirty records across tables', async () => {
      // Add mix of dirty and clean records
      await testDb.inspections.bulkAdd([
        {
          id: 'insp-dirty-1',
          clientId: 'c1',
          permitId: 'p1',
          status: 'IN_PROGRESS',
          scheduledDate: '2024-03-15T09:00:00.000Z',
          assignedToId: 'u1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isDirty: true,
        },
        {
          id: 'insp-clean-1',
          clientId: 'c2',
          permitId: 'p1',
          status: 'SCHEDULED',
          scheduledDate: '2024-03-15T09:00:00.000Z',
          assignedToId: 'u1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isDirty: false,
        },
      ])

      await testDb.deficiencies.bulkAdd([
        {
          id: 'def-dirty-1',
          clientId: 'c3',
          inspectionId: 'insp-dirty-1',
          createdById: 'u1',
          description: 'Test',
          severity: 'MINOR',
          status: 'OPEN',
          isStopWork: false,
          isUnsafe: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isDirty: true,
        },
        {
          id: 'def-dirty-2',
          clientId: 'c4',
          inspectionId: 'insp-dirty-1',
          createdById: 'u1',
          description: 'Test 2',
          severity: 'MAJOR',
          status: 'OPEN',
          isStopWork: false,
          isUnsafe: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isDirty: true,
        },
      ])

      // Dexie stores booleans as 0/1 in indexes
      const dirtyCount = await testDb.getDirtyRecordCount()
      expect(dirtyCount).toBe(3) // 1 inspection + 2 deficiencies
    })
  })
})
