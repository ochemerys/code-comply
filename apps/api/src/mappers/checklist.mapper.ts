import type { ChecklistExecution, ChecklistTemplate, Prisma } from '@codecomply/db'
import type {
  ChecklistExecutionDTO,
  ChecklistItemDTO,
  ChecklistResponseDTO,
  ChecklistTemplateDTO,
  AdminChecklistTemplateDetailDTO,
  AdminChecklistTemplateListItemDTO,
  CodeReferenceDTO,
} from '@codecomply/validators'

function toIso(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString()
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid checklist date value')
  }
  return parsed.toISOString()
}

function parseCodeReference(raw: unknown): CodeReferenceDTO | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  if (typeof o.code !== 'string' || typeof o.section !== 'string') return undefined
  if (o.code.length === 0 || o.section.length === 0) return undefined
  const ref: CodeReferenceDTO = {
    code: o.code,
    section: o.section,
  }
  if (typeof o.id === 'string') ref.id = o.id
  if (typeof o.title === 'string') ref.title = o.title
  return ref
}

function parseItem(raw: unknown, index: number): ChecklistItemDTO | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' && o.id.length > 0 ? o.id : `item-${index}`
  const order = typeof o.order === 'number' ? o.order : index + 1
  const text = typeof o.text === 'string' ? o.text : typeof o.label === 'string' ? o.label : ''
  const item: ChecklistItemDTO = {
    id,
    order,
    text,
    isRequired: typeof o.isRequired === 'boolean' ? o.isRequired : true,
    requiresPhoto: typeof o.requiresPhoto === 'boolean' ? o.requiresPhoto : false,
  }
  if (typeof o.category === 'string') item.category = o.category
  if (Array.isArray(o.codeReferences)) {
    const refs = o.codeReferences
      .map((r) => parseCodeReference(r))
      .filter((r): r is CodeReferenceDTO => r !== undefined)
    if (refs.length > 0) item.codeReferences = refs
  }
  return item
}

function parseItemsJson(itemsJson: Prisma.JsonValue): ChecklistItemDTO[] {
  if (!Array.isArray(itemsJson)) return []
  return itemsJson
    .map((raw, idx) => parseItem(raw, idx))
    .filter((x): x is ChecklistItemDTO => x !== null)
}

function parseResponsesJson(raw: Prisma.JsonValue | null | undefined): ChecklistResponseDTO[] {
  if (raw == null) return []
  if (!Array.isArray(raw)) return []
  const out: ChecklistResponseDTO[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    if (typeof r.itemId !== 'string') continue
    if (r.result !== 'PASS' && r.result !== 'FAIL' && r.result !== 'NA') continue
    const ts = typeof r.timestamp === 'string' ? r.timestamp : new Date().toISOString()
    const dto: ChecklistResponseDTO = {
      itemId: r.itemId,
      result: r.result,
      timestamp: ts,
    }
    if (typeof r.notes === 'string') dto.notes = r.notes
    const cr = parseCodeReference(r.codeReference)
    if (cr) dto.codeReference = cr
    out.push(dto)
  }
  return out
}

export const ChecklistMapper = {
  toTemplateDTO(entity: ChecklistTemplate): ChecklistTemplateDTO {
    return {
      id: entity.id,
      name: entity.name,
      discipline: entity.discipline,
      version: entity.version,
      versionHash: entity.versionHash,
      items: parseItemsJson(entity.items),
      isActive: entity.isActive,
      createdAt: toIso(entity.createdAt),
      updatedAt: toIso(entity.updatedAt),
    }
  },

  toTemplateDTOs(entities: ChecklistTemplate[]): ChecklistTemplateDTO[] {
    return entities.map((e) => ChecklistMapper.toTemplateDTO(e))
  },

  toAdminListItemDTO(
    entity: ChecklistTemplate,
    usageCount: number,
  ): AdminChecklistTemplateListItemDTO {
    return {
      ...ChecklistMapper.toTemplateDTO(entity),
      usageCount,
      isLocked: usageCount > 0,
    }
  },

  toAdminDetailDTO(entity: ChecklistTemplate, usageCount: number): AdminChecklistTemplateDetailDTO {
    return {
      ...ChecklistMapper.toTemplateDTO(entity),
      usageCount,
      isLocked: usageCount > 0,
    }
  },

  toExecutionDTO(
    execution: ChecklistExecution & { template: ChecklistTemplate },
  ): ChecklistExecutionDTO {
    const responses = parseResponsesJson(execution.responses)
    return {
      id: execution.id,
      inspectionId: execution.inspectionId,
      templateId: execution.templateId,
      versionHash: execution.versionHash,
      responses,
      progress: Math.round(execution.progress),
      completedAt: execution.completedAt ? toIso(execution.completedAt) : undefined,
    }
  },
}
