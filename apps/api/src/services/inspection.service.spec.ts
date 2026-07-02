import { describe, it, expect, beforeEach, vi } from 'vitest'
import { inspectionService, type GPSCoordinates } from './inspection.service'
import { prisma, addendumDelegateOf } from '@codecomply/db'

const mockAddendum = () => addendumDelegateOf(prisma)

// Mock Prisma client — transactions reuse the same delegates as top-level prisma.*
vi.mock('@codecomply/db', () => {
  const prismaMock = {
    permitInspection: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    addendum: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    },
    $transaction: vi.fn(async (fn: (tx: any) => unknown) => fn(prismaMock)),
  }
  return {
    prisma: prismaMock,
    addendumDelegateOf: (client: unknown) => {
      const delegate = (client as { addendum?: typeof prismaMock.addendum }).addendum
      if (!delegate) throw new Error('Prisma addendum delegate missing')
      return delegate
    },
  }
})

describe('InspectionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getById', () => {
    it('should return inspection if user has access', async () => {
      const mockInspection = {
        id: 'insp-123',
        permitId: 'permit-456',
        status: 'SCHEDULED',
        scheduledDate: new Date('2024-02-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
        permit: {
          id: 'permit-456',
          permitNumber: 'P-2024-001',
          address: '123 Main St',
        },
        schedule: {
          assignedToId: 'user-789',
          assignedTo: {
            id: 'user-789',
            name: 'John Doe',
            email: 'john@example.com',
            designationId: 'SCO-123',
          },
        },
        deficiencies: [],
      }

      const mockUser = {
        id: 'user-789',
        role: 'SCO',
      }

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(mockInspection as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

      const result = await inspectionService.getById('insp-123', 'user-789')

      expect(result).toBeDefined()
      expect(result?.id).toBe('insp-123')
    })

    it('should throw error if user does not have access', async () => {
      const mockInspection = {
        id: 'insp-123',
        permitId: 'permit-456',
        status: 'SCHEDULED',
        scheduledDate: new Date('2024-02-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
        schedule: {
          assignedToId: 'other-user',
        },
      }

      const mockUser = {
        id: 'user-789',
        role: 'SCO',
      }

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(mockInspection as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

      await expect(inspectionService.getById('insp-123', 'user-789')).rejects.toThrow(
        'Unauthorized access to inspection',
      )
    })

    it('should allow admin access to any inspection', async () => {
      const mockInspection = {
        id: 'insp-123',
        permitId: 'permit-456',
        status: 'SCHEDULED',
        scheduledDate: new Date('2024-02-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
        schedule: {
          assignedToId: 'other-user',
        },
      }

      const mockUser = {
        id: 'admin-123',
        role: 'ADMIN',
      }

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(mockInspection as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

      const result = await inspectionService.getById('insp-123', 'admin-123')

      expect(result).toBeDefined()
      expect(result?.id).toBe('insp-123')
    })

    it('should return null if inspection not found', async () => {
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(null)

      const result = await inspectionService.getById('non-existent', 'user-789')

      expect(result).toBeNull()
    })
  })

  describe('getAssigned', () => {
    it('should return inspections assigned to user', async () => {
      const mockInspections = [
        {
          id: 'insp-1',
          permitId: 'permit-1',
          status: 'SCHEDULED',
          scheduledDate: new Date('2024-02-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
          permit: {
            id: 'permit-1',
            permitNumber: 'P-2024-001',
            address: '123 Main St',
          },
          schedule: {
            assignedToId: 'user-789',
            assignedTo: {
              id: 'user-789',
              name: 'John Doe',
            },
          },
          deficiencies: [],
        },
      ]

      vi.mocked(prisma.permitInspection.findMany).mockResolvedValue(mockInspections as any)

      const result = await inspectionService.getAssigned('user-789')

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('insp-1')
      expect(prisma.permitInspection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            schedule: {
              assignedToId: 'user-789',
            },
          }),
        }),
      )
    })

    it('should filter by status', async () => {
      vi.mocked(prisma.permitInspection.findMany).mockResolvedValue([])

      await inspectionService.getAssigned('user-789', {
        status: 'IN_PROGRESS',
      })

      expect(prisma.permitInspection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'IN_PROGRESS',
          }),
        }),
      )
    })

    it('should filter by scheduled date range', async () => {
      vi.mocked(prisma.permitInspection.findMany).mockResolvedValue([])

      const scheduledAfter = new Date('2024-02-01')
      const scheduledBefore = new Date('2024-02-28')

      await inspectionService.getAssigned('user-789', {
        scheduledAfter,
        scheduledBefore,
      })

      expect(prisma.permitInspection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            scheduledDate: {
              gte: scheduledAfter,
              lte: scheduledBefore,
            },
          }),
        }),
      )
    })

    it('should apply pagination', async () => {
      vi.mocked(prisma.permitInspection.findMany).mockResolvedValue([])

      await inspectionService.getAssigned('user-789', {
        limit: 10,
        offset: 20,
      })

      expect(prisma.permitInspection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        }),
      )
    })
  })

  describe('list', () => {
    it('should list all inspections', async () => {
      const mockInspections = [
        {
          id: 'insp-1',
          permitId: 'permit-1',
          status: 'SCHEDULED',
          scheduledDate: new Date('2024-02-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
          permit: {},
          schedule: {},
          deficiencies: [],
        },
      ]

      vi.mocked(prisma.permitInspection.findMany).mockResolvedValue(mockInspections as any)

      const result = await inspectionService.list()

      expect(result).toHaveLength(1)
    })

    it('should filter by permitId', async () => {
      vi.mocked(prisma.permitInspection.findMany).mockResolvedValue([])

      await inspectionService.list({
        permitId: 'permit-123',
      })

      expect(prisma.permitInspection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            permitId: 'permit-123',
          }),
        }),
      )
    })

    it('should filter by status', async () => {
      vi.mocked(prisma.permitInspection.findMany).mockResolvedValue([])

      await inspectionService.list({
        status: 'PASSED',
      })

      expect(prisma.permitInspection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PASSED',
          }),
        }),
      )
    })

    it('should filter by assignedToId', async () => {
      vi.mocked(prisma.permitInspection.findMany).mockResolvedValue([])

      await inspectionService.list({
        assignedToId: 'user-789',
      })

      expect(prisma.permitInspection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            schedule: {
              assignedToId: 'user-789',
            },
          }),
        }),
      )
    })
  })

  describe('start', () => {
    const mockGPSCoords: GPSCoordinates = {
      latitude: 51.0447,
      longitude: -114.0719,
      accuracy: 10,
      timestamp: '2024-02-01T10:00:00Z',
    }

    it('should start inspection successfully', async () => {
      const mockInspection = {
        id: 'insp-123',
        permitId: 'permit-456',
        uniqueId: null,
        status: 'SCHEDULED',
        scheduledDate: new Date('2024-02-01'),
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        schedule: {
          assignedToId: 'user-789',
        },
        permit: {
          id: 'permit-456',
          latitude: 51.0447,
          longitude: -114.0719,
        },
      }

      const mockUpdatedInspection = {
        ...mockInspection,
        status: 'IN_PROGRESS',
        notes: expect.stringContaining('Started at'),
      }

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(mockInspection as any)
      vi.mocked(prisma.permitInspection.update).mockResolvedValue(mockUpdatedInspection as any)

      const result = await inspectionService.start('insp-123', 'user-789', mockGPSCoords)

      expect(result.status).toBe('IN_PROGRESS')
      expect(prisma.permitInspection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'insp-123' },
          data: expect.objectContaining({
            uniqueId: expect.any(String),
            inspectorId: 'user-789',
            startGps: expect.objectContaining({
              lat: mockGPSCoords.latitude,
              lng: mockGPSCoords.longitude,
              accuracy: mockGPSCoords.accuracy,
              timestamp: mockGPSCoords.timestamp,
            }),
            status: 'IN_PROGRESS',
            notes: expect.stringContaining('Started at'),
          }),
        }),
      )
    })

    it('should throw error if inspection not found', async () => {
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(null)

      await expect(
        inspectionService.start('non-existent', 'user-789', mockGPSCoords),
      ).rejects.toThrow('Inspection not found')
    })

    it('should throw error if inspection not in SCHEDULED status', async () => {
      const mockInspection = {
        id: 'insp-123',
        permitId: 'permit-456',
        status: 'IN_PROGRESS',
        scheduledDate: new Date('2024-02-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
        schedule: {
          assignedToId: 'user-789',
        },
        permit: {},
      }

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(mockInspection as any)

      await expect(inspectionService.start('insp-123', 'user-789', mockGPSCoords)).rejects.toThrow(
        'Cannot start inspection with status IN_PROGRESS',
      )
    })

    it('should throw error if user not assigned to inspection', async () => {
      const mockInspection = {
        id: 'insp-123',
        permitId: 'permit-456',
        status: 'SCHEDULED',
        scheduledDate: new Date('2024-02-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
        schedule: {
          assignedToId: 'other-user',
        },
        permit: {},
      }

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(mockInspection as any)

      await expect(inspectionService.start('insp-123', 'user-789', mockGPSCoords)).rejects.toThrow(
        'User not assigned to this inspection',
      )
    })

    it('should log warning if outside geofence', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const mockInspection = {
        id: 'insp-123',
        permitId: 'permit-456',
        status: 'SCHEDULED',
        scheduledDate: new Date('2024-02-01'),
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        schedule: {
          assignedToId: 'user-789',
        },
        permit: {
          id: 'permit-456',
          latitude: 52.0, // Far from GPS coords
          longitude: -115.0,
        },
      }

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(mockInspection as any)
      vi.mocked(prisma.permitInspection.update).mockResolvedValue({
        ...mockInspection,
        status: 'IN_PROGRESS',
      } as any)

      await inspectionService.start('insp-123', 'user-789', mockGPSCoords)

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Geofence warning'))

      consoleSpy.mockRestore()
    })

    it('should append GPS info to existing notes', async () => {
      const mockInspection = {
        id: 'insp-123',
        permitId: 'permit-456',
        status: 'SCHEDULED',
        scheduledDate: new Date('2024-02-01'),
        notes: 'Existing notes',
        createdAt: new Date(),
        updatedAt: new Date(),
        schedule: {
          assignedToId: 'user-789',
        },
        permit: {},
      }

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(mockInspection as any)
      vi.mocked(prisma.permitInspection.update).mockResolvedValue({
        ...mockInspection,
        status: 'IN_PROGRESS',
      } as any)

      await inspectionService.start('insp-123', 'user-789', mockGPSCoords)

      expect(prisma.permitInspection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notes: expect.stringContaining('Existing notes'),
          }),
        }),
      )
    })
  })

  describe('finalize', () => {
    it('should record legal integrity fields and compute document hash', async () => {
      const mockInspection = {
        id: 'insp-123',
        permitId: 'permit-456',
        esiteId: 'esite-1',
        uniqueId: null,
        status: 'IN_PROGRESS',
        scheduledDate: new Date('2024-02-01T08:00:00Z'),
        notes: null,
        createdAt: new Date('2024-02-01T07:59:00Z'),
        updatedAt: new Date('2024-02-01T09:00:00Z'),
        schedule: {
          assignedToId: 'user-789',
        },
        permit: {},
        deficiencies: [
          {
            id: 'def-1',
            clientId: 'c-1',
            esiteId: null,
            createdById: 'user-789',
            description: 'D1',
            location: null,
            severity: 'MINOR',
            status: 'OPEN',
            dueDate: null,
            codeReference: null,
            isStopWork: false,
            isUnsafe: false,
            createdAt: new Date('2024-02-01T08:10:00Z'),
          },
        ],
      }

      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(mockInspection as any)
      vi.mocked(prisma.permitInspection.update).mockResolvedValue({
        ...mockInspection,
        uniqueId: 'uuid-123',
        inspectorId: 'user-789',
        finalizedAt: new Date('2024-02-01T10:00:00Z'),
        completedDate: new Date('2024-02-01T10:00:00Z'),
        documentHash: 'a'.repeat(64),
      } as any)

      await inspectionService.finalize('insp-123', 'user-789', {
        finalizedAt: '2024-02-01T10:00:00Z',
        finalizeGps: {
          latitude: 51.0,
          longitude: -114.0,
          accuracy: 5,
          timestamp: '2024-02-01T10:00:00Z',
        },
        outcome: 'PASSED',
        signature: 'signed-by-test',
        certificationSnapshot: {
          designationId: 'SCO-123',
          disciplines: ['Building'],
        },
      })

      expect(prisma.permitInspection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'insp-123' },
          data: expect.objectContaining({
            uniqueId: expect.any(String),
            inspectorId: 'user-789',
            finalizedAt: new Date('2024-02-01T10:00:00Z'),
            completedDate: new Date('2024-02-01T10:00:00Z'),
            certificationSnapshot: expect.any(Object),
            finalizeGps: expect.objectContaining({
              lat: 51.0,
              lng: -114.0,
              accuracy: 5,
              timestamp: '2024-02-01T10:00:00Z',
            }),
            documentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          }),
        }),
      )
    })

    it('should throw error if user not assigned to inspection', async () => {
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue({
        id: 'insp-123',
        permitId: 'permit-456',
        status: 'IN_PROGRESS',
        scheduledDate: new Date('2024-02-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
        schedule: { assignedToId: 'other-user' },
        deficiencies: [],
      } as any)

      await expect(
        inspectionService.finalize('insp-123', 'user-789', {
          finalizeGps: {
            latitude: 51.0,
            longitude: -114.0,
            timestamp: '2024-02-01T10:00:00Z',
          },
          outcome: 'FAILED',
          signature: 'signed-by-test',
          certificationSnapshot: {},
        }),
      ).rejects.toThrow('User not assigned to this inspection')
    })
  })

  describe('append-only finalized records (M10-S8)', () => {
    const finalizedInspection = {
      id: 'insp-final',
      permitId: 'permit-1',
      status: 'PASSED',
      scheduledDate: new Date('2024-02-01'),
      createdAt: new Date(),
      updatedAt: new Date(),
      finalizedAt: new Date('2024-02-01T10:00:00Z'),
      schedule: { assignedToId: 'user-789' },
    }

    beforeEach(() => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'SCO' } as any)
    })

    it('blocks update on finalized inspection and audits the attempt', async () => {
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(finalizedInspection as any)

      await expect(
        inspectionService.update('insp-final', 'user-789', { notes: 'tamper' }),
      ).rejects.toThrow(/append-only/i)

      expect(prisma.permitInspection.update).not.toHaveBeenCalled()
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'INSPECTION_IMMUTABLE_VIOLATION',
          }),
        }),
      )
    })

    it('updates non-finalized inspection', async () => {
      const openInspection = {
        ...finalizedInspection,
        finalizedAt: null,
        status: 'IN_PROGRESS',
        notes: 'Original',
      }
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(openInspection as any)
      vi.mocked(prisma.permitInspection.update).mockResolvedValue({
        ...openInspection,
        notes: 'Revised',
      } as any)

      const result = await inspectionService.update('insp-final', 'user-789', { notes: 'Revised' })
      expect(result.notes).toBe('Revised')
      expect(prisma.permitInspection.update).toHaveBeenCalled()
    })

    it('rejects addendum when user lacks access', async () => {
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(finalizedInspection as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'SCO' } as any)
      const wrongUserInspection = {
        ...finalizedInspection,
        schedule: { assignedToId: 'other-user' },
      }
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(wrongUserInspection as any)

      await expect(
        inspectionService.createAddendum('insp-final', 'user-789', {
          reason: 'Nope',
          content: 'Unauthorized addendum attempt',
        }),
      ).rejects.toThrow('Unauthorized')
    })

    it('blocks delete on finalized inspection', async () => {
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(finalizedInspection as any)

      await expect(inspectionService.delete('insp-final', 'user-789')).rejects.toThrow(
        /append-only/i,
      )
      expect(prisma.permitInspection.delete).not.toHaveBeenCalled()
    })

    it('allows addendum creation on finalized inspection', async () => {
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(finalizedInspection as any)
      vi.mocked(mockAddendum().create).mockResolvedValue({
        id: 'add-1',
        inspectionId: 'insp-final',
        reason: 'Correct permit number',
        content: 'Permit P-009 not P-099',
        createdById: 'user-789',
        createdAt: new Date(),
        signature: null,
      })

      const addendum = await inspectionService.createAddendum('insp-final', 'user-789', {
        reason: 'Correct permit number',
        content: 'Permit P-009 not P-099',
      })

      expect(addendum.id).toBe('add-1')
      expect(mockAddendum().create).toHaveBeenCalled()
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'ADDENDUM_CREATED' }),
        }),
      )
    })

    it('rejects addendum when inspection is not finalized', async () => {
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue({
        ...finalizedInspection,
        finalizedAt: null,
        status: 'IN_PROGRESS',
      } as any)

      await expect(
        inspectionService.createAddendum('insp-final', 'user-789', {
          reason: 'Too early',
          content: 'Not finalized yet',
        }),
      ).rejects.toThrow('finalized inspection')
    })
  })
})
