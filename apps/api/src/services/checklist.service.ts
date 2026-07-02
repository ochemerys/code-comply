import { createHash, randomUUID } from 'node:crypto'
import { prisma } from '@codecomply/db'
import type { ChecklistExecution, ChecklistTemplate, Prisma } from '@codecomply/db'
import type { AdminChecklistItemInput, ChecklistResponseResult } from '@codecomply/validators'
import { CACHE_KEYS, CACHE_TTL } from '../lib/cache/cache-keys.js'
import { getCached, invalidateCacheByPrefix } from '../lib/cache/query-cache.js'
import { inspectionService } from './inspection.service.js'

export type ChecklistResponseInput = {
  result: ChecklistResponseResult
  codeReference?: { code: string; section: string; title?: string; id?: string }
  notes?: string
  /** ISO 8601 datetime; defaults to current time */
  timestamp?: string
}

type TemplateItemJson = { id?: unknown; [key: string]: unknown }

type StoredResponse = {
  itemId: string
  result: ChecklistResponseResult
  codeReference?: ChecklistResponseInput['codeReference']
  notes?: string
  timestamp: string
}

function parseTemplateItems(itemsJson: Prisma.JsonValue): TemplateItemJson[] {
  if (!Array.isArray(itemsJson)) return []
  return itemsJson as TemplateItemJson[]
}

