import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma as db } from '@codecomply/db'
import { CodeLibraryService } from '../../src/services/code-library.service'

describe.sequential('CodeLibraryService integration (M5-S4)', () => {
  const service = new CodeLibraryService()

  beforeAll(async () => {
    await db.codeLibrary.deleteMany()
    await db.codeLibrary.createMany({
      data: [
        {
          code: 'NBC',
          section: '9.10.1',
          title: 'Fire separation of residential units',
          description: 'Required resistance ratings',
        },
        {
          code: 'NBC',
          section: '9.23.1',
          title: 'Wood framing',
          description: null,
        },
        {
          code: 'IFC',
          section: '903.1',
          title: 'Automatic sprinkler systems',
          description: 'General',
        },
      ],
    })
  })

  afterAll(async () => {
    await db.codeLibrary.deleteMany()
  })

  it('search finds rows by substring in title or code', async () => {
    const fire = await service.search('Fire')
    expect(fire.some((r) => r.section === '9.10.1')).toBe(true)

    const nbc = await service.search('NBC')
    expect(nbc.length).toBeGreaterThanOrEqual(2)
  })

  it('search returns [] for blank query', async () => {
    expect(await service.search('')).toEqual([])
  })

  it('getByCode returns a single row or null', async () => {
    const found = await service.getByCode('NBC', '9.23.1')
    expect(found?.title).toBe('Wood framing')

    const missing = await service.getByCode('NBC', '0.0.0')
    expect(missing).toBeNull()
  })

  it('listByType filters by code book', async () => {
    const nbcOnly = await service.listByType('NBC')
    expect(nbcOnly.every((r) => r.code.toUpperCase() === 'NBC')).toBe(true)
    expect(nbcOnly.map((r) => r.section)).toEqual(['9.10.1', '9.23.1'])

    const ifc = await service.listByType('IFC')
    expect(ifc).toHaveLength(1)
    expect(ifc[0].section).toBe('903.1')
  })

  it('listByType returns [] for blank type', async () => {
    expect(await service.listByType('')).toEqual([])
  })
})
