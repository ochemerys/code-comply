/** Centralized Redis / in-memory cache key prefixes (M11-S11). */
export const CACHE_KEYS = {
  codeLibraryByType: (codeType: string) => `code-library:type:${codeType.toLowerCase()}`,
  codeLibraryBySection: (code: string, section: string) =>
    `code-library:section:${code.toLowerCase()}:${section}`,
  checklistTemplates: (discipline?: string) =>
    discipline ? `checklist:templates:${discipline}` : 'checklist:templates:all',
} as const

export const CACHE_TTL = {
  codeLibrary: 60 * 60, // 1 hour — reference data changes rarely
  checklistTemplates: 30 * 60, // 30 minutes
} as const
