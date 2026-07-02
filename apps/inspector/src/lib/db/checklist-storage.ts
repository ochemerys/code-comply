/**
 * Checklist execution persistence in IndexedDB (M5-S16).
 *
 * Stores each item response in `checklistResponses` with stable ids
 * `cr:{executionId}:{itemId}` (executionId === checklistId in Dexie).
 * Enqueues `checklistResponse.update` on change for SyncEngine.
 *
 * @module lib/db/checklist-storage
 */

import {
  ChecklistExecutionDTOSchema,
  ChecklistItemDTOSchema,
  ChecklistResponseDTOSchema,
  computeChecklistExecutionProgress,
  type ChecklistExecutionDTO,
  type ChecklistItemDTO,
  type ChecklistResponseDTO,
} from '@codecomply/validators'
import { db as defaultDb, type InspectorDB } from './dexie'
import { toLocalCodeReference } from './sync-mutation-helpers'
import { syncEngine as defaultSyncEngine } from './sync-engine'
import type { LocalChecklist, LocalChecklistResponse } from './types'
import { ChecklistTemplateUnavailableError } from './checklist-template-errors'
import { readDefaultChecklistTemplateRef } from './checklist-template-prefetch'

export {
  ChecklistTemplateUnavailableError,
  isChecklistTemplateUnavailableError,
} from './checklist-template-errors'

/** Strip Vue proxies / non-cloneable refs before IndexedDB (structured clone). */
function toPlainExecution(execution: ChecklistExecutionDTO): ChecklistExecutionDTO {
  return ChecklistExecutionDTOSchema.parse(JSON.parse(JSON.stringify(execution)))
}

/** Stable primary key and compound index checklistId+itemId (executionId === checklistId). */
export function checklistResponseRowId(executionId: string, itemId: string): string {
  return `cr:${executionId}:${itemId}`
}

/** Stable sync queue client id for deduplication. */
export function checklistResponseQueueClientId(executionId: string, itemId: string): string {
  return `checklistResponse:${executionId}:${itemId}`
}

/** Normalize DTO rows (Zod input/output) for progress calculation. */
function executionProgressInputs(
  templateItems: ChecklistItemDTO[],
  responses: ChecklistResponseDTO[],
): {
  items: Array<{ id: string; isRequired?: boolean }>
  responses: Array<{ itemId: string }>
} {
  return {
    items: templateItems.map((item) => {
      const parsed = ChecklistItemDTOSchema.parse(item)
      return { id: parsed.id, isRequired: parsed.isRequired }
    }),
    responses: responses.map((response) => {
      const parsed = ChecklistResponseDTOSchema.parse(response)
      return { itemId: parsed.itemId }
    }),
  }
}

export interface ChecklistStorageContext {
  database?: InspectorDB
  syncEngine?: { queueMutation: typeof defaultSyncEngine.queueMutation }
}

function getDb(ctx?: ChecklistStorageContext): InspectorDB {
  return ctx?.database ?? defaultDb
}

function getSync(ctx?: ChecklistStorageContext) {
  return ctx?.syncEngine ?? defaultSyncEngine
}

export function localChecklistResponseToDto(row: LocalChecklistResponse): ChecklistResponseDTO {
  return ChecklistResponseDTOSchema.parse({
    itemId: row.itemId,
    result: row.result,
    codeReference: row.codeReference,
    notes: row.notes,
    timestamp: row.respondedAt,
  })
}

/**
 * Merge server execution responses with local IndexedDB rows after reload.
 * Local FAIL+codeReference wins when the server row is FAIL without code (sync lag / partial push).
 * Local-only rows are kept; per-item winner is the newer timestamp when both are complete.
 */
export function mergeChecklistExecutionResponses(
  remote: ChecklistResponseDTO[],
  stored: ChecklistResponseDTO[],
): ChecklistResponseDTO[] {
  const storedByItem = new Map(stored.map((r) => [r.itemId, r]))
  const remoteIds = new Set(remote.map((r) => r.itemId))
  const merged: ChecklistResponseDTO[] = []

  for (const remoteRow of remote) {
    const local = storedByItem.get(remoteRow.itemId)
    if (!local) {
      merged.push(remoteRow)
      continue
    }
    if (
      remoteRow.result === 'FAIL' &&
      !remoteRow.codeReference &&
      local.result === 'FAIL' &&
      local.codeReference
    ) {
      merged.push({ ...remoteRow, codeReference: local.codeReference })
      continue
    }
    if (local.result === remoteRow.result && local.codeReference && !remoteRow.codeReference) {
      merged.push({ ...local, timestamp: local.timestamp })
      continue
    }
    const remoteTs = Date.parse(remoteRow.timestamp)
    const localTs = Date.parse(local.timestamp)
    merged.push(localTs > remoteTs ? local : remoteRow)
  }

  for (const local of stored) {
    if (!remoteIds.has(local.itemId)) {
      merged.push(local)
    }
  }

  return merged
}