function templateItemIds(items: TemplateItemJson[]): string[] {
  return items
    .map((i) => i.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
}

/**
 * Business rule (M5-S3): progress = (answered items / total template items) × 100.
 * Returns 100 when there are no items with ids.
 */
export function computeChecklistProgressPercent(
  templateItems: TemplateItemJson[],
  responses: { itemId: string }[],
): number {
  const ids = templateItemIds(templateItems)
  if (ids.length === 0) return 100
  const responded = new Set(responses.map((r) => r.itemId))
  let answered = 0
  for (const id of ids) {
    if (responded.has(id)) answered += 1
  }
  return Math.round((answered / ids.length) * 100)
}

function parseResponses(raw: Prisma.JsonValue | null | undefined): StoredResponse[] {
  if (raw == null) return []
  if (!Array.isArray(raw)) return []
  const out: StoredResponse[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    if (typeof r.itemId !== 'string') continue
    if (r.result !== 'PASS' && r.result !== 'FAIL' && r.result !== 'NA') continue
    const result = r.result as ChecklistResponseResult
    const timestamp = typeof r.timestamp === 'string' ? r.timestamp : new Date().toISOString()
    out.push({
      itemId: r.itemId,
      result,
      codeReference: r.codeReference as StoredResponse['codeReference'],
      notes: typeof r.notes === 'string' ? r.notes : undefined,
      timestamp,
    })
  }
  return out
}

function assertFailHasCodeReference(input: ChecklistResponseInput): void {
  if (input.result === 'FAIL' && input.codeReference === undefined) {
    throw new Error('codeReference is required when result is FAIL')
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

export function computeTemplateVersionHash(payload: {
  name: string
  discipline: string
  version: number
  items: unknown
}): string {
  const canonical = stableStringify(payload)
  const digest = createHash('sha256').update(canonical).digest('hex')
  return `sha256:${digest}`
}

function normalizeAdminItems(items: AdminChecklistItemInput[]): Prisma.InputJsonValue {
  return items.map((item, index) => ({
    id: item.id?.trim() || `item-${randomUUID()}`,
    order: item.order ?? index + 1,
    text: item.text,
    ...(item.category ? { category: item.category } : {}),
    isRequired: item.isRequired !== false,
    requiresPhoto: item.requiresPhoto === true,
    ...(item.codeReferences?.length ? { codeReferences: item.codeReferences } : {}),
  })) as unknown as Prisma.InputJsonValue
}

async function invalidateChecklistTemplateCache(): Promise<void> {
  await invalidateCacheByPrefix('checklist:templates:')
}

/**
 * Checklist domain service — template retrieval, execution lifecycle, responses, progress.
 */
export class ChecklistService {
  async getTemplate(id: string): Promise<ChecklistTemplate> {
    const template = await prisma.checklistTemplate.findUnique({ where: { id } })
    if (!template) {
      throw new Error('Checklist template not found')
    }
    return template
  }

  /**
   * Active templates, optionally filtered by discipline (exact match).
   * Cached for hot inspector reads (M11-S11).
   */
  async listTemplates(discipline?: string): Promise<ChecklistTemplate[]> {
    const cacheKey = CACHE_KEYS.checklistTemplates(discipline)
    return getCached(cacheKey, CACHE_TTL.checklistTemplates, async () =>
      prisma.checklistTemplate.findMany({
        where: {
          isActive: true,
          ...(discipline !== undefined && discipline !== '' ? { discipline } : {}),
        },
        orderBy: [{ discipline: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          discipline: true,
          version: true,
          versionHash: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          items: true,
        },
      }),
    ) as Promise<ChecklistTemplate[]>
  }

  /**
   * Load execution with template for API DTO mapping.
   */
  async getExecutionWithTemplate(
    id: string,
  ): Promise<ChecklistExecution & { template: ChecklistTemplate }> {
    const execution = await prisma.checklistExecution.findUnique({
      where: { id },
      include: { template: true },
    })
    if (!execution) {
      throw new Error('Checklist execution not found')
    }
    return execution
  }

  /**
   * Load execution for an authenticated user (inspection must be visible to them).
   */
  async getExecutionForUser(
    executionId: string,
    userId: string,
  ): Promise<ChecklistExecution & { template: ChecklistTemplate }> {
    const execution = await this.getExecutionWithTemplate(executionId)
    const inspection = await inspectionService.getById(execution.inspectionId, userId)
    if (!inspection) {
      throw new Error('Inspection not found')
    }
    return execution
  }

  async startExecution(inspectionId: string, templateId: string): Promise<ChecklistExecution> {
    const inspection = await prisma.permitInspection.findUnique({ where: { id: inspectionId } })
    if (!inspection) {
      throw new Error('Inspection not found')
    }

    const template = await prisma.checklistTemplate.findUnique({ where: { id: templateId } })
    if (!template) {
      throw new Error('Checklist template not found')
    }

    return prisma.checklistExecution.create({
      data: {
        inspectionId,
        templateId,
        versionHash: template.versionHash,
        responses: [],
        progress: 0,
      },
    })
  }

  async updateResponse(
    executionId: string,
    itemId: string,
    response: ChecklistResponseInput,
  ): Promise<void> {
    assertFailHasCodeReference(response)

    const execution = await prisma.checklistExecution.findUnique({
      where: { id: executionId },
      include: { template: true },
    })

    if (!execution) {
      throw new Error('Checklist execution not found')
    }

    if (execution.completedAt !== null) {
      throw new Error('Cannot modify completed checklist execution')
    }

    const items = parseTemplateItems(execution.template.items)
    const validIds = new Set(templateItemIds(items))
    if (validIds.size > 0 && !validIds.has(itemId)) {
      throw new Error('Item is not part of this checklist template')
    }

    const timestamp = response.timestamp ?? new Date().toISOString()
    const next: StoredResponse = {
      itemId,
      result: response.result,
      codeReference: response.codeReference,
      notes: response.notes,
      timestamp,
    }

    const existing = parseResponses(execution.responses)
    const merged = existing.filter((r) => r.itemId !== itemId)
    merged.push(next)

    const progress = computeChecklistProgressPercent(items, merged)
    const isCompletedNow = progress === 100 && execution.completedAt === null
    const completedAt = isCompletedNow ? new Date() : undefined

    await prisma.checklistExecution.update({
      where: { id: executionId },
      data: {
        responses: merged as unknown as Prisma.InputJsonValue,
        progress,
        ...(completedAt ? { completedAt } : {}),
      },
    })
  }

  async getProgress(executionId: string): Promise<number> {
    const execution = await prisma.checklistExecution.findUnique({
      where: { id: executionId },
      include: { template: true },
    })

    if (!execution) {
      throw new Error('Checklist execution not found')
    }

    const items = parseTemplateItems(execution.template.items)
    const responses = parseResponses(execution.responses)
    return computeChecklistProgressPercent(items, responses)
  }

  async passAll(executionId: string): Promise<void> {
    const execution = await prisma.checklistExecution.findUnique({
      where: { id: executionId },
      include: { template: true },
    })

    if (!execution) {
      throw new Error('Checklist execution not found')
    }

    if (execution.completedAt !== null) {
      throw new Error('Cannot modify completed checklist execution')
    }

    const items = parseTemplateItems(execution.template.items)
    const ids = templateItemIds(items)
    const timestamp = new Date().toISOString()
    const merged: StoredResponse[] = ids.map((id) => ({
      itemId: id,
      result: 'PASS' as const,
      timestamp,
    }))

    const progress = computeChecklistProgressPercent(items, merged)
    const completedAt = progress === 100 ? new Date() : undefined

    await prisma.checklistExecution.update({
      where: { id: executionId },
      data: {
        responses: merged as unknown as Prisma.InputJsonValue,
        progress,
        ...(completedAt ? { completedAt } : {}),
      },
    })
  }

  /** Count checklist executions referencing a template (immutable-on-use rule). */
  async getTemplateUsageCount(templateId: string): Promise<number> {
    return prisma.checklistExecution.count({ where: { templateId } })
  }

  async isTemplateLocked(templateId: string): Promise<boolean> {
    const count = await this.getTemplateUsageCount(templateId)
    return count > 0
  }

  /** Admin list — includes inactive templates; optional discipline/search filters. */
  async listAllTemplates(options?: {
    discipline?: string
    search?: string
    includeInactive?: boolean
  }): Promise<(ChecklistTemplate & { usageCount: number })[]> {
    const discipline = options?.discipline?.trim()
    const search = options?.search?.trim()
    const rows = await prisma.checklistTemplate.findMany({
      where: {
        ...(options?.includeInactive ? {} : { isActive: true }),
        ...(discipline ? { discipline } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { discipline: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ discipline: 'asc' }, { name: 'asc' }, { version: 'desc' }],
    })
    const usageCounts = await Promise.all(rows.map((row) => this.getTemplateUsageCount(row.id)))
    return rows.map((row, index) => ({ ...row, usageCount: usageCounts[index] ?? 0 }))
  }

  async createTemplate(input: {
    name: string
    discipline: string
    items: AdminChecklistItemInput[]
    publish?: boolean
  }): Promise<ChecklistTemplate> {
    const items = normalizeAdminItems(input.items)
    const version = 1
    const versionHash = computeTemplateVersionHash({
      name: input.name.trim(),
      discipline: input.discipline.trim(),
      version,
      items,
    })
    const created = await prisma.checklistTemplate.create({
      data: {
        name: input.name.trim(),
        discipline: input.discipline.trim(),
        version,
        versionHash,
        items,
        isActive: input.publish === true,
      },
    })
    await invalidateChecklistTemplateCache()
    return created
  }

  async updateTemplate(
    id: string,
    input: {
      name?: string
      discipline?: string
      items?: AdminChecklistItemInput[]
      createNewVersion?: boolean
    },
  ): Promise<ChecklistTemplate> {
    const existing = await this.getTemplate(id)
    const locked = await this.isTemplateLocked(id)
    if (locked && !input.createNewVersion) {
      throw new Error('This template version is locked')
    }
    if (locked && input.createNewVersion) {
      return this.createNewVersion(id, input)
    }

    const name = input.name?.trim() ?? existing.name
    const discipline = input.discipline?.trim() ?? existing.discipline
    const items =
      input.items !== undefined
        ? normalizeAdminItems(input.items)
        : (existing.items as Prisma.InputJsonValue)
    const versionHash = computeTemplateVersionHash({
      name,
      discipline,
      version: existing.version,
      items,
    })

    const updated = await prisma.checklistTemplate.update({
      where: { id },
      data: { name, discipline, items, versionHash },
    })
    await invalidateChecklistTemplateCache()
    return updated
  }

  async createNewVersion(
    sourceId: string,
    input?: {
      name?: string
      discipline?: string
      items?: AdminChecklistItemInput[]
    },
  ): Promise<ChecklistTemplate> {
    const source = await this.getTemplate(sourceId)
    const name = input?.name?.trim() ?? source.name
    const discipline = input?.discipline?.trim() ?? source.discipline
    const items =
      input?.items !== undefined
        ? normalizeAdminItems(input.items)
        : (source.items as Prisma.InputJsonValue)
    const version = source.version + 1
    const versionHash = computeTemplateVersionHash({ name, discipline, version, items })

    const created = await prisma.checklistTemplate.create({
      data: {
        name,
        discipline,
        version,
        versionHash,
        items,
        isActive: false,
      },
    })
    await invalidateChecklistTemplateCache()
    return created
  }

  async publishTemplate(id: string): Promise<ChecklistTemplate> {
    await this.getTemplate(id)
    const updated = await prisma.checklistTemplate.update({
      where: { id },
      data: { isActive: true },
    })
    await invalidateChecklistTemplateCache()
    return updated
  }

  async archiveTemplate(id: string): Promise<ChecklistTemplate> {
    await this.getTemplate(id)
    const updated = await prisma.checklistTemplate.update({
      where: { id },
      data: { isActive: false },
    })
    await invalidateChecklistTemplateCache()
    return updated
  }
}

export const checklistService = new ChecklistService()
