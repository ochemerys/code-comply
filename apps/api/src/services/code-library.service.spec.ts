import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CodeLibraryService } from './code-library.service'
import { prisma } from '@codecomply/db'
import { resetQueryCacheStore } from '../lib/cache/query-cache'

vi.mock('@codecomply/db', () => ({
  prisma: {
    codeLibrary: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

describe('CodeLibraryService', () => {
  let service: CodeLibraryService

  beforeEach(() => {
    vi.clearAllMocks()
    resetQueryCacheStore()
    service = new CodeLibraryService()
  })

  const row = {
    id: 'cl-1',
    code: 'NBC',
    section: '9.10.1',
    title: 'Fire separation',
    description: 'Walls between units',
  }

  describe('search', () => {
    it('returns matching codes by code, section, title, or description', async () => {
      vi.mocked(prisma.codeLibrary.findMany).mockResolvedValue([row] as any)

      const byTitle = await service.search('Fire')
      expect(byTitle).toHaveLength(1)
      expect(byTitle[0]).toMatchObject({
        id: 'cl-1',
        code: 'NBC',
        section: '9.10.1',
        title: 'Fire separation',
      })

      vi.mocked(prisma.codeLibrary.findMany).mockResolvedValue([row] as any)
      await service.search('9.10')
      expect(prisma.codeLibrary.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        }),
      )
    })

    it('returns empty array when query is empty or whitespace', async () => {
      expect(await service.search('')).toEqual([])
      expect(await service.search('   ')).toEqual([])
      expect(prisma.codeLibrary.findMany).not.toHaveBeenCalled()
    })

    it('returns empty array when no matches', async () => {
      vi.mocked(prisma.codeLibrary.findMany).mockResolvedValue([])
      const result = await service.search('zzzz-no-match')
      expect(result).toEqual([])
    })

    it('orders results by code then section', async () => {
      vi.mocked(prisma.codeLibrary.findMany).mockResolvedValue([])

      await service.search('test')

      expect(prisma.codeLibrary.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ code: 'asc' }, { section: 'asc' }],
          take: 50,
        }),
      )
    })
  })

  describe('getByCode', () => {
    it('returns the code reference when found', async () => {
      vi.mocked(prisma.codeLibrary.findUnique).mockResolvedValue(row as any)

      const result = await service.getByCode('NBC', '9.10.1')

      expect(result).toEqual({
        id: 'cl-1',
        code: 'NBC',
        section: '9.10.1',
        title: 'Fire separation',
        description: 'Walls between units',
      })
      expect(prisma.codeLibrary.findUnique).toHaveBeenCalledWith({
        where: { code_section: { code: 'NBC', section: '9.10.1' } },
      })

      await service.getByCode('NBC', '9.10.1')
      expect(prisma.codeLibrary.findUnique).toHaveBeenCalledTimes(1)
    })

    it('returns null when not found', async () => {
      vi.mocked(prisma.codeLibrary.findUnique).mockResolvedValue(null)

      const result = await service.getByCode('IFC', '99.99.99')

      expect(result).toBeNull()
    })
  })

  describe('listByType', () => {
    it('returns entries for the given code type (case-insensitive)', async () => {
      vi.mocked(prisma.codeLibrary.findMany).mockResolvedValue([row] as any)

      const nbc = await service.listByType('NBC')
      expect(nbc).toHaveLength(1)
      expect(nbc[0].code).toBe('NBC')

      expect(prisma.codeLibrary.findMany).toHaveBeenCalledWith({
        where: { code: { equals: 'NBC', mode: 'insensitive' } },
        orderBy: { section: 'asc' },
      })

      vi.mocked(prisma.codeLibrary.findMany).mockResolvedValue([row] as any)
      await service.listByType('nbc')
      resetQueryCacheStore()
      vi.mocked(prisma.codeLibrary.findMany).mockResolvedValue([row] as any)
      await service.listByType('nbc')
      expect(prisma.codeLibrary.findMany).toHaveBeenCalledWith({
        where: { code: { equals: 'nbc', mode: 'insensitive' } },
        orderBy: { section: 'asc' },
      })
    })

    it('returns empty array when codeType is empty or whitespace', async () => {
      expect(await service.listByType('')).toEqual([])
      expect(await service.listByType('  ')).toEqual([])
      expect(prisma.codeLibrary.findMany).not.toHaveBeenCalled()
    })

    it('returns empty when no rows for type', async () => {
      vi.mocked(prisma.codeLibrary.findMany).mockResolvedValue([])
      const result = await service.listByType('STANDATA')
      expect(result).toEqual([])
    })
  })
})
