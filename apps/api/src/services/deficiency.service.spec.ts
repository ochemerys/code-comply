import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  DeficiencyService,
  deficiencyNotificationHooks,
  deficiencyService,
} from './deficiency.service.js'
import { prisma } from '@codecomply/db'

vi.mock('@codecomply/db', () => {
  const prismaMock = {
    deficiency: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    permitInspection: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    },
    $transaction: vi.fn(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock)),
  }
  return { prisma: prismaMock }
})

const baseCreateDto = {
  clientId: 'client-1',
  inspectionId: 'insp-1',
  description: 'At least ten chars for deficiency description text here',
  severity: 'MAJOR' as const,
  isStopWork: false,
  isUnsafe: false,
}

describe('DeficiencyService', () => {
  let service: DeficiencyService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new DeficiencyService()
  })

  describe('create', () => {
    it('returns existing deficiency when clientId already exists', async () => {
      const existing = {
        id: 'def-existing',
        clientId: 'client-1',
        inspectionId: 'insp-1',
        createdById: 'u1',
        description: baseCreateDto.description,
        severity: 'MAJOR',
        status: 'OPEN',
        isStopWork: false,
        isUnsafe: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue(existing as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'SCO' } as any)

      const result = await service.create(baseCreateDto, 'u1')

      expect(result).toBe(existing)
      expect(prisma.permitInspection.findUnique).not.toHaveBeenCalled()
      expect(prisma.deficiency.create).not.toHaveBeenCalled()
    })

    it('creates when new and user is assigned to inspection', async () => {
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue({
        id: 'insp-1',
        schedule: { assignedToId: 'u1' },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'SCO' } as any)

      const created = {
        id: 'def-new',
        clientId: baseCreateDto.clientId,
        inspectionId: 'insp-1',
        createdById: 'u1',
        description: baseCreateDto.description,
        severity: 'MAJOR',
        status: 'OPEN',
        isStopWork: false,
        isUnsafe: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      vi.mocked(prisma.deficiency.create).mockResolvedValue(created as any)

      const result = await service.create(baseCreateDto, 'u1')

      expect(result.id).toBe('def-new')
      expect(prisma.deficiency.create).toHaveBeenCalled()
    })

    it('allows ADMIN to create on any inspection', async () => {
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue({
        id: 'insp-1',
        schedule: { assignedToId: 'other' },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'ADMIN' } as any)
      vi.mocked(prisma.deficiency.create).mockResolvedValue({ id: 'd1' } as any)

      await service.create(baseCreateDto, 'admin-1')

      expect(prisma.deficiency.create).toHaveBeenCalled()
    })

    it('throws when inspection not found', async () => {
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(null)

      await expect(service.create(baseCreateDto, 'u1')).rejects.toThrow('Inspection not found')
    })

    it('throws when user not assigned', async () => {
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue({
        id: 'insp-1',
        schedule: { assignedToId: 'other' },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'SCO' } as any)

      await expect(service.create(baseCreateDto, 'u1')).rejects.toThrow(
        'User not assigned to this inspection',
      )
    })

    it('triggers critical escalation for CRITICAL severity', async () => {
      const hook = vi
        .spyOn(deficiencyNotificationHooks, 'onCriticalDeficiencyCreated')
        .mockResolvedValue()
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue({
        id: 'insp-1',
        schedule: { assignedToId: 'u1' },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'SCO' } as any)
      vi.mocked(prisma.deficiency.create).mockResolvedValue({
        id: 'def-crit',
        inspectionId: 'insp-1',
      } as any)

      await service.create({ ...baseCreateDto, severity: 'CRITICAL' }, 'u1')

      expect(hook).toHaveBeenCalledWith({
        deficiencyId: 'def-crit',
        inspectionId: 'insp-1',
      })
    })

    it('triggers unsafe escalation when isUnsafe on create (M6-S16)', async () => {
      const hook = vi
        .spyOn(deficiencyNotificationHooks, 'onUnsafeConditionEscalation')
        .mockResolvedValue()
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue({
        id: 'insp-1',
        schedule: { assignedToId: 'u1' },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'SCO' } as any)
      vi.mocked(prisma.deficiency.create).mockResolvedValue({
        id: 'def-u',
        inspectionId: 'insp-1',
      } as any)

      await service.create({ ...baseCreateDto, isUnsafe: true }, 'u1')

      expect(hook).toHaveBeenCalledWith({
        deficiencyId: 'def-u',
        inspectionId: 'insp-1',
      })
    })
  })

  describe('getById', () => {
    it('returns null when not found', async () => {
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue(null)
      await expect(service.getById('missing', 'u1')).resolves.toBeNull()
    })

    it('throws when user lacks access', async () => {
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue({
        id: 'd1',
        inspectionId: 'insp-1',
        inspection: { id: 'insp-1', schedule: { assignedToId: 'other' } },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'SCO' } as any)

      await expect(service.getById('d1', 'u1')).rejects.toThrow('Unauthorized access to deficiency')
    })

    it('returns deficiency when user is ADMIN', async () => {
      const row = {
        id: 'd1',
        clientId: 'c1',
        inspectionId: 'insp-1',
        createdById: 'other',
        description: 'desc',
        severity: 'MINOR',
        status: 'OPEN',
        isStopWork: false,
        isUnsafe: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        inspection: { id: 'insp-1', schedule: { assignedToId: 'other' } },
      }
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue(row as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'ADMIN' } as any)

      const result = await service.getById('d1', 'admin-1')
      expect(result?.id).toBe('d1')
    })

    it('returns deficiency when assigned inspector', async () => {
      const row = {
        id: 'd1',
        clientId: 'c1',
        inspectionId: 'insp-1',
        createdById: 'u1',
        description: 'desc',
        severity: 'MINOR',
        status: 'OPEN',
        isStopWork: false,
        isUnsafe: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        inspection: { id: 'insp-1', schedule: { assignedToId: 'u1' } },
      }
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue(row as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'SCO' } as any)

      const result = await service.getById('d1', 'u1')
      expect(result?.id).toBe('d1')
      expect((result as any).inspection).toBeUndefined()
    })
  })

  describe('list', () => {
    it('returns empty when user missing', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
      await expect(service.list({ userId: 'nope' })).resolves.toEqual([])
      expect(prisma.deficiency.findMany).not.toHaveBeenCalled()
    })

    it('scopes non-ADMIN to assigned inspections', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'SCO' } as any)
      vi.mocked(prisma.deficiency.findMany).mockResolvedValue([])

      await service.list({ userId: 'u1', inspectionId: 'insp-9', status: 'OPEN' })

      expect(prisma.deficiency.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            inspectionId: 'insp-9',
            status: 'OPEN',
            inspection: { schedule: { assignedToId: 'u1' } },
          }),
        }),
      )
    })

    it('ADMIN list omits assignment filter', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'ADMIN' } as any)
      vi.mocked(prisma.deficiency.findMany).mockResolvedValue([])

      await service.list({ userId: 'admin', severity: 'CRITICAL', isStopWork: true })

      expect(prisma.deficiency.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            inspection: expect.anything(),
          }),
        }),
      )
    })
  })

  describe('update', () => {
    it('throws when not found', async () => {
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue(null)
      await expect(service.update('d1', 'u1', { description: 'x'.repeat(12) })).rejects.toThrow(
        'Deficiency not found',
      )
    })

    it('throws on ETag mismatch', async () => {
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue({
        id: 'd1',
        etag: 'server-etag',
        createdById: 'u1',
        inspection: { id: 'i1', schedule: { assignedToId: 'u1' } },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'SCO' } as any)

      await expect(
        service.update('d1', 'u1', { description: 'new description text ok' }, 'wrong'),
      ).rejects.toThrow('Optimistic concurrency conflict')
    })

    it('updates when ETag matches', async () => {
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue({
        id: 'd1',
        etag: 'e1',
        createdById: 'u1',
        isUnsafe: false,
        inspectionId: 'insp-1',
        inspection: { id: 'i1', schedule: { assignedToId: 'u1' } },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'SCO' } as any)
      const updated = { id: 'd1', description: 'new description text ok', inspectionId: 'insp-1' }
      vi.mocked(prisma.deficiency.update).mockResolvedValue(updated as any)

      const result = await service.update(
        'd1',
        'u1',
        { description: 'new description text ok' },
        'e1',
      )
      expect(result.description).toBe('new description text ok')
      expect(prisma.deficiency.update).toHaveBeenCalled()
    })

    it('triggers unsafe escalation when isUnsafe flips false to true (M6-S16)', async () => {
      const hook = vi
        .spyOn(deficiencyNotificationHooks, 'onUnsafeConditionEscalation')
        .mockResolvedValue()
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue({
        id: 'd1',
        etag: 'e1',
        createdById: 'u1',
        isUnsafe: false,
        inspectionId: 'insp-1',
        inspection: { id: 'i1', schedule: { assignedToId: 'u1' } },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'SCO' } as any)
      vi.mocked(prisma.deficiency.update).mockResolvedValue({
        id: 'd1',
        inspectionId: 'insp-1',
        isUnsafe: true,
      } as any)

      await service.update('d1', 'u1', { isUnsafe: true }, 'e1')

      expect(hook).toHaveBeenCalledWith({ deficiencyId: 'd1', inspectionId: 'insp-1' })
    })

    it('does not re-trigger unsafe escalation when already unsafe', async () => {
      const hook = vi
        .spyOn(deficiencyNotificationHooks, 'onUnsafeConditionEscalation')
        .mockResolvedValue()
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue({
        id: 'd1',
        etag: 'e1',
        createdById: 'u1',
        isUnsafe: true,
        inspectionId: 'insp-1',
        inspection: { id: 'i1', schedule: { assignedToId: 'u1' } },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'SCO' } as any)
      vi.mocked(prisma.deficiency.update).mockResolvedValue({
        id: 'd1',
        inspectionId: 'insp-1',
        description: 'x'.repeat(12),
      } as any)

      await service.update('d1', 'u1', { description: 'x'.repeat(12) }, 'e1')

      expect(hook).not.toHaveBeenCalled()
    })

    it('updates status when provided (e.g. mark resolved)', async () => {
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue({
        id: 'd1',
        etag: 'e1',
        createdById: 'u1',
        inspection: { id: 'i1', schedule: { assignedToId: 'u1' } },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'SCO' } as any)
      vi.mocked(prisma.deficiency.update).mockResolvedValue({ id: 'd1', status: 'CLOSED' } as any)

      await service.update('d1', 'u1', { status: 'CLOSED' }, 'e1')

      const call = vi.mocked(prisma.deficiency.update).mock.calls[0][0] as any
      expect(call.data.status).toBe('CLOSED')
    })

    it('can repoint inspection when inspectionId provided', async () => {
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue({
        id: 'd1',
        etag: 'e1',
        createdById: 'u1',
        inspection: { id: 'i1', schedule: { assignedToId: 'u1' } },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'ADMIN' } as any)
      vi.mocked(prisma.deficiency.update).mockResolvedValue({ id: 'd1' } as any)

      await service.update('d1', 'admin', { inspectionId: 'insp-2' } as any)

      expect(prisma.deficiency.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            inspection: { connect: { id: 'insp-2' } },
          }),
        }),
      )
    })

    it('clears dueDate when update sends nullish datetime', async () => {
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue({
        id: 'd1',
        etag: 'e1',
        createdById: 'u1',
        inspection: { id: 'i1', schedule: { assignedToId: 'u1' } },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'SCO' } as any)
      vi.mocked(prisma.deficiency.update).mockResolvedValue({ id: 'd1' } as any)

      await service.update('d1', 'u1', { dueDate: null as unknown as undefined } as any)

      const call = vi.mocked(prisma.deficiency.update).mock.calls[0][0] as any
      expect(call.data.dueDate).toBeNull()
    })

    it('forbids update when user cannot mutate', async () => {
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue({
        id: 'd1',
        etag: 'e1',
        createdById: 'other',
        inspection: { id: 'i1', schedule: { assignedToId: 'other' } },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'SCO' } as any)

      await expect(
        service.update('d1', 'u1', { description: 'new description text ok' }),
      ).rejects.toThrow('Forbidden')
    })
  })

  describe('delete', () => {
    it('throws when not found', async () => {
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue(null)
      await expect(service.delete('d1', 'u1')).rejects.toThrow('Deficiency not found')
    })

    it('deletes when user is creator', async () => {
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue({
        id: 'd1',
        createdById: 'u1',
        inspection: { id: 'i1', schedule: { assignedToId: 'other' } },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'SCO' } as any)

      await service.delete('d1', 'u1')
      expect(prisma.deficiency.delete).toHaveBeenCalledWith({ where: { id: 'd1' } })
    })

    it('forbids delete for unrelated user', async () => {
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue({
        id: 'd1',
        createdById: 'a',
        inspection: { id: 'i1', schedule: { assignedToId: 'b' } },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'SCO' } as any)

      await expect(service.delete('d1', 'u1')).rejects.toThrow('Forbidden')
    })
  })

  describe('createStopWorkOrder', () => {
    it('throws when deficiency missing', async () => {
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue(null)
      await expect(service.createStopWorkOrder('d1', 'u1')).rejects.toThrow('Deficiency not found')
    })

    it('throws when user cannot access deficiency', async () => {
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue({
        id: 'd1',
        inspectionId: 'insp-1',
        inspection: { id: 'insp-1', schedule: { assignedToId: 'other' } },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'SCO' } as any)

      await expect(service.createStopWorkOrder('d1', 'u1')).rejects.toThrow(
        'Unauthorized access to deficiency',
      )
    })

    it('updates deficiency and notifies', async () => {
      const notify = vi
        .spyOn(deficiencyNotificationHooks, 'onStopWorkOrderIssued')
        .mockResolvedValue()
      const updatedAt = new Date('2026-04-01T12:00:00.000Z')
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue({
        id: 'd1',
        inspectionId: 'insp-1',
        inspection: { id: 'insp-1', schedule: { assignedToId: 'u1' } },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'SCO' } as any)
      vi.mocked(prisma.deficiency.update).mockResolvedValue({
        id: 'd1',
        inspectionId: 'insp-1',
        updatedAt,
        isStopWork: true,
      } as any)

      const swo = await service.createStopWorkOrder('d1', 'u1')

      expect(swo.deficiencyId).toBe('d1')
      expect(swo.inspectionId).toBe('insp-1')
      expect(notify).toHaveBeenCalledWith({ deficiencyId: 'd1', inspectionId: 'insp-1' })
    })

    it('returns Stop Work result and logs when notification hook rejects', async () => {
      const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.spyOn(deficiencyNotificationHooks, 'onStopWorkOrderIssued').mockRejectedValue(
        new Error('downstream notify failed'),
      )
      const updatedAt = new Date('2026-04-01T12:00:00.000Z')
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue({
        id: 'd1',
        inspectionId: 'insp-1',
        inspection: { id: 'insp-1', schedule: { assignedToId: 'u1' } },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'SCO' } as any)
      vi.mocked(prisma.deficiency.update).mockResolvedValue({
        id: 'd1',
        inspectionId: 'insp-1',
        updatedAt,
        isStopWork: true,
      } as any)

      const swo = await service.createStopWorkOrder('d1', 'u1')

      expect(swo.deficiencyId).toBe('d1')
      expect(logSpy).toHaveBeenCalled()
      const firstArg = logSpy.mock.calls[0]?.[0] as string
      expect(firstArg).toContain('onStopWorkOrderIssued')
      expect(firstArg).toContain('downstream notify failed')
      logSpy.mockRestore()
    })
  })

  describe('singleton export', () => {
    it('exports working instance', () => {
      expect(deficiencyService).toBeInstanceOf(DeficiencyService)
    })
  })
})
