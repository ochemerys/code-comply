import { describe, it, expect, beforeEach, vi } from 'vitest'
import { VoCService } from './voc.service.js'
import { prisma } from '@codecomply/db'

vi.mock('@codecomply/db', () => {
  const prismaMock = {
    deficiency: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    verificationOfCompliance: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: any) => unknown) => fn(prismaMock)),
  }
  return { prisma: prismaMock }
})

const submitDto = {
  verificationDate: '2026-11-02T12:00:00.000Z',
  sectionTitle: 'Division B — Safety',
  title: 'Guardrail corrected',
  name: 'Building Owner LLC',
  method: 'SITE_VISIT' as const,
  comments: 'Verified on site.',
}

describe('VoCService', () => {
  let service: VoCService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new VoCService()
  })

  describe('submit', () => {
    it('creates VoC and marks deficiency VOC_SUBMITTED', async () => {
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue({
        id: 'def-1',
        status: 'OPEN',
        verificationOfCompliance: null,
      } as never)

      const created = {
        id: 'voc-1',
        deficiencyId: 'def-1',
        status: 'PENDING',
        method: 'SITE_VISIT',
        submittedAt: new Date(),
      }
      vi.mocked(prisma.verificationOfCompliance.create).mockResolvedValue(created as never)
      vi.mocked(prisma.deficiency.update).mockResolvedValue({} as never)

      const result = await service.submit('def-1', submitDto)

      expect(result.id).toBe('voc-1')
      expect(prisma.verificationOfCompliance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deficiencyId: 'def-1',
            status: 'PENDING',
            method: 'SITE_VISIT',
          }),
        }),
      )
      expect(prisma.deficiency.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'def-1' },
          data: expect.objectContaining({ status: 'VOC_SUBMITTED' }),
        }),
      )
    })

    it('throws when deficiency is not found', async () => {
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue(null)
      await expect(service.submit('missing', submitDto)).rejects.toThrow('Deficiency not found')
    })

    it('throws when VoC is already pending', async () => {
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue({
        id: 'def-1',
        status: 'VOC_SUBMITTED',
        verificationOfCompliance: { id: 'voc-1', status: 'PENDING' },
      } as never)

      await expect(service.submit('def-1', submitDto)).rejects.toThrow('pending review')
    })

    it('resubmits after rejection', async () => {
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue({
        id: 'def-1',
        status: 'VOC_REJECTED',
        verificationOfCompliance: { id: 'voc-1', status: 'REJECTED' },
      } as never)

      const updated = { id: 'voc-1', status: 'PENDING', deficiencyId: 'def-1' }
      vi.mocked(prisma.verificationOfCompliance.update).mockResolvedValue(updated as never)
      vi.mocked(prisma.deficiency.update).mockResolvedValue({} as never)

      const result = await service.submit('def-1', submitDto)

      expect(result.status).toBe('PENDING')
      expect(prisma.verificationOfCompliance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'voc-1' },
          data: expect.objectContaining({
            status: 'PENDING',
            reviewedAt: null,
            reviewedById: null,
          }),
        }),
      )
    })

    it('throws when VoC was already accepted', async () => {
      vi.mocked(prisma.deficiency.findUnique).mockResolvedValue({
        id: 'def-1',
        status: 'VOC_REJECTED',
        verificationOfCompliance: { id: 'voc-1', status: 'ACCEPTED' },
      } as never)

      await expect(service.submit('def-1', submitDto)).rejects.toThrow('already accepted')
    })
  })

  describe('review', () => {
    it('accepts VoC and closes deficiency', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'ADMIN' } as never)
      vi.mocked(prisma.verificationOfCompliance.findUnique).mockResolvedValue({
        id: 'voc-1',
        deficiencyId: 'def-1',
        status: 'PENDING',
      } as never)

      const accepted = { id: 'voc-1', status: 'ACCEPTED', deficiencyId: 'def-1' }
      vi.mocked(prisma.verificationOfCompliance.update).mockResolvedValue(accepted as never)
      vi.mocked(prisma.deficiency.update).mockResolvedValue({} as never)

      const result = await service.review('voc-1', 'ACCEPTED', 'admin-1')

      expect(result.status).toBe('ACCEPTED')
      expect(prisma.deficiency.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'def-1' },
          data: expect.objectContaining({ status: 'CLOSED' }),
        }),
      )
    })

    it('rejects VoC and marks deficiency VOC_REJECTED', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'ADMIN' } as never)
      vi.mocked(prisma.verificationOfCompliance.findUnique).mockResolvedValue({
        id: 'voc-1',
        deficiencyId: 'def-1',
        status: 'PENDING',
      } as never)

      const rejected = { id: 'voc-1', status: 'REJECTED', deficiencyId: 'def-1' }
      vi.mocked(prisma.verificationOfCompliance.update).mockResolvedValue(rejected as never)
      vi.mocked(prisma.deficiency.update).mockResolvedValue({} as never)

      const result = await service.review('voc-1', 'REJECTED', 'admin-1')

      expect(result.status).toBe('REJECTED')
      expect(prisma.deficiency.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'VOC_REJECTED' }),
        }),
      )
    })

    it('requires admin reviewer', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'SCO' } as never)
      await expect(service.review('voc-1', 'ACCEPTED', 'sco-1')).rejects.toThrow('Forbidden')
    })

    it('throws when VoC is not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'ADMIN' } as never)
      vi.mocked(prisma.verificationOfCompliance.findUnique).mockResolvedValue(null)

      await expect(service.review('missing', 'ACCEPTED', 'admin-1')).rejects.toThrow(
        'VoC not found',
      )
    })

    it('throws when VoC is not pending', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'ADMIN' } as never)
      vi.mocked(prisma.verificationOfCompliance.findUnique).mockResolvedValue({
        id: 'voc-1',
        status: 'ACCEPTED',
      } as never)

      await expect(service.review('voc-1', 'REJECTED', 'admin-1')).rejects.toThrow(
        'not pending review',
      )
    })
  })

  describe('getByDeficiency', () => {
    it('returns VoC for deficiency', async () => {
      const row = { id: 'voc-1', deficiencyId: 'def-1' }
      vi.mocked(prisma.verificationOfCompliance.findUnique).mockResolvedValue(row as never)

      const result = await service.getByDeficiency('def-1')
      expect(result).toEqual(row)
      expect(prisma.verificationOfCompliance.findUnique).toHaveBeenCalledWith({
        where: { deficiencyId: 'def-1' },
      })
    })

    it('returns null when no VoC exists', async () => {
      vi.mocked(prisma.verificationOfCompliance.findUnique).mockResolvedValue(null)
      expect(await service.getByDeficiency('def-1')).toBeNull()
    })
  })

  describe('listPending', () => {
    it('returns pending VoCs for admin', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'ADMIN' } as never)
      const rows = [{ id: 'voc-1', status: 'PENDING' }]
      vi.mocked(prisma.verificationOfCompliance.findMany).mockResolvedValue(rows as never)

      const result = await service.listPending('admin-1')

      expect(result).toEqual(rows)
      expect(prisma.verificationOfCompliance.findMany).toHaveBeenCalledWith({
        where: { status: 'PENDING' },
        orderBy: { submittedAt: 'asc' },
        take: 50,
        skip: 0,
        select: expect.objectContaining({ id: true, status: true }),
      })
    })

    it('requires admin role', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'SCO' } as never)
      await expect(service.listPending('sco-1')).rejects.toThrow('Forbidden')
    })
  })

  describe('review with comments', () => {
    it('stores review comments on deficiency', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'ADMIN' } as never)
      vi.mocked(prisma.verificationOfCompliance.findUnique).mockResolvedValue({
        id: 'voc-1',
        deficiencyId: 'def-1',
        status: 'PENDING',
      } as never)
      vi.mocked(prisma.verificationOfCompliance.update).mockResolvedValue({
        id: 'voc-1',
        status: 'REJECTED',
      } as never)
      vi.mocked(prisma.deficiency.update).mockResolvedValue({} as never)

      await service.review('voc-1', 'REJECTED', 'admin-1', 'Insufficient evidence')

      expect(prisma.deficiency.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'VOC_REJECTED',
            vocNotes: 'Insufficient evidence',
          }),
        }),
      )
    })
  })
})
