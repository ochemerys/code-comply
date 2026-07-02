/**
 * useOfflineChecklists — cache checklist templates in IndexedDB (M5-S15).
 *
 * Templates are keyed by `templateId` + `versionHash`, retained up to 7 days,
 * with a maximum of 50 cached templates (oldest evicted first by `cachedAt`).
 *
 * Execution rows remain in the `checklists` table; this composable uses
 * `checklistTemplateCache` for template definitions only.
 *
 * @module composables/useOfflineChecklists
 */

import { db, type InspectorDB } from '@/lib/db/dexie'
import type { LocalChecklistTemplateCache, CodeReference } from '@/lib/db/types'
import { toLocalCodeReference } from '@/lib/db/sync-mutation-helpers'
import {
  ChecklistTemplateDTOSchema,
  type ChecklistItemDTO,
  type ChecklistTemplateDTO,
} from '@codecomply/validators'
import { ChecklistTemplateUnavailableError } from '@/lib/db/checklist-template-errors'

/** Default TTL from story: 7 days */
export const CHECKLIST_TEMPLATE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Default cap from story */
export const CHECKLIST_TEMPLATE_CACHE_MAX = 50

export interface UseOfflineChecklistsOptions {
  /** Override DB (tests); defaults to encrypted app singleton */
  database?: InspectorDB
}

export interface ResolveChecklistTemplateParams {
  templateId: string
  expectedVersionHash: string
  /** When online, load from API or other source; result must match id + versionHash */
  fetchLive?: () => Promise<ChecklistTemplateDTO>
}

export interface UseOfflineChecklistsReturn {
  getCachedTemplate: (
    templateId: string,
    versionHash: string,
  ) => Promise<ChecklistTemplateDTO | null>
  putTemplate: (template: ChecklistTemplateDTO) => Promise<void>
  resolveTemplate: (params: ResolveChecklistTemplateParams) => Promise<ChecklistTemplateDTO>
  pruneTemplateCache: () => Promise<void>
}

function cacheRowToDto(row: LocalChecklistTemplateCache): ChecklistTemplateDTO {
  const candidate = {
    id: row.templateId,
    name: row.name,
    discipline: row.discipline,
    version: row.version,
    versionHash: row.versionHash,
    items: row.items as ChecklistItemDTO[],
    isActive: true,
    createdAt: row.cachedAt,
    updatedAt: row.cachedAt,
  }
  return ChecklistTemplateDTOSchema.parse(candidate)
}

function dtoToCacheRow(template: ChecklistTemplateDTO): LocalChecklistTemplateCache {
  return {
    templateId: template.id,
    versionHash: template.versionHash,
    name: template.name,
    discipline: template.discipline,
    version: template.version,
    items: template.items.map((item) => {
      const codeReferences = item.codeReferences
        ?.map((ref) => toLocalCodeReference(ref))
        .filter((ref): ref is CodeReference => ref != null)
      return {
        id: item.id,
        order: item.order,
        text: item.text,
        category: item.category,
        isRequired: item.isRequired,
        requiresPhoto: item.requiresPhoto,
        ...(codeReferences?.length ? { codeReferences } : {}),
      }
    }),
    cachedAt: new Date().toISOString(),
  }
}

async function pruneTemplateCacheInternal(
  dexie: InspectorDB,
  ttlMs: number = CHECKLIST_TEMPLATE_CACHE_TTL_MS,
  maxEntries: number = CHECKLIST_TEMPLATE_CACHE_MAX,
): Promise<void> {
  const now = Date.now()
  const rows = await dexie.checklistTemplateCache.toArray()
  for (const row of rows) {
    if (now - new Date(row.cachedAt).getTime() > ttlMs) {
      await dexie.checklistTemplateCache.delete([row.templateId, row.versionHash])
    }
  }
  const remaining = await dexie.checklistTemplateCache.orderBy('cachedAt').toArray()
  if (remaining.length <= maxEntries) return
  const overflow = remaining.length - maxEntries
  for (let i = 0; i < overflow; i++) {
    const row = remaining[i]!
    await dexie.checklistTemplateCache.delete([row.templateId, row.versionHash])
  }
}

export function useOfflineChecklists(
  options: UseOfflineChecklistsOptions = {},
): UseOfflineChecklistsReturn {
  const dexie = options.database ?? db

  async function getCachedTemplate(
    templateId: string,
    versionHash: string,
  ): Promise<ChecklistTemplateDTO | null> {
    const row = await dexie.checklistTemplateCache.get([templateId, versionHash])
    if (!row) return null
    if (row.versionHash !== versionHash) {
      await dexie.checklistTemplateCache.delete([templateId, versionHash])
      return null
    }
    if (Date.now() - new Date(row.cachedAt).getTime() > CHECKLIST_TEMPLATE_CACHE_TTL_MS) {
      await dexie.checklistTemplateCache.delete([templateId, versionHash])
      return null
    }
    return cacheRowToDto(row)
  }

  async function putTemplate(template: ChecklistTemplateDTO): Promise<void> {
    const parsed = ChecklistTemplateDTOSchema.parse(template)
    await dexie.checklistTemplateCache.put(dtoToCacheRow(parsed))
    await pruneTemplateCacheInternal(dexie)
  }

  async function resolveTemplate(
    params: ResolveChecklistTemplateParams,
  ): Promise<ChecklistTemplateDTO> {
    const cached = await getCachedTemplate(params.templateId, params.expectedVersionHash)
    if (cached) return cached

    if (params.fetchLive) {
      const fetched = ChecklistTemplateDTOSchema.parse(await params.fetchLive())
      if (fetched.id !== params.templateId || fetched.versionHash !== params.expectedVersionHash) {
        throw new Error(
          `Template mismatch: expected id ${params.templateId} and hash ${params.expectedVersionHash}`,
        )
      }
      await putTemplate(fetched)
      return fetched
    }

    throw new ChecklistTemplateUnavailableError()
  }

  async function pruneTemplateCache(): Promise<void> {
    await pruneTemplateCacheInternal(dexie)
  }

  return {
    getCachedTemplate,
    putTemplate,
    resolveTemplate,
    pruneTemplateCache,
  }
}
