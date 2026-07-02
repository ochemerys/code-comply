import { describe, it, expect, beforeEach, vi } from 'vitest'
import { conflictResolverService, ConflictResolverService } from './conflict-resolver'
import { prisma as db } from '@codecomply/db'

// Mock Prisma client
vi.mock('@codecomply/db', () => ({
  prisma: {
    permitInspection: {
      findUnique: vi.fn(),
    },
    deficiency: {
      findUnique: vi.fn(),
    },
    syncConflict: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

describe('ConflictResolverService', () => {
  let service: ConflictResolverService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ConflictResolverService()
  })

  describe('detectConflict', () => {
    it('should return false when no client ETag is provided', async () => {
      const hasConflict = await service.detectConflict('inspection', 'insp-123')

      expect(hasConflict).toBe(false)
    })

    it('should return false when ETags match', async () => {
      vi.mocked(db.permitInspection.findUnique).mockResolvedValue({
        id: 'insp-123',
        etag: 'etag-456',
      } as any)

      const hasConflict = await service.detectConflict('inspection', 'insp-123', 'etag-456')

      expect(hasConflict).toBe(false)
      expect(db.permitInspection.findUnique).toHaveBeenCalledWith({
        where: { id: 'insp-123' },
        select: { etag: true },
      })
    })

    it('should return true when ETags do not match', async () => {
      vi.mocked(db.permitInspection.findUnique).mockResolvedValue({
        id: 'insp-123',
        etag: 'etag-456',
      } as any)

      const hasConflict = await service.detectConflict('inspection', 'insp-123', 'etag-789')

      expect(hasConflict).toBe(true)
    })

    it('should detect conflict for deficiency entity', async () => {
      vi.mocked(db.deficiency.findUnique).mockResolvedValue({
        id: 'def-123',
        etag: 'etag-456',
      } as any)

      const hasConflict = await service.detectConflict('deficiency', 'def-123', 'etag-789')

      expect(hasConflict).toBe(true)
      expect(db.deficiency.findUnique).toHaveBeenCalledWith({
        where: { id: 'def-123' },
        select: { etag: true },
      })
    })

    it('should return false when entity not found', async () => {
      vi.mocked(db.permitInspection.findUnique).mockResolvedValue(null)

      const hasConflict = await service.detectConflict('inspection', 'non-existent', 'etag-123')

      expect(hasConflict).toBe(false)
    })

    it('should throw error for unsupported entity type', async () => {
      await expect(service.detectConflict('unknown_entity', 'id-123', 'etag-456')).rejects.toThrow(
        'Unsupported entity type: unknown_entity',
      )
    })
  })

  describe('logConflict', () => {
    it('should log conflict with FIELD_WINS resolution for inspection data', async () => {
      const mockConflict = {
        id: 'conflict-123',
        entityType: 'inspection',
        entityId: 'insp-456',
        clientVersion: { status: 'COMPLETED' },
        serverVersion: { status: 'IN_PROGRESS' },
        resolution: 'FIELD_WINS',
        resolvedAt: new Date('2024-01-15T10:00:00Z'),
      }

      vi.mocked(db.syncConflict.create).mockResolvedValue(mockConflict as any)

      const result = await service.logConflict({
        entityType: 'inspection',
        entityId: 'insp-456',
        clientVersion: { status: 'COMPLETED' },
        serverVersion: { status: 'IN_PROGRESS' },
      })

      expect(result).toEqual({
        id: 'conflict-123',
        entityType: 'inspection',
        entityId: 'insp-456',
        clientVersion: { status: 'COMPLETED' },
        serverVersion: { status: 'IN_PROGRESS' },
        resolution: 'FIELD_WINS',
        resolvedAt: new Date('2024-01-15T10:00:00Z'),
      })

      expect(db.syncConflict.create).toHaveBeenCalledWith({
        data: {
          entityType: 'inspection',
          entityId: 'insp-456',
          clientVersion: { status: 'COMPLETED' },
          serverVersion: { status: 'IN_PROGRESS' },
          resolution: 'FIELD_WINS',
          resolvedAt: expect.any(Date),
        },
      })
    })

    it('should log conflict with SERVER_WINS resolution for permit metadata', async () => {
      const mockConflict = {
        id: 'conflict-456',
        entityType: 'permit',
        entityId: 'permit-789',
        clientVersion: { address: 'Old Address' },
        serverVersion: { address: 'New Address' },
        resolution: 'SERVER_WINS',
        resolvedAt: new Date('2024-01-15T10:00:00Z'),
      }

      vi.mocked(db.syncConflict.create).mockResolvedValue(mockConflict as any)

      const result = await service.logConflict({
        entityType: 'permit',
        entityId: 'permit-789',
        clientVersion: { address: 'Old Address' },
        serverVersion: { address: 'New Address' },
      })

      expect(result.resolution).toBe('SERVER_WINS')
    })

    it('should log conflict with SERVER_WINS resolution for user data', async () => {
      const mockConflict = {
        id: 'conflict-789',
        entityType: 'user',
        entityId: 'user-101',
        clientVersion: { name: 'Old Name' },
        serverVersion: { name: 'New Name' },
        resolution: 'SERVER_WINS',
        resolvedAt: new Date('2024-01-15T10:00:00Z'),
      }

      vi.mocked(db.syncConflict.create).mockResolvedValue(mockConflict as any)

      const result = await service.logConflict({
        entityType: 'user',
        entityId: 'user-101',
        clientVersion: { name: 'Old Name' },
        serverVersion: { name: 'New Name' },
      })

      expect(result.resolution).toBe('SERVER_WINS')
    })

    it('should log conflict with FIELD_WINS resolution for deficiency data', async () => {
      const mockConflict = {
        id: 'conflict-202',
        entityType: 'deficiency',
        entityId: 'def-303',
        clientVersion: { description: 'Field description' },
        serverVersion: { description: 'Server description' },
        resolution: 'FIELD_WINS',
        resolvedAt: new Date('2024-01-15T10:00:00Z'),
      }

      vi.mocked(db.syncConflict.create).mockResolvedValue(mockConflict as any)

      const result = await service.logConflict({
        entityType: 'deficiency',
        entityId: 'def-303',
        clientVersion: { description: 'Field description' },
        serverVersion: { description: 'Server description' },
      })

      expect(result.resolution).toBe('FIELD_WINS')
    })
  })

  describe('resolveConflict', () => {
    it('should return client version when field data wins (inspection)', async () => {
      const mockConflict = {
        id: 'conflict-123',
        entityType: 'inspection',
        entityId: 'insp-456',
        clientVersion: { status: 'COMPLETED' },
        serverVersion: { status: 'IN_PROGRESS' },
        resolution: 'FIELD_WINS',
        resolvedAt: new Date(),
      }

      vi.mocked(db.syncConflict.create).mockResolvedValue(mockConflict as any)

      const result = await service.resolveConflict({
        entityType: 'inspection',
        entityId: 'insp-456',
        clientVersion: { status: 'COMPLETED' },
        serverVersion: { status: 'IN_PROGRESS' },
      })

      expect(result).toEqual({ status: 'COMPLETED' })
    })

    it('should return server version when server data wins (permit)', async () => {
      const mockConflict = {
        id: 'conflict-456',
        entityType: 'permit',
        entityId: 'permit-789',
        clientVersion: { address: 'Old Address' },
        serverVersion: { address: 'New Address' },
        resolution: 'SERVER_WINS',
        resolvedAt: new Date(),
      }

      vi.mocked(db.syncConflict.create).mockResolvedValue(mockConflict as any)

      const result = await service.resolveConflict({
        entityType: 'permit',
        entityId: 'permit-789',
        clientVersion: { address: 'Old Address' },
        serverVersion: { address: 'New Address' },
      })

      expect(result).toEqual({ address: 'New Address' })
    })

    it('should return server version when server data wins (user)', async () => {
      const mockConflict = {
        id: 'conflict-789',
        entityType: 'user',
        entityId: 'user-101',
        clientVersion: { name: 'Old Name' },
        serverVersion: { name: 'New Name' },
        resolution: 'SERVER_WINS',
        resolvedAt: new Date(),
      }

      vi.mocked(db.syncConflict.create).mockResolvedValue(mockConflict as any)

      const result = await service.resolveConflict({
        entityType: 'user',
        entityId: 'user-101',
        clientVersion: { name: 'Old Name' },
        serverVersion: { name: 'New Name' },
      })

      expect(result).toEqual({ name: 'New Name' })
    })

    it('should throw error for unknown entity type requiring manual resolution', async () => {
      const mockConflict = {
        id: 'conflict-999',
        entityType: 'unknown_entity',
        entityId: 'unknown-123',
        clientVersion: { data: 'client' },
        serverVersion: { data: 'server' },
        resolution: 'MANUAL_REQUIRED',
        resolvedAt: new Date(),
      }

      vi.mocked(db.syncConflict.create).mockResolvedValue(mockConflict as any)

      await expect(
        service.resolveConflict({
          entityType: 'unknown_entity',
          entityId: 'unknown-123',
          clientVersion: { data: 'client' },
          serverVersion: { data: 'server' },
        }),
      ).rejects.toThrow('Manual conflict resolution required for unknown_entity/unknown-123')
    })

    it('should log conflict before resolving', async () => {
      const mockConflict = {
        id: 'conflict-123',
        entityType: 'inspection',
        entityId: 'insp-456',
        clientVersion: { status: 'COMPLETED' },
        serverVersion: { status: 'IN_PROGRESS' },
        resolution: 'FIELD_WINS',
        resolvedAt: new Date(),
      }

      vi.mocked(db.syncConflict.create).mockResolvedValue(mockConflict as any)

      await service.resolveConflict({
        entityType: 'inspection',
        entityId: 'insp-456',
        clientVersion: { status: 'COMPLETED' },
        serverVersion: { status: 'IN_PROGRESS' },
      })

      expect(db.syncConflict.create).toHaveBeenCalled()
    })
  })

  describe('getConflictsByEntity', () => {
    it('should return all conflicts for a specific entity', async () => {
      const mockConflicts = [
        {
          id: 'conflict-1',
          entityType: 'inspection',
          entityId: 'insp-123',
          clientVersion: { status: 'COMPLETED' },
          serverVersion: { status: 'IN_PROGRESS' },
          resolution: 'FIELD_WINS',
          resolvedAt: new Date('2024-01-15T10:00:00Z'),
        },
        {
          id: 'conflict-2',
          entityType: 'inspection',
          entityId: 'insp-123',
          clientVersion: { notes: 'Field notes' },
          serverVersion: { notes: 'Server notes' },
          resolution: 'FIELD_WINS',
          resolvedAt: new Date('2024-01-14T10:00:00Z'),
        },
      ]

      vi.mocked(db.syncConflict.findMany).mockResolvedValue(mockConflicts as any)

      const result = await service.getConflictsByEntity('inspection', 'insp-123')

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('conflict-1')
      expect(result[1].id).toBe('conflict-2')
      expect(db.syncConflict.findMany).toHaveBeenCalledWith({
        where: {
          entityType: 'inspection',
          entityId: 'insp-123',
        },
        orderBy: {
          resolvedAt: 'desc',
        },
      })
    })

    it('should return empty array when no conflicts found', async () => {
      vi.mocked(db.syncConflict.findMany).mockResolvedValue([])

      const result = await service.getConflictsByEntity('inspection', 'insp-999')

      expect(result).toEqual([])
    })
  })

  describe('getAllConflicts', () => {
    it('should return all conflicts without filters', async () => {
      const mockConflicts = [
        {
          id: 'conflict-1',
          entityType: 'inspection',
          entityId: 'insp-123',
          clientVersion: {},
          serverVersion: {},
          resolution: 'FIELD_WINS',
          resolvedAt: new Date('2024-01-15T10:00:00Z'),
        },
        {
          id: 'conflict-2',
          entityType: 'permit',
          entityId: 'permit-456',
          clientVersion: {},
          serverVersion: {},
          resolution: 'SERVER_WINS',
          resolvedAt: new Date('2024-01-14T10:00:00Z'),
        },
      ]

      vi.mocked(db.syncConflict.findMany).mockResolvedValue(mockConflicts as any)

      const result = await service.getAllConflicts()

      expect(result).toHaveLength(2)
      expect(db.syncConflict.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: {
          resolvedAt: 'desc',
        },
        take: 100,
      })
    })

    it('should filter conflicts by entity type', async () => {
      const mockConflicts = [
        {
          id: 'conflict-1',
          entityType: 'inspection',
          entityId: 'insp-123',
          clientVersion: {},
          serverVersion: {},
          resolution: 'FIELD_WINS',
          resolvedAt: new Date(),
        },
      ]

      vi.mocked(db.syncConflict.findMany).mockResolvedValue(mockConflicts as any)

      await service.getAllConflicts({ entityType: 'inspection' })

      expect(db.syncConflict.findMany).toHaveBeenCalledWith({
        where: {
          entityType: 'inspection',
        },
        orderBy: {
          resolvedAt: 'desc',
        },
        take: 100,
      })
    })

    it('should filter conflicts by resolution', async () => {
      const mockConflicts = [
        {
          id: 'conflict-1',
          entityType: 'inspection',
          entityId: 'insp-123',
          clientVersion: {},
          serverVersion: {},
          resolution: 'FIELD_WINS',
          resolvedAt: new Date(),
        },
      ]

      vi.mocked(db.syncConflict.findMany).mockResolvedValue(mockConflicts as any)

      await service.getAllConflicts({ resolution: 'FIELD_WINS' })

      expect(db.syncConflict.findMany).toHaveBeenCalledWith({
        where: {
          resolution: 'FIELD_WINS',
        },
        orderBy: {
          resolvedAt: 'desc',
        },
        take: 100,
      })
    })

    it('should filter conflicts by date range', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      vi.mocked(db.syncConflict.findMany).mockResolvedValue([])

      await service.getAllConflicts({ startDate, endDate })

      expect(db.syncConflict.findMany).toHaveBeenCalledWith({
        where: {
          resolvedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: {
          resolvedAt: 'desc',
        },
        take: 100,
      })
    })

    it('should apply multiple filters', async () => {
      const startDate = new Date('2024-01-01')

      vi.mocked(db.syncConflict.findMany).mockResolvedValue([])

      await service.getAllConflicts({
        entityType: 'inspection',
        resolution: 'FIELD_WINS',
        startDate,
      })

      expect(db.syncConflict.findMany).toHaveBeenCalledWith({
        where: {
          entityType: 'inspection',
          resolution: 'FIELD_WINS',
          resolvedAt: {
            gte: startDate,
          },
        },
        orderBy: {
          resolvedAt: 'desc',
        },
        take: 100,
      })
    })
  })

  describe('getConflictStats', () => {
    it('should return conflict statistics', async () => {
      const mockConflicts = [
        { resolution: 'FIELD_WINS', entityType: 'inspection' },
        { resolution: 'FIELD_WINS', entityType: 'inspection' },
        { resolution: 'SERVER_WINS', entityType: 'permit' },
        { resolution: 'FIELD_WINS', entityType: 'deficiency' },
        { resolution: 'SERVER_WINS', entityType: 'user' },
      ]

      vi.mocked(db.syncConflict.findMany).mockResolvedValue(mockConflicts as any)

      const result = await service.getConflictStats()

      expect(result.total).toBe(5)
      expect(result.byResolution).toEqual({
        FIELD_WINS: 3,
        SERVER_WINS: 2,
      })
      expect(result.byEntityType).toEqual({
        inspection: 2,
        permit: 1,
        deficiency: 1,
        user: 1,
      })
    })

    it('should return zero stats when no conflicts exist', async () => {
      vi.mocked(db.syncConflict.findMany).mockResolvedValue([])

      const result = await service.getConflictStats()

      expect(result.total).toBe(0)
      expect(result.byResolution).toEqual({})
      expect(result.byEntityType).toEqual({})
    })
  })

  describe('resolution strategy', () => {
    it('should use FIELD_WINS for inspection data', async () => {
      const mockConflict = {
        id: 'conflict-1',
        entityType: 'inspection',
        entityId: 'insp-123',
        clientVersion: {},
        serverVersion: {},
        resolution: 'FIELD_WINS',
        resolvedAt: new Date(),
      }

      vi.mocked(db.syncConflict.create).mockResolvedValue(mockConflict as any)

      const result = await service.logConflict({
        entityType: 'inspection',
        entityId: 'insp-123',
        clientVersion: {},
        serverVersion: {},
      })

      expect(result.resolution).toBe('FIELD_WINS')
    })

    it('should use FIELD_WINS for checklist response data', async () => {
      const mockConflict = {
        id: 'conflict-2',
        entityType: 'checklist_response',
        entityId: 'resp-123',
        clientVersion: {},
        serverVersion: {},
        resolution: 'FIELD_WINS',
        resolvedAt: new Date(),
      }

      vi.mocked(db.syncConflict.create).mockResolvedValue(mockConflict as any)

      const result = await service.logConflict({
        entityType: 'checklist_response',
        entityId: 'resp-123',
        clientVersion: {},
        serverVersion: {},
      })

      expect(result.resolution).toBe('FIELD_WINS')
    })

    it('should use FIELD_WINS for photo data', async () => {
      const mockConflict = {
        id: 'conflict-3',
        entityType: 'photo',
        entityId: 'photo-123',
        clientVersion: {},
        serverVersion: {},
        resolution: 'FIELD_WINS',
        resolvedAt: new Date(),
      }

      vi.mocked(db.syncConflict.create).mockResolvedValue(mockConflict as any)

      const result = await service.logConflict({
        entityType: 'photo',
        entityId: 'photo-123',
        clientVersion: {},
        serverVersion: {},
      })

      expect(result.resolution).toBe('FIELD_WINS')
    })

    it('should use SERVER_WINS for permit metadata', async () => {
      const mockConflict = {
        id: 'conflict-4',
        entityType: 'permit_metadata',
        entityId: 'permit-123',
        clientVersion: {},
        serverVersion: {},
        resolution: 'SERVER_WINS',
        resolvedAt: new Date(),
      }

      vi.mocked(db.syncConflict.create).mockResolvedValue(mockConflict as any)

      const result = await service.logConflict({
        entityType: 'permit_metadata',
        entityId: 'permit-123',
        clientVersion: {},
        serverVersion: {},
      })

      expect(result.resolution).toBe('SERVER_WINS')
    })

    it('should use SERVER_WINS for checklist template', async () => {
      const mockConflict = {
        id: 'conflict-5',
        entityType: 'checklist_template',
        entityId: 'template-123',
        clientVersion: {},
        serverVersion: {},
        resolution: 'SERVER_WINS',
        resolvedAt: new Date(),
      }

      vi.mocked(db.syncConflict.create).mockResolvedValue(mockConflict as any)

      const result = await service.logConflict({
        entityType: 'checklist_template',
        entityId: 'template-123',
        clientVersion: {},
        serverVersion: {},
      })

      expect(result.resolution).toBe('SERVER_WINS')
    })

    it('should use SERVER_WINS for certification data', async () => {
      const mockConflict = {
        id: 'conflict-6',
        entityType: 'certification',
        entityId: 'cert-123',
        clientVersion: {},
        serverVersion: {},
        resolution: 'SERVER_WINS',
        resolvedAt: new Date(),
      }

      vi.mocked(db.syncConflict.create).mockResolvedValue(mockConflict as any)

      const result = await service.logConflict({
        entityType: 'certification',
        entityId: 'cert-123',
        clientVersion: {},
        serverVersion: {},
      })

      expect(result.resolution).toBe('SERVER_WINS')
    })
  })
})
