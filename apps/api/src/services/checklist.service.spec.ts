import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ChecklistService, computeChecklistProgressPercent } from './checklist.service'
import { inspectionService } from './inspection.service'
import { prisma } from '@codecomply/db'
import { resetQueryCacheStore } from '../lib/cache/query-cache'

vi.mock('./inspection.service', () => ({
  inspectionService: {
    getById: vi.fn(),
  },
}))

vi.mock('@codecomply/db', () => ({
  prisma: {
    checklistTemplate: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    permitInspection: {
      findUnique: vi.fn(),
    },
    checklistExecution: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

describe('computeChecklistProgressPercent', () => {
  it('returns 100 when there are no item ids', () => {
    expect(computeChecklistProgressPercent([], [])).toBe(100)
    expect(computeChecklistProgressPercent([{ foo: 1 }], [])).toBe(100)
  })

  it('computes answered / total × 100', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    expect(computeChecklistProgressPercent(items, [{ itemId: 'a' }, { itemId: 'c' }])).toBe(67)
    expect(
      computeChecklistProgressPercent(items, [{ itemId: 'a' }, { itemId: 'b' }, { itemId: 'c' }]),
    ).toBe(100)
  })
})

describe('ChecklistService', () => {
  let service: ChecklistService

  beforeEach(() => {
    vi.clearAllMocks()
    resetQueryCacheStore()
    service = new ChecklistService()
  })

  describe('getTemplate', () => {
    it('returns template when found', async () => {
      const tpl = {
        id: 't1',
        name: 'T',
        discipline: 'B',
        version: 1,
        versionHash: 'h1',
        items: [{ id: 'a' }],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      vi.mocked(prisma.checklistTemplate.findUnique).mockResolvedValue(tpl as any)

      const result = await service.getTemplate('t1')
      expect(result.id).toBe('t1')
      expect(prisma.checklistTemplate.findUnique).toHaveBeenCalledWith({ where: { id: 't1' } })
    })

    it('throws when template missing', async () => {
      vi.mocked(prisma.checklistTemplate.findUnique).mockResolvedValue(null)
      await expect(service.getTemplate('x')).rejects.toThrow('Checklist template not found')
    })
  })

  describe('listTemplates', () => {
    it('returns active templates filtered by discipline when provided', async () => {
      const rows = [{ id: 't1', discipline: 'Building' }]
      vi.mocked(prisma.checklistTemplate.findMany).mockResolvedValue(rows as any)

      const result = await service.listTemplates('Building')
      expect(result).toEqual(rows)
      expect(prisma.checklistTemplate.findMany).toHaveBeenCalledWith({
        where: { isActive: true, discipline: 'Building' },
        orderBy: [{ discipline: 'asc' }, { name: 'asc' }],
        select: expect.objectContaining({ id: true, items: true }),
      })
    })

    it('lists all active templates when discipline omitted', async () => {
      vi.mocked(prisma.checklistTemplate.findMany).mockResolvedValue([])

      await service.listTemplates()
      expect(prisma.checklistTemplate.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [{ discipline: 'asc' }, { name: 'asc' }],
        select: expect.objectContaining({ id: true, items: true }),
      })
    })
  })

  describe('getExecutionWithTemplate', () => {
    it('returns execution with template', async () => {
      const row = {
        id: 'ex1',
        template: { id: 't1', items: [] },
      }
      vi.mocked(prisma.checklistExecution.findUnique).mockResolvedValue(row as any)

      const result = await service.getExecutionWithTemplate('ex1')
      expect(result.id).toBe('ex1')
      expect(prisma.checklistExecution.findUnique).toHaveBeenCalledWith({
        where: { id: 'ex1' },
        include: { template: true },
      })
    })

    it('throws when execution missing', async () => {
      vi.mocked(prisma.checklistExecution.findUnique).mockResolvedValue(null)
      await expect(service.getExecutionWithTemplate('x')).rejects.toThrow(
        'Checklist execution not found',
      )
    })
  })

  describe('getExecutionForUser', () => {
    it('returns execution when inspection is accessible', async () => {
      const row = { id: 'ex1', inspectionId: 'in1', template: { id: 't1', items: [] } }
      vi.mocked(prisma.checklistExecution.findUnique).mockResolvedValue(row as any)
      vi.mocked(inspectionService.getById).mockResolvedValue({ id: 'in1' } as any)

      const result = await service.getExecutionForUser('ex1', 'user-1')
      expect(result.id).toBe('ex1')
      expect(inspectionService.getById).toHaveBeenCalledWith('in1', 'user-1')
    })

    it('propagates unauthorized from inspection service', async () => {
      const row = { id: 'ex1', inspectionId: 'in1', template: { id: 't1', items: [] } }
      vi.mocked(prisma.checklistExecution.findUnique).mockResolvedValue(row as any)
      vi.mocked(inspectionService.getById).mockRejectedValue(
        new Error('Unauthorized access to inspection'),
      )

      await expect(service.getExecutionForUser('ex1', 'user-1')).rejects.toThrow('Unauthorized')
    })
  })

  describe('startExecution', () => {
    it('creates execution with template versionHash', async () => {
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue({ id: 'in1' } as any)
      vi.mocked(prisma.checklistTemplate.findUnique).mockResolvedValue({
        id: 't1',
        versionHash: 'vh-fixed',
      } as any)
      const created = {
        id: 'ex1',
        inspectionId: 'in1',
        templateId: 't1',
        versionHash: 'vh-fixed',
        responses: [],
        progress: 0,
        completedAt: null,
      }
      vi.mocked(prisma.checklistExecution.create).mockResolvedValue(created as any)

      const result = await service.startExecution('in1', 't1')
      expect(result.versionHash).toBe('vh-fixed')
      expect(prisma.checklistExecution.create).toHaveBeenCalledWith({
        data: {
          inspectionId: 'in1',
          templateId: 't1',
          versionHash: 'vh-fixed',
          responses: [],
          progress: 0,
        },
      })
    })

    it('throws when inspection missing', async () => {
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(null)
      await expect(service.startExecution('in1', 't1')).rejects.toThrow('Inspection not found')
    })

    it('throws when template missing', async () => {
      vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue({ id: 'in1' } as any)
      vi.mocked(prisma.checklistTemplate.findUnique).mockResolvedValue(null)
      await expect(service.startExecution('in1', 't1')).rejects.toThrow(
        'Checklist template not found',
      )
    })
  })

  describe('updateResponse', () => {
    const templateItems = [
      { id: 'i1', order: 1 },
      { id: 'i2', order: 2 },
    ]

    it('throws when FAIL without codeReference', async () => {
      await expect(
        service.updateResponse('ex1', 'i1', {
          result: 'FAIL',
          timestamp: '2026-01-01T00:00:00.000Z',
        }),
      ).rejects.toThrow('codeReference is required when result is FAIL')
    })

    it('merges response and updates progress', async () => {
      vi.mocked(prisma.checklistExecution.findUnique).mockResolvedValue({
        id: 'ex1',
        completedAt: null,
        responses: [],
        template: { items: templateItems },
      } as any)
      vi.mocked(prisma.checklistExecution.update).mockResolvedValue({} as any)

      await service.updateResponse('ex1', 'i1', {
        result: 'PASS',
        timestamp: '2026-01-01T00:00:00.000Z',
      })

      expect(prisma.checklistExecution.update).toHaveBeenCalledWith({
        where: { id: 'ex1' },
        data: expect.objectContaining({
          progress: 50,
        }),
      })
    })

    it('defaults timestamp when omitted', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-03-15T12:00:00.000Z'))
      try {
        vi.mocked(prisma.checklistExecution.findUnique).mockResolvedValue({
          id: 'ex1',
          completedAt: null,
          responses: [],
          template: { items: templateItems },
        } as any)
        vi.mocked(prisma.checklistExecution.update).mockResolvedValue({} as any)

        await service.updateResponse('ex1', 'i1', { result: 'PASS' })

        const call = vi.mocked(prisma.checklistExecution.update).mock.calls[0][0]
        const responses = call.data.responses as { itemId: string; timestamp: string }[]
        expect(responses.find((r) => r.itemId === 'i1')?.timestamp).toBe('2026-03-15T12:00:00.000Z')
      } finally {
        vi.useRealTimers()
      }
    })

    it('allows FAIL with codeReference', async () => {
      vi.mocked(prisma.checklistExecution.findUnique).mockResolvedValue({
        id: 'ex1',
        completedAt: null,
        responses: [{ itemId: 'i2', result: 'PASS', timestamp: '2026-01-01T00:00:00.000Z' }],
        template: { items: templateItems },
      } as any)
      vi.mocked(prisma.checklistExecution.update).mockResolvedValue({} as any)

      await service.updateResponse('ex1', 'i1', {
        result: 'FAIL',
        codeReference: { code: 'NBC', section: '9.10.1' },
        timestamp: '2026-01-02T00:00:00.000Z',
      })

      const call = vi.mocked(prisma.checklistExecution.update).mock.calls[0][0]
      const responses = call.data.responses as { itemId: string; result: string }[]
      expect(responses.find((r) => r.itemId === 'i1')?.result).toBe('FAIL')
      expect(call.data.progress).toBe(100)
      expect(call.data.completedAt).toBeInstanceOf(Date)
    })

    it('throws when execution not found', async () => {
      vi.mocked(prisma.checklistExecution.findUnique).mockResolvedValue(null)
      await expect(
        service.updateResponse('ex1', 'i1', {
          result: 'NA',
          timestamp: '2026-01-01T00:00:00.000Z',
        }),
      ).rejects.toThrow('Checklist execution not found')
    })

    it('throws when execution completed', async () => {
      vi.mocked(prisma.checklistExecution.findUnique).mockResolvedValue({
        id: 'ex1',
        completedAt: new Date(),
        responses: [],
        template: { items: templateItems },
      } as any)

      await expect(
        service.updateResponse('ex1', 'i1', {
          result: 'PASS',
          timestamp: '2026-01-01T00:00:00.000Z',
        }),
      ).rejects.toThrow('Cannot modify completed checklist execution')
    })

    it('throws when itemId not in template', async () => {
      vi.mocked(prisma.checklistExecution.findUnique).mockResolvedValue({
        id: 'ex1',
        completedAt: null,
        responses: [],
        template: { items: templateItems },
      } as any)

      await expect(
        service.updateResponse('ex1', 'bad', {
          result: 'PASS',
          timestamp: '2026-01-01T00:00:00.000Z',
        }),
      ).rejects.toThrow('Item is not part of this checklist template')
    })
  })

  describe('getProgress', () => {
    it('returns computed percentage', async () => {
      vi.mocked(prisma.checklistExecution.findUnique).mockResolvedValue({
        id: 'ex1',
        responses: [{ itemId: 'a', result: 'PASS', timestamp: '2026-01-01T00:00:00.000Z' }],
        template: { items: [{ id: 'a' }, { id: 'b' }] },
      } as any)

      await expect(service.getProgress('ex1')).resolves.toBe(50)
    })

    it('throws when execution missing', async () => {
      vi.mocked(prisma.checklistExecution.findUnique).mockResolvedValue(null)
      await expect(service.getProgress('x')).rejects.toThrow('Checklist execution not found')
    })
  })

  describe('passAll', () => {
    it('marks all template items PASS at 100% progress and sets completedAt', async () => {
      vi.mocked(prisma.checklistExecution.findUnique).mockResolvedValue({
        id: 'ex1',
        completedAt: null,
        responses: [],
        template: { items: [{ id: 'a' }, { id: 'b' }] },
      } as any)
      vi.mocked(prisma.checklistExecution.update).mockResolvedValue({} as any)

      await service.passAll('ex1')

      const call = vi.mocked(prisma.checklistExecution.update).mock.calls[0][0]
      expect(call.data.progress).toBe(100)
      expect(call.data.completedAt).toBeInstanceOf(Date)
      const responses = call.data.responses as { itemId: string; result: string }[]
      expect(responses).toHaveLength(2)
      expect(responses.every((r) => r.result === 'PASS')).toBe(true)
    })

    it('throws when completed', async () => {
      vi.mocked(prisma.checklistExecution.findUnique).mockResolvedValue({
        id: 'ex1',
        completedAt: new Date(),
        template: { items: [{ id: 'a' }] },
      } as any)

      await expect(service.passAll('ex1')).rejects.toThrow(
        'Cannot modify completed checklist execution',
      )
    })

    it('throws when execution not found', async () => {
      vi.mocked(prisma.checklistExecution.findUnique).mockResolvedValue(null)
      await expect(service.passAll('missing')).rejects.toThrow('Checklist execution not found')
    })
  })
})