function dtoToLocalRow(
  executionId: string,
  dto: ChecklistResponseDTO,
  updatedAt: string,
  isDirty: boolean,
  syncedAt?: string,
): LocalChecklistResponse {
  return {
    id: checklistResponseRowId(executionId, dto.itemId),
    checklistId: executionId,
    itemId: dto.itemId,
    result: dto.result,
    codeReference: toLocalCodeReference(dto.codeReference),
    notes: dto.notes,
    respondedAt: dto.timestamp,
    updatedAt,
    isDirty,
    syncedAt,
  }
}

export async function removePendingChecklistResponseSyncItems(
  dexie: InspectorDB,
  executionId: string,
  itemId: string,
): Promise<void> {
  const clientId = checklistResponseQueueClientId(executionId, itemId)
  await dexie.syncQueue
    .filter((x) => x.clientId === clientId && x.operation === 'checklistResponse.update')
    .delete()
}

async function enqueueChecklistResponseSync(
  dexie: InspectorDB,
  sync: { queueMutation: typeof defaultSyncEngine.queueMutation },
  execution: ChecklistExecutionDTO,
  dto: ChecklistResponseDTO,
): Promise<void> {
  const executionId = execution.id
  const clientId = checklistResponseQueueClientId(executionId, dto.itemId)
  await removePendingChecklistResponseSyncItems(dexie, executionId, dto.itemId)
  const row = await dexie.checklistResponses.get(checklistResponseRowId(executionId, dto.itemId))
  await sync.queueMutation(
    'checklistResponse.update',
    {
      clientId,
      executionId,
      inspectionId: execution.inspectionId,
      checklistId: executionId,
      templateId: execution.templateId,
      versionHash: execution.versionHash,
      itemId: dto.itemId,
      result: dto.result,
      codeReference: dto.codeReference,
      notes: dto.notes,
      timestamp: dto.timestamp,
      updatedAt: row?.updatedAt ?? new Date().toISOString(),
    },
    15,
  )
}

async function upsertChecklistMetadataRow(
  dexie: InspectorDB,
  ex: ChecklistExecutionDTO,
  now: string,
): Promise<void> {
  const existing = await dexie.checklists.get(ex.id)
  const row: LocalChecklist = {
    id: ex.id,
    inspectionId: ex.inspectionId,
    templateId: ex.templateId,
    versionHash: ex.versionHash,
    responses: ex.responses,
    progress: ex.progress ?? existing?.progress ?? 0,
    completedAt: ex.completedAt ?? existing?.completedAt,
    templateName: existing?.templateName ?? 'Checklist',
    discipline: existing?.discipline ?? 'Building',
    items: existing?.items ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    isDirty: true,
    syncedAt: existing?.syncedAt,
  }
  await dexie.checklists.put(row)
}

/**
 * Persists all responses for an execution and optionally enqueues sync per item.
 * Removes stored rows for items no longer present in `execution.responses`.
 */
export async function persistChecklistExecutionState(
  execution: ChecklistExecutionDTO,
  options?: ChecklistStorageContext & { queueSync?: boolean },
): Promise<void> {
  const dexie = getDb(options)
  const ex = toPlainExecution(execution)
  const now = new Date().toISOString()
  const queueSync = options?.queueSync !== false

  await upsertChecklistMetadataRow(dexie, ex, now)

  for (const dto of ex.responses) {
    ChecklistResponseDTOSchema.parse(dto)
    const row = dtoToLocalRow(ex.id, dto, now, true)
    await dexie.checklistResponses.put(row)
    if (queueSync) {
      await enqueueChecklistResponseSync(dexie, getSync(options), ex, dto)
    }
  }

  const kept = new Set(ex.responses.map((r) => r.itemId))
  const existing = await dexie.checklistResponses.where('checklistId').equals(ex.id).toArray()
  for (const row of existing) {
    if (!kept.has(row.itemId)) {
      await dexie.checklistResponses.delete(row.id)
      await removePendingChecklistResponseSyncItems(dexie, ex.id, row.itemId)
    }
  }
}

/**
 * Loads execution aggregate from IndexedDB. Returns progress from template items + stored responses.
 */
/**
 * Resolves immutable template identity for an execution. Never invents placeholder hashes.
 */
