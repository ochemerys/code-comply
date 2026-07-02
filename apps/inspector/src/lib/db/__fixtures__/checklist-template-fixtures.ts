/**
 * Test-only checklist template rows for Vitest (not used in production).
 */
import {
  ChecklistItemDTOSchema,
  ChecklistTemplateDTOSchema,
  type ChecklistItemDTO,
  type ChecklistTemplateDTO,
} from '@codecomply/validators'
import { toLocalCodeReference } from '@/lib/db/sync-mutation-helpers'
import type {
  CachedChecklistTemplateItem,
  CodeReference,
  LocalChecklistTemplateCache,
} from '@/lib/db/types'

export const FIXTURE_TEMPLATE_ID = 'template-fixture'
export const FIXTURE_VERSION_HASH = 'sha256:fixture-v1'

export const FIXTURE_CHECKLIST_ITEMS: ChecklistItemDTO[] = [
  {
    id: 'item-1',
    order: 1,
    text: 'Fire separation maintained between units',
    category: 'Fire',
    isRequired: true,
    requiresPhoto: true,
    codeReferences: [{ code: 'NBC', section: '9.10.1' }],
  },
  {
    id: 'item-2',
    order: 2,
    text: 'Exit signs illuminated',
    category: 'Fire',
    isRequired: true,
    requiresPhoto: false,
    codeReferences: [{ code: 'NBC', section: '3.4.1' }],
  },
  {
    id: 'item-3',
    order: 3,
    text: 'Handrails and guards secure',
    category: 'Building',
    isRequired: true,
    requiresPhoto: false,
    codeReferences: [{ code: 'NBC', section: '9.8.8' }],
  },
  {
    id: 'item-4',
    order: 4,
    text: 'Optional advisory — accessibility route',
    category: 'Building',
    isRequired: false,
    requiresPhoto: false,
    codeReferences: [{ code: 'NBC', section: '3.8.1' }],
  },
]

function fixtureItemsToCached(items: ChecklistItemDTO[]): CachedChecklistTemplateItem[] {
  return items.map((item) => {
    const parsed = ChecklistItemDTOSchema.parse(item)
    const codeReferences = parsed.codeReferences
      ?.map((ref) => toLocalCodeReference(ref))
      .filter((ref): ref is CodeReference => ref != null)
    return {
      id: parsed.id,
      order: parsed.order,
      text: parsed.text,
      category: parsed.category,
      isRequired: parsed.isRequired,
      requiresPhoto: parsed.requiresPhoto,
      ...(codeReferences?.length ? { codeReferences } : {}),
    }
  })
}

export function buildFixtureChecklistTemplateDto(
  cachedAt: string = new Date().toISOString(),
): ChecklistTemplateDTO {
  return ChecklistTemplateDTOSchema.parse({
    id: FIXTURE_TEMPLATE_ID,
    name: 'Fixture inspection checklist',
    discipline: 'General',
    version: 1,
    versionHash: FIXTURE_VERSION_HASH,
    items: FIXTURE_CHECKLIST_ITEMS,
    isActive: true,
    createdAt: cachedAt,
    updatedAt: cachedAt,
  })
}

export function buildFixtureTemplateCacheRow(
  cachedAt: string = new Date().toISOString(),
): LocalChecklistTemplateCache {
  return {
    templateId: FIXTURE_TEMPLATE_ID,
    versionHash: FIXTURE_VERSION_HASH,
    name: 'Fixture inspection checklist',
    discipline: 'General',
    version: 1,
    items: fixtureItemsToCached(FIXTURE_CHECKLIST_ITEMS),
    cachedAt,
  }
}
