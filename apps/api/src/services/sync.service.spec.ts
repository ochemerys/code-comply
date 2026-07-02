import { describe, it, expect, beforeEach, vi } from 'vitest'
import { syncService } from './sync.service'
import { prisma } from '@codecomply/db'
import type { SyncMutation } from '@codecomply/validators'

vi.mock('./distribution.service.js', () => ({
  distributionService: {
    onSyncPushComplete: vi.fn().mockResolvedValue([]),
  },
}))

// Mock Prisma client — $transaction passes same delegates so tx.deficiency.* uses shared mocks
vi.mock('@codecomply/db', () => {
  const prismaMock = {
    deficiency: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    permitInspection: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    },
    $transaction: vi.fn(async (fn: (tx: any) => unknown) => fn(prismaMock)),
  }
  return { prisma: prismaMock }
})

describe('SyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('processPushMutations', () => {
    it('should process batch of mutations successfully', async () => {
      const mutations: SyncMutation[] = [
        {
          clientId: 'client-123',
          entity: 'deficiency',
          operation: 'create',
          payload: {
            inspectionId: 'insp-456',
            description: 'Test deficiency 1',
            severity: 'MAJOR',
          },
          timestamp: new Date().toISOString(),
        },
        {
          clientId: 'client-456',
          entity: 'deficiency',
          operation: 'create',
          payload: {
            inspectionId: 'insp-456',
            description: 'Test deficiency 2',
            severity: 'MINOR',
          },
          timestamp: new Date().toISOString(),
        },
      ]

      const mockInspection = {
        id: 'insp-456',
        schedule: { assignedToId: 'user-789' },
      }

      const mockDeficiency1 = {
        id: 'def-111',
        clientId: 'client-123',
        inspectionId: 'insp-456',
        description: 'Test deficiency 1',
        severity: 'MAJOR',
        status: 'OPEN',
      }

      const mockDeficiency2 = {
        id: 'def-222',
        clientId: 'client-456',
        inspectionId: 'insp-456',
        description: 'Test deficiency 2',
        severity: 'MINOR',
        status: 'OPEN',
      }

      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(mockInspection as any)
      vi.mocked(prisma.deficiency.create)
        .mockResolvedValueOnce(mockDeficiency1 as any)
        .mockResolvedValueOnce(mockDeficiency2 as any)

      const results = await syncService.processPushMutations(mutations, 'user-789')

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(true)
      expect(results[0].serverId).toBe('def-111')
      expect(results[1].success).toBe(true)
      expect(results[1].serverId).toBe('def-222')
    })

    it('should handle errors gracefully and continue processing', async () => {
      const mutations: SyncMutation[] = [
        {
          clientId: 'client-123',
          entity: 'deficiency',
          operation: 'create',
          payload: {
            inspectionId: 'insp-456',
            description: 'Test deficiency 1',
            severity: 'MAJOR',
          },
          timestamp: new Date().toISOString(),
        },
        {
          clientId: 'client-456',
          entity: 'deficiency',
          operation: 'create',
          payload: {
            inspectionId: 'insp-999', // Will fail
            description: 'Test deficiency 2',
            severity: 'MINOR',
          },
          timestamp: new Date().toISOString(),
        },
      ]

      const mockInspection = {
        id: 'insp-456',
        schedule: { assignedToId: 'user-789' },
      }

      const mockDeficiency = {
        id: 'def-111',
        clientId: 'client-123',
      }

      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.permitInspection.findUnique)
        .mockResolvedValueOnce(mockInspection as any)
        .mockResolvedValueOnce(null) // Second inspection not found
      vi.mocked(prisma.deficiency.create).mockResolvedValue(mockDeficiency as any)

      const results = await syncService.processPushMutations(mutations, 'user-789')

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
      expect(results[1].error).toBe('Inspection not found')
    })
  })

  describe('processDeficiencyMutation - create', () => {
    it('should create new deficiency', async () => {
      const mockInspection = {
        id: 'insp-456',
        schedule: { assignedToId: 'user-789' },
      }

      const mockDeficiency = {
        id: 'def-111',
        clientId: 'client-123',
        inspectionId: 'insp-456',
        description: 'Test deficiency',
        severity: 'MAJOR',
        status: 'OPEN',
      }

      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(mockInspection as any)
      vi.mocked(prisma.deficiency.create).mockResolvedValue(mockDeficiency as any)

      const mutation: SyncMutation = {
        clientId: 'client-123',
        entity: 'deficiency',
        operation: 'create',
        payload: {
          inspectionId: 'insp-456',
          description: 'Test deficiency',
          severity: 'MAJOR',
          location: 'Room 101',
        },
        timestamp: new Date().toISOString(),
      }

      const results = await syncService.processPushMutations([mutation], 'user-789')

      expect(results[0].success).toBe(true)
      expect(results[0].serverId).toBe('def-111')
      expect(prisma.deficiency.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clientId: 'client-123',
          inspectionId: 'insp-456',
          description: 'Test deficiency',
          severity: 'MAJOR',
          location: 'Room 101',
          status: 'OPEN',
          createdById: 'user-789',
        }),
      })
    })

    it('should return existing deficiency if clientId exists (deduplication)', async () => {
      const existingDeficiency = {
        id: 'def-111',
        clientId: 'client-123',
      }

      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue(existingDeficiency as any)

      const mutation: SyncMutation = {
        clientId: 'client-123',
        entity: 'deficiency',
        operation: 'create',
        payload: {
          inspectionId: 'insp-456',
          description: 'Test deficiency',
          severity: 'MAJOR',
        },
        timestamp: new Date().toISOString(),
      }

      const results = await syncService.processPushMutations([mutation], 'user-789')

      expect(results[0].success).toBe(true)
      expect(results[0].serverId).toBe('def-111')
      expect(prisma.deficiency.create).not.toHaveBeenCalled()
    })

    it('should throw error if inspection not found', async () => {
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(null)

      const mutation: SyncMutation = {
        clientId: 'client-123',
        entity: 'deficiency',
        operation: 'create',
        payload: {
          inspectionId: 'insp-999',
          description: 'Test deficiency',
          severity: 'MAJOR',
        },
        timestamp: new Date().toISOString(),
      }

      const results = await syncService.processPushMutations([mutation], 'user-789')

      expect(results[0].success).toBe(false)
      expect(results[0].error).toBe('Inspection not found')
    })

    it('should throw error if user not assigned to inspection', async () => {
      const mockInspection = {
        id: 'insp-456',
        schedule: { assignedToId: 'other-user' },
      }

      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(mockInspection as any)

      const mutation: SyncMutation = {
        clientId: 'client-123',
        entity: 'deficiency',
        operation: 'create',
        payload: {
          inspectionId: 'insp-456',
          description: 'Test deficiency',
          severity: 'MAJOR',
        },
        timestamp: new Date().toISOString(),
      }

      const results = await syncService.processPushMutations([mutation], 'user-789')

      expect(results[0].success).toBe(false)
      expect(results[0].error).toBe('User not assigned to this inspection')
    })
  })

  describe('processDeficiencyMutation - update', () => {
    it('should update existing deficiency', async () => {
      const existingDeficiency = {
        id: 'def-111',
        clientId: 'client-123',
        inspectionId: 'insp-456',
        description: 'Old',
        severity: 'MAJOR',
        status: 'OPEN',
        etag: 'etag-old',
      }

      const updatedDeficiency = {
        id: 'def-111',
        clientId: 'client-123',
        inspectionId: 'insp-456',
        description: 'Updated description',
        severity: 'CRITICAL',
        status: 'OPEN',
        etag: 'etag-new',
      }

      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue(existingDeficiency as any)
      vi.mocked(prisma.deficiency.update).mockResolvedValue(updatedDeficiency as any)

      const mutation: SyncMutation = {
        clientId: 'client-123',
        entity: 'deficiency',
        operation: 'update',
        payload: {
          description: 'Updated description',
          severity: 'CRITICAL',
          etag: 'etag-old',
        },
        timestamp: new Date().toISOString(),
      }

      const results = await syncService.processPushMutations([mutation], 'user-789')

      expect(results[0].success).toBe(true)
      expect(results[0].serverId).toBe('def-111')
      expect(prisma.deficiency.update).toHaveBeenCalledWith({
        where: { id: 'def-111' },
        data: expect.objectContaining({
          description: 'Updated description',
          severity: 'CRITICAL',
        }),
      })
    })

    it('should detect conflict if etag mismatch', async () => {
      const existingDeficiency = {
        id: 'def-111',
        clientId: 'client-123',
        etag: 'etag-current',
      }

      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue(existingDeficiency as any)

      const mutation: SyncMutation = {
        clientId: 'client-123',
        entity: 'deficiency',
        operation: 'update',
        payload: {
          description: 'Updated description',
          etag: 'etag-old', // Mismatch
        },
        timestamp: new Date().toISOString(),
      }

      const results = await syncService.processPushMutations([mutation], 'user-789')

      expect(results[0].success).toBe(false)
      expect(results[0].conflict).toBe(true)
      expect(results[0].error).toBe('Conflict: Resource has been modified')
      expect(prisma.deficiency.update).not.toHaveBeenCalled()
    })

    it('should throw error if deficiency not found', async () => {
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue(null)

      const mutation: SyncMutation = {
        clientId: 'client-123',
        entity: 'deficiency',
        operation: 'update',
        payload: {
          description: 'Updated description',
        },
        timestamp: new Date().toISOString(),
      }

      const results = await syncService.processPushMutations([mutation], 'user-789')

      expect(results[0].success).toBe(false)
      expect(results[0].error).toBe('Deficiency not found')
    })
  })

  describe('processDeficiencyMutation - delete', () => {
    it('should soft delete deficiency', async () => {
      const existingDeficiency = {
        id: 'def-111',
        clientId: 'client-123',
        inspectionId: 'insp-456',
        description: 'X',
        severity: 'MAJOR',
        status: 'OPEN',
      }

      const updatedDeficiency = {
        id: 'def-111',
        clientId: 'client-123',
        inspectionId: 'insp-456',
        description: 'X',
        severity: 'MAJOR',
        status: 'CLOSED',
      }

      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue(existingDeficiency as any)
      vi.mocked(prisma.deficiency.update).mockResolvedValue(updatedDeficiency as any)

      const mutation: SyncMutation = {
        clientId: 'client-123',
        entity: 'deficiency',
        operation: 'delete',
        payload: {},
        timestamp: new Date().toISOString(),
      }

      const results = await syncService.processPushMutations([mutation], 'user-789')

      expect(results[0].success).toBe(true)
      expect(results[0].serverId).toBe('def-111')
      expect(prisma.deficiency.update).toHaveBeenCalledWith({
        where: { id: 'def-111' },
        data: expect.objectContaining({
          status: 'CLOSED',
        }),
      })
    })

    it('should be idempotent if already deleted', async () => {
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue(null)

      const mutation: SyncMutation = {
        clientId: 'client-123',
        entity: 'deficiency',
        operation: 'delete',
        payload: {},
        timestamp: new Date().toISOString(),
      }

      const results = await syncService.processPushMutations([mutation], 'user-789')

      expect(results[0].success).toBe(true)
      expect(prisma.deficiency.update).not.toHaveBeenCalled()
    })
  })

  describe('getPullChanges', () => {
    it('should return changes since timestamp', async () => {
      const mockDeficiencies = [
        {
          id: 'def-111',
          clientId: 'client-123',
          inspectionId: 'insp-456',
          description: 'Test 1',
          severity: 'MAJOR',
          status: 'OPEN',
          location: null,
          codeReference: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
          syncedAt: new Date('2024-01-02'),
          etag: 'etag-1',
          inspection: { id: 'insp-456' },
        },
        {
          id: 'def-222',
          clientId: 'client-456',
          inspectionId: 'insp-456',
          description: 'Test 2',
          severity: 'MINOR',
          status: 'OPEN',
          location: null,
          codeReference: null,
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-04'),
          syncedAt: new Date('2024-01-04'),
          etag: 'etag-2',
          inspection: { id: 'insp-456' },
        },
      ]

      vi.mocked(prisma.deficiency.findMany).mockResolvedValue(mockDeficiencies as any)

      const since = new Date('2024-01-01')
      const result = await syncService.getPullChanges(since, 100, 'user-789')

      expect(result.changes).toHaveLength(2)
      expect(result.changes[0].id).toBe('def-111')
      expect(result.changes[0].entity).toBe('deficiency')
      expect(result.changes[0].operation).toBe('update')
      expect(result.changes[1].id).toBe('def-222')
      expect(result.hasMore).toBe(false)
    })

    it('should return all changes if since is null', async () => {
      const mockDeficiencies = [
        {
          id: 'def-111',
          clientId: 'client-123',
          inspectionId: 'insp-456',
          description: 'Test 1',
          severity: 'MAJOR',
          status: 'OPEN',
          location: null,
          codeReference: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
          syncedAt: new Date('2024-01-02'),
          etag: 'etag-1',
          inspection: { id: 'insp-456' },
        },
      ]

      vi.mocked(prisma.deficiency.findMany).mockResolvedValue(mockDeficiencies as any)

      const result = await syncService.getPullChanges(null, 100, 'user-789')

      expect(result.changes).toHaveLength(1)
      expect(prisma.deficiency.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          inspection: {
            schedule: {
              assignedToId: 'user-789',
            },
          },
        }),
        include: { inspection: true },
        orderBy: { syncedAt: 'asc' },
        take: 101, // Fetch limit + 1 to check if there are more records
      })
    })

    it('should indicate hasMore if results exceed limit', async () => {
      const mockDeficiencies = Array.from({ length: 101 }, (_, i) => ({
        id: `def-${i}`,
        clientId: `client-${i}`,
        inspectionId: 'insp-456',
        description: `Test ${i}`,
        severity: 'MAJOR',
        status: 'OPEN',
        location: null,
        codeReference: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        syncedAt: new Date('2024-01-02'),
        etag: `etag-${i}`,
        inspection: { id: 'insp-456' },
      }))

      vi.mocked(prisma.deficiency.findMany).mockResolvedValue(mockDeficiencies as any)

      const result = await syncService.getPullChanges(null, 100, 'user-789')

      expect(result.changes).toHaveLength(100)
      expect(result.hasMore).toBe(true)
    })

    it('should return empty array if no changes', async () => {
      vi.mocked(prisma.deficiency.findMany).mockResolvedValue([])

      const result = await syncService.getPullChanges(null, 100, 'user-789')

      expect(result.changes).toHaveLength(0)
      expect(result.hasMore).toBe(false)
    })
  })

  describe('unsupported entity types', () => {
    it('should reject invalid inspection workflow payloads', async () => {
      const mutation: SyncMutation = {
        clientId: 'client-123',
        entity: 'inspection',
        operation: 'create',
        payload: {},
        timestamp: new Date().toISOString(),
      }

      const results = await syncService.processPushMutations([mutation], 'user-789')

      expect(results[0].success).toBe(false)
      expect(results[0].error).toBe('Invalid inspection workflow payload')
    })

    it('should throw error for checklist mutations', async () => {
      const mutation: SyncMutation = {
        clientId: 'client-123',
        entity: 'checklist',
        operation: 'create',
        payload: {},
        timestamp: new Date().toISOString(),
      }

      const results = await syncService.processPushMutations([mutation], 'user-789')

      expect(results[0].success).toBe(false)
      expect(results[0].error).toBe('Checklist mutations not yet implemented')
    })

    it('should throw error for document mutations', async () => {
      const mutation: SyncMutation = {
        clientId: 'client-123',
        entity: 'document',
        operation: 'create',
        payload: {},
        timestamp: new Date().toISOString(),
      }

      const results = await syncService.processPushMutations([mutation], 'user-789')

      expect(results[0].success).toBe(false)
      expect(results[0].error).toBe('Document mutations not yet implemented')
    })
  })
})