export async function loadExecutionTemplateRef(
  executionId: string,
  options?: ChecklistStorageContext & {
    remote?: Pick<ChecklistExecutionDTO, 'templateId' | 'versionHash'> | null
  },
): Promise<{ templateId: string; versionHash: string }> {
  const remote = options?.remote
  if (remote?.templateId?.trim() && remote?.versionHash?.trim()) {
    return { templateId: remote.templateId.trim(), versionHash: remote.versionHash.trim() }
  }

  const dexie = getDb(options)
  const row = await dexie.checklists.get(executionId)
  if (row?.templateId?.trim() && row?.versionHash?.trim()) {
    return { templateId: row.templateId.trim(), versionHash: row.versionHash.trim() }
  }

  if (executionId.startsWith('local-')) {
    const defaultRef = readDefaultChecklistTemplateRef()
    if (defaultRef) return defaultRef
  }

  throw new ChecklistTemplateUnavailableError()
}

export async function loadChecklistExecutionFromStorage(
  base: Pick<ChecklistExecutionDTO, 'id' | 'inspectionId' | 'templateId' | 'versionHash'>,
  templateItems: ChecklistItemDTO[],
  options?: ChecklistStorageContext,
): Promise<ChecklistExecutionDTO> {
  const dexie = getDb(options)
  const rows = await dexie.checklistResponses.where('checklistId').equals(base.id).toArray()
  const responses = rows.map((r) => localChecklistResponseToDto(r))
  const { items: progressItems, responses: progressResponses } = executionProgressInputs(
    templateItems,
    responses,
  )
  const progress = computeChecklistExecutionProgress(progressItems, progressResponses)
  return {
    id: base.id,
    inspectionId: base.inspectionId,
    templateId: base.templateId,
    versionHash: base.versionHash,
    responses,
    progress,
  }
}

/**
 * Last-write-wins merge when pulling server state: newer `serverUpdatedAt` overwrites local
 * unless the local row is newer (inspector device wins for concurrent edits).
 */
export async function mergeServerChecklistResponses(
  executionId: string,
  serverRows: Array<{ response: ChecklistResponseDTO; serverUpdatedAt: string }>,
  options?: ChecklistStorageContext,
): Promise<void> {
  const dexie = getDb(options)
  for (const { response, serverUpdatedAt } of serverRows) {
    ChecklistResponseDTOSchema.parse(response)
    const id = checklistResponseRowId(executionId, response.itemId)
    const local = await dexie.checklistResponses.get(id)
    if (!local) {
      await dexie.checklistResponses.put(
        dtoToLocalRow(executionId, response, serverUpdatedAt, false, serverUpdatedAt),
      )
      continue
    }
    if (local.updatedAt > serverUpdatedAt) {
      continue
    }
    await dexie.checklistResponses.put(
      dtoToLocalRow(executionId, response, serverUpdatedAt, false, serverUpdatedAt),
    )
  }
}

/**
 * After a successful server sync for one item: clear dirty flag and drop pending queue rows.
 */
export async function markChecklistResponseSyncedAfterSuccessfulPush(
  executionId: string,
  itemId: string,
  options?: ChecklistStorageContext & { serverUpdatedAt?: string },
): Promise<void> {
  const dexie = getDb(options)
  const id = checklistResponseRowId(executionId, itemId)
  const row = await dexie.checklistResponses.get(id)
  if (!row) return
  const syncedAt = new Date().toISOString()
  await dexie.checklistResponses.update(id, {
    isDirty: false,
    syncedAt,
    ...(options?.serverUpdatedAt ? { updatedAt: options.serverUpdatedAt } : {}),
  })
  await removePendingChecklistResponseSyncItems(dexie, executionId, itemId)
}

/**
 * Server rejects the PATCH permanently (404 execution, or immutable completed execution).
 * Drop duplicate queue rows and clear dirty so SyncEngine does not retry until maxAttempts.
 */
export async function clearChecklistResponseSyncAfterExecutionMissingOnServer(
  executionId: string,
  itemId: string,
  options?: ChecklistStorageContext,
): Promise<void> {
  const dexie = getDb(options)
  await removePendingChecklistResponseSyncItems(dexie, executionId, itemId)
  const id = checklistResponseRowId(executionId, itemId)
  const row = await dexie.checklistResponses.get(id)
  if (!row) return
  await dexie.checklistResponses.update(id, { isDirty: false })
}

/**
 * One-shot migration from legacy localStorage draft key used by ChecklistExecutionView.
 */
export async function migrateChecklistExecutionFromLocalStorage(
  storageKey: string,
  expected: { executionId: string; inspectionId: string },
  options?: ChecklistStorageContext,
): Promise<void> {
  if (typeof localStorage === 'undefined') return
  const raw = localStorage.getItem(storageKey)
  if (!raw) return
  try {
    const parsed = ChecklistExecutionDTOSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return
    const ex = parsed.data
    if (ex.id !== expected.executionId || ex.inspectionId !== expected.inspectionId) return
    await persistChecklistExecutionState(ex, { ...options, queueSync: false })
    localStorage.removeItem(storageKey)
  } catch {
    /* ignore invalid draft */
  }
}
