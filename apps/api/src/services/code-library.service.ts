import { prisma } from '@codecomply/db'
import type { CodeLibrary } from '@codecomply/db'
import { CACHE_KEYS, CACHE_TTL } from '../lib/cache/cache-keys.js'
import { getCached, invalidateCacheByPrefix } from '../lib/cache/query-cache.js'

/**
 * Domain representation of a row in `code_library` (building / safety code references).
 * The `code` field identifies the code book (NBC, IFC, AEC, STANDATA, etc.).
 */
export type CodeReference = {
  id: string
  code: string
  section: string
  title: string
  description?: string | null
}

const MAX_SEARCH_RESULTS = 50

function toReference(row: CodeLibrary): CodeReference {
  return {
    id: row.id,
    code: row.code,
    section: row.section,
    title: row.title,
    description: row.description,
  }
}

export class CodeLibraryService {
  /**
   * Full-text style search across code, section, title, and description (case-insensitive).
   * Whitespace-only queries return no rows. Results are capped (M11-S11 pagination).
   */
  async search(query: string, limit = MAX_SEARCH_RESULTS): Promise<CodeReference[]> {
    const q = query.trim()
    if (q.length === 0) return []

    const take = Math.min(Math.max(limit, 1), MAX_SEARCH_RESULTS)
    const rows = await prisma.codeLibrary.findMany({
      where: {
        OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { section: { contains: q, mode: 'insensitive' } },
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ code: 'asc' }, { section: 'asc' }],
      take,
    })
    return rows.map(toReference)
  }

  /**
   * Resolve a single entry by code book + section (unique in the database).
   * Cached for hot inspector lookups (M11-S11).
   */
  async getByCode(code: string, section: string): Promise<CodeReference | null> {
    const cacheKey = CACHE_KEYS.codeLibraryBySection(code, section)
    return getCached(cacheKey, CACHE_TTL.codeLibrary, async () => {
      const row = await prisma.codeLibrary.findUnique({
        where: { code_section: { code, section } },
      })
      return row ? toReference(row) : null
    })
  }

  /**
   * List all sections for a given code type (NBC, IFC, AEC, STANDATA, …), ordered by section.
   * Cached for hot inspector lookups (M11-S11).
   */
  async listByType(codeType: string): Promise<CodeReference[]> {
    const t = codeType.trim()
    if (t.length === 0) return []

    const cacheKey = CACHE_KEYS.codeLibraryByType(t)
    return getCached(cacheKey, CACHE_TTL.codeLibrary, async () => {
      const rows = await prisma.codeLibrary.findMany({
        where: { code: { equals: t, mode: 'insensitive' } },
        orderBy: { section: 'asc' },
      })
      return rows.map(toReference)
    })
  }

  /** Admin list — optional search and code-type filter. */
  async listAll(options?: { query?: string; codeType?: string }): Promise<CodeReference[]> {
    const q = options?.query?.trim() ?? ''
    const codeType = options?.codeType?.trim() ?? ''

    if (q) {
      let refs = await this.search(q, MAX_SEARCH_RESULTS)
      if (codeType) {
        const t = codeType.toLowerCase()
        refs = refs.filter((r) => r.code.toLowerCase() === t)
      }
      return refs
    }

    if (codeType) {
      return this.listByType(codeType)
    }

    const rows = await prisma.codeLibrary.findMany({
      orderBy: [{ code: 'asc' }, { section: 'asc' }],
      take: MAX_SEARCH_RESULTS,
    })
    return rows.map(toReference)
  }

  async getById(id: string): Promise<CodeReference | null> {
    const row = await prisma.codeLibrary.findUnique({ where: { id } })
    return row ? toReference(row) : null
  }

  async createEntry(input: {
    code: string
    section: string
    title: string
    description?: string
  }): Promise<CodeReference> {
    const row = await prisma.codeLibrary.create({
      data: {
        code: input.code.trim(),
        section: input.section.trim(),
        title: input.title.trim(),
        description: input.description?.trim() || null,
      },
    })
    await invalidateCacheByPrefix('code-library:')
    return toReference(row)
  }

  async updateEntry(
    id: string,
    input: {
      code?: string
      section?: string
      title?: string
      description?: string
    },
  ): Promise<CodeReference> {
    const existing = await prisma.codeLibrary.findUnique({ where: { id } })
    if (!existing) {
      throw new Error('Code reference not found')
    }
    const row = await prisma.codeLibrary.update({
      where: { id },
      data: {
        ...(input.code !== undefined ? { code: input.code.trim() } : {}),
        ...(input.section !== undefined ? { section: input.section.trim() } : {}),
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description.trim() || null }
          : {}),
      },
    })
    await invalidateCacheByPrefix('code-library:')
    return toReference(row)
  }
}

export const codeLibraryService = new CodeLibraryService()
