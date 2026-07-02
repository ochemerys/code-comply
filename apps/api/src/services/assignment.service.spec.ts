import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AssignmentService } from './assignment.service'
import { prisma } from '@codecomply/db'

vi.mock('./push-notification.service.js', () => ({
  pushNotificationService: {
    sendNewAssignmentNotification: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@codecomply/db', () => ({
  prisma: {
    permitInspection: { findUnique: vi.fn(), findMany: vi.fn() },
    inspectionSchedule: {
      upsert: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

describe('AssignmentService', () => {
  let service: AssignmentService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AssignmentService()
  })

  describe('assign', () => {
    it('throws when inspection is missing', async () => {
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValueOnce(null)
      await expect(service.assign('insp-1', 'user-1')).rejects.toThrow('Inspection not found')
    })

    it('throws when assignee is missing', async () => {
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValueOnce({ id: 'insp-1' } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)
      await expect(service.assign('insp-1', 'user-1')).rejects.toThrow('User not found')
    })

    it('throws when assignee is inactive', async () => {
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValueOnce({ id: 'insp-1' } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-1',
        isActive: false,
      } as any)
      await expect(service.assign('insp-1', 'user-1')).rejects.toThrow('inactive user')
    })

    it('upserts inspection schedule', async () => {
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValueOnce({ id: 'insp-1' } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-1',
        isActive: true,
      } as any)
      const schedule = { id: 'sch-1', inspectionId: 'insp-1', assignedToId: 'user-1' } as any
      vi.mocked(prisma.inspectionSchedule.upsert).mockResolvedValueOnce(schedule)

      const result = await service.assign('insp-1', 'user-1')
      expect(result).toBe(schedule)
      expect(prisma.inspectionSchedule.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { inspectionId: 'insp-1' },
          create: expect.objectContaining({ inspectionId: 'insp-1', assignedToId: 'user-1' }),
          update: expect.objectContaining({ assignedToId: 'user-1' }),
        }),
      )
    })
  })

  describe('bulkAssign', () => {
    it('returns empty array for empty input', async () => {
      await expect(service.bulkAssign({ items: [] })).resolves.toEqual([])
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('throws when an inspection id is missing', async () => {
      vi.mocked(prisma.permitInspection.findMany).mockResolvedValueOnce([{ id: 'a' }] as any)
      await expect(
        service.bulkAssign({
          items: [
            { inspectionId: 'a', userId: 'u1' },
            { inspectionId: 'b', userId: 'u1' },
          ],
        }),
      ).rejects.toThrow('Inspection not found')
    })

    it('throws when an assignee is missing', async () => {
      vi.mocked(prisma.permitInspection.findMany).mockResolvedValueOnce([
        { id: 'a' },
        { id: 'b' },
      ] as any)
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([{ id: 'u1' }] as any)
      await expect(
        service.bulkAssign({
          items: [
            { inspectionId: 'a', userId: 'u1' },
            { inspectionId: 'b', userId: 'u2' },
          ],
        }),
      ).rejects.toThrow('assignees')
    })

    it('runs a transaction of upserts', async () => {
      vi.mocked(prisma.permitInspection.findMany).mockResolvedValueOnce([{ id: 'a' }] as any)
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([{ id: 'u1' }] as any)
      const rows = [{ id: 's1' }] as any
      vi.mocked(prisma.$transaction).mockResolvedValueOnce(rows)

      const result = await service.bulkAssign({ items: [{ inspectionId: 'a', userId: 'u1' }] })
      expect(result).toBe(rows)
      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    })
  })

  describe('reassign', () => {
    it('throws when assignment missing', async () => {
      vi.mocked(prisma.inspectionSchedule.findUnique).mockResolvedValueOnce(null)
      await expect(service.reassign('sch-x', 'u2')).rejects.toThrow('Assignment not found')
    })

    it('throws when new user missing', async () => {
      vi.mocked(prisma.inspectionSchedule.findUnique).mockResolvedValueOnce({ id: 'sch-1' } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)
      await expect(service.reassign('sch-1', 'u2')).rejects.toThrow('User not found')
    })

    it('updates assignee', async () => {
      vi.mocked(prisma.inspectionSchedule.findUnique).mockResolvedValueOnce({ id: 'sch-1' } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: 'u2', isActive: true } as any)
      const updated = { id: 'sch-1', assignedToId: 'u2' } as any
      vi.mocked(prisma.inspectionSchedule.update).mockResolvedValueOnce(updated)

      await expect(service.reassign('sch-1', 'u2')).resolves.toBe(updated)
    })
  })

  describe('getWorkload', () => {
    it('aggregates schedules in range', async () => {
      const from = new Date('2026-05-01T00:00:00.000Z')
      const to = new Date('2026-05-31T00:00:00.000Z')
      vi.mocked(prisma.inspectionSchedule.findMany).mockResolvedValueOnce([
        {
          inspectionId: 'i1',
          assignedDate: new Date('2026-05-10T12:00:00.000Z'),
          inspection: { status: 'SCHEDULED' },
        },
      ] as any)

      const w = await service.getWorkload('u1', { from, to })
      expect(w.userId).toBe('u1')
      expect(w.scheduledCount).toBe(1)
      expect(w.inspections[0].inspectionId).toBe('i1')
      expect(w.inspections[0].status).toBe('SCHEDULED')
    })
  })

  describe('getAvailableInspectors', () => {
    it('filters SCOs by daily load using groupBy (no N+1)', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
        { id: 'a', name: 'Ann', role: 'SCO', isActive: true },
        { id: 'b', name: 'Bob', role: 'SCO', isActive: true },
      ] as any)
      vi.mocked(prisma.inspectionSchedule.groupBy).mockResolvedValueOnce([
        { assignedToId: 'a', _count: { _all: 5 } },
      ] as any)

      const day = new Date('2026-06-15T12:00:00.000Z')
      const list = await service.getAvailableInspectors(day, 5)
      expect(list.map((u) => u.id)).toEqual(['b'])
      expect(prisma.inspectionSchedule.groupBy).toHaveBeenCalledTimes(1)
      expect(prisma.inspectionSchedule.count).not.toHaveBeenCalled()
    })
  })
})
