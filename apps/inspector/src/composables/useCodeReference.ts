/**
 * useCodeReference — search and select safety code references (M5-S7).
 * Online: GET /api/codes; offline: search cached library + recent selections.
 */

import { ref, type Ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getApiBaseUrl } from '@/lib/api-base'
import type { CodeReference } from '@/lib/db/types'

/** Max recent selections (story: recent_codes_limit) */
export const CODE_REFERENCE_RECENT_LIMIT = 10

/** Entries older than this are dropped from library search and recent list (story: cache_duration) */
export const CODE_REFERENCE_CACHE_MS = 24 * 60 * 60 * 1000

export const CODE_REFERENCE_LIBRARY_KEY = 'inspector:codeReference:library'
export const CODE_REFERENCE_RECENT_KEY = 'inspector:codeReference:recent'

type LibraryEntry = CodeReference & { cachedAt: string }

type RecentPersist = { ref: CodeReference; usedAt: string }

function apiBase(): string {
  return getApiBaseUrl().replace(/\/$/, '')
}

function buildSearchUrl(query: string): string {
  const q = encodeURIComponent(query.trim())
  return `${apiBase()}/api/codes?q=${q}`
}

function buildResolveUrl(code: string, section: string): string {
  const c = encodeURIComponent(code)
  const s = encodeURIComponent(section)
  return `${apiBase()}/api/codes/${c}/${s}`
}

function normalizeDto(raw: Record<string, unknown>): CodeReference {
  return {
    code: String(raw.code),
    section: String(raw.section),
    ...(typeof raw.title === 'string' ? { title: raw.title } : {}),
    ...(typeof raw.description === 'string' ? { description: raw.description } : {}),
  }
}

function refKey(r: CodeReference): string {
  return `${r.code.toLowerCase()}::${r.section.toLowerCase()}`
}

function readLibrary(): LibraryEntry[] {
  try {
    const raw = localStorage.getItem(CODE_REFERENCE_LIBRARY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { entries?: LibraryEntry[] }
    if (!Array.isArray(parsed.entries)) return []
    const now = Date.now()
    return parsed.entries.filter(
      (e) => now - new Date(e.cachedAt).getTime() <= CODE_REFERENCE_CACHE_MS,
    )
  } catch {
    return []
  }
}

function writeLibrary(entries: LibraryEntry[]): void {
  localStorage.setItem(CODE_REFERENCE_LIBRARY_KEY, JSON.stringify({ entries }))
}

function mergeLibraryFromResults(results: CodeReference[]): void {
  const existing = readLibrary()
  const map = new Map<string, LibraryEntry>()
  for (const e of existing) {
    map.set(refKey(e), e)
  }
  const now = new Date().toISOString()
  for (const r of results) {
    const key = refKey(r)
    map.set(key, { ...r, cachedAt: now })
  }
  writeLibrary([...map.values()])
}

function filterLibraryByQuery(query: string): CodeReference[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return readLibrary()
    .filter((e) => {
      const hay = [e.code, e.section, e.title ?? '', e.description ?? ''].join(' ').toLowerCase()
      return hay.includes(q)
    })
    .map(({ cachedAt: _c, ...rest }) => rest)
}

function readRecentPersist(): RecentPersist[] {
  try {
    const raw = localStorage.getItem(CODE_REFERENCE_RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RecentPersist[]
    if (!Array.isArray(parsed)) return []
    const now = Date.now()
    return parsed.filter((p) => now - new Date(p.usedAt).getTime() <= CODE_REFERENCE_CACHE_MS)
  } catch {
    return []
  }
}

function writeRecent(list: RecentPersist[]): void {
  const trimmed = list.slice(0, CODE_REFERENCE_RECENT_LIMIT)
  localStorage.setItem(CODE_REFERENCE_RECENT_KEY, JSON.stringify(trimmed))
}

function pushRecent(ref: CodeReference): void {
  const now = new Date().toISOString()
  const key = refKey(ref)
  const others = readRecentPersist().filter((p) => refKey(p.ref) !== key)
  const next: RecentPersist[] = [{ ref, usedAt: now }, ...others].slice(
    0,
    CODE_REFERENCE_RECENT_LIMIT,
  )
  writeRecent(next)
}

function hydrateRecentCodes(): CodeReference[] {
  return readRecentPersist().map((p) => p.ref)
}

function findInLibrary(code: string, section: string): CodeReference | null {
  const k = `${code.toLowerCase()}::${section.toLowerCase()}`
  for (const e of readLibrary()) {
    if (refKey(e) === k) {
      const { cachedAt: _c, ...rest } = e
      return rest
    }
  }
  return null
}

export interface UseCodeReferenceReturn {
  searchResults: Ref<CodeReference[]>
  recentCodes: Ref<CodeReference[]>
  isSearching: Ref<boolean>
  search: (query: string) => Promise<void>
  select: (code: string, section: string) => Promise<CodeReference>
  clearSearch: () => void
}

export function useCodeReference(): UseCodeReferenceReturn {
  const authStore = useAuthStore()
  const searchResults = ref<CodeReference[]>([])
  const recentCodes = ref<CodeReference[]>(hydrateRecentCodes())
  const isSearching = ref(false)

  function refreshRecentRef(): void {
    recentCodes.value = hydrateRecentCodes()
  }

  async function search(query: string): Promise<void> {
    const q = query.trim()
    if (!q) {
      searchResults.value = []
      return
    }

    isSearching.value = true
    try {
      const online = typeof navigator !== 'undefined' && navigator.onLine
      const token = authStore.accessToken

      if (online && token) {
        try {
          const res = await fetch(buildSearchUrl(q), {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          })
          if (res.ok) {
            const data = (await res.json()) as unknown[]
            const mapped = data
              .filter(
                (row): row is Record<string, unknown> => row !== null && typeof row === 'object',
              )
              .map((row) => normalizeDto(row))
            mergeLibraryFromResults(mapped)
            searchResults.value = mapped
            return
          }
        } catch {
          /* network or parse error — use cached library */
        }
      }

      searchResults.value = filterLibraryByQuery(q)
    } finally {
      isSearching.value = false
    }
  }

  async function select(code: string, section: string): Promise<CodeReference> {
    const online = typeof navigator !== 'undefined' && navigator.onLine
    const token = authStore.accessToken

    if (online && token) {
      try {
        const res = await fetch(buildResolveUrl(code, section), {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        })
        if (res.ok) {
          const raw = (await res.json()) as Record<string, unknown>
          const refObj = normalizeDto(raw)
          mergeLibraryFromResults([refObj])
          pushRecent(refObj)
          refreshRecentRef()
          return refObj
        }
      } catch {
        /* fall through to cache */
      }
    }

    const fromLib = findInLibrary(code, section)
    if (fromLib) {
      pushRecent(fromLib)
      refreshRecentRef()
      return fromLib
    }

    for (const p of readRecentPersist()) {
      if (p.ref.code === code && p.ref.section === section) {
        return p.ref
      }
    }

    throw new Error('Code reference not found')
  }

  function clearSearch(): void {
    searchResults.value = []
    isSearching.value = false
  }

  return {
    searchResults,
    recentCodes,
    isSearching,
    search,
    select,
    clearSearch,
  }
}
