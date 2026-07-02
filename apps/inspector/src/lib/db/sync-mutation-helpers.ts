/**
 * Shared HTTP + Dexie reconciliation helpers for inspector sync mutation processors.
 */

import type {
  CreateDeficiencyDTO,
  DeficiencyDTO,
  InspectionDTO,
  UpdateDeficiencyDTO,
} from '@codecomply/validators'
import {
  CreateDeficiencyDTOSchema,
  DeficiencyDTOSchema,
  InspectionDTOSchema,
  UpdateDeficiencyDTOSchema,
} from '@codecomply/validators'
import type { InspectorDB } from './dexie'
import type { CodeReference, LocalChecklist, LocalDeficiency, LocalInspection } from './types'

/**
 * Normalize API / Hono RPC codeReference (fields may be optional in inferred types)
 * into the strict local IndexedDB shape.
 */
export function toLocalCodeReference(
  ref:
    | DeficiencyDTO['codeReference']
    | CreateDeficiencyDTO['codeReference']
    | { code?: string; section?: string; title?: string; id?: string }
    | undefined,
): CodeReference | undefined {
  if (ref == null) return undefined
  const code = typeof ref.code === 'string' ? ref.code.trim() : ''
  const section = typeof ref.section === 'string' ? ref.section.trim() : ''
  if (!code || !section) return undefined
  const local: CodeReference = { code, section }
  if (ref.title !== undefined) local.title = ref.title
  return local
}

export function etagFromResponse(res: Response): string | undefined {
  const h = res.headers.get('ETag')
  if (!h) return undefined
  const v = h.trim()
  if (v.startsWith('W/"') && v.endsWith('"')) return v.slice(3, -1)
  if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1)
  return v
}

export function formatIfMatch(etag: string | undefined): Record<string, string> {
  if (!etag) return {}
  const v = etag.startsWith('"') ? etag : `"${etag}"`
  return { 'If-Match': v }
}

export async function readFriendlyErrorMessage(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const j = JSON.parse(text) as { error?: string; message?: string }
    const msg = j.message || j.error
    if (msg) return msg
  } catch {
    /* use raw text */
  }
  return text || `Request failed (${res.status})`
}

export function deficiencyDtoToLocal(
  dto: DeficiencyDTO,
  createdById: string,
  opts?: { etag?: string; isDirty?: boolean; syncedAt?: string },
): LocalDeficiency {
  return {
    id: dto.id,
    clientId: dto.clientId,
    inspectionId: dto.inspectionId,
    checklistItemId: dto.checklistItemId,
    createdById,
    description: dto.description,
    location: dto.location,
    severity: dto.severity,
    status: dto.status,
    codeReference: toLocalCodeReference(dto.codeReference),
    isStopWork: dto.isStopWork,
    isUnsafe: dto.isUnsafe,
    dueDate: dto.dueDate,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    isDirty: opts?.isDirty ?? false,
    etag: opts?.etag,
    syncedAt: opts?.syncedAt ?? dto.updatedAt,
  }
}

export function buildCreateDeficiencyBody(payload: Record<string, unknown>): CreateDeficiencyDTO {
  const clientId = payload.clientId as string
  const inspectionId = payload.inspectionId as string
  const description = payload.description as string
  if (!clientId || !inspectionId || !description) {
    throw new Error('deficiency.create: clientId, inspectionId, and description are required')
  }
  return CreateDeficiencyDTOSchema.parse({
    clientId,
    inspectionId,
    checklistItemId: payload.checklistItemId as string | undefined,
    description,
    location: payload.location as string | undefined,
    severity: (payload.severity as CreateDeficiencyDTO['severity']) ?? 'MAJOR',
    codeReference: payload.codeReference as CreateDeficiencyDTO['codeReference'],
    isStopWork: Boolean(payload.isStopWork),
    isUnsafe: Boolean(payload.isUnsafe),
    dueDate: payload.dueDate as string | undefined,
  })
}

export function buildUpdateDeficiencyBody(payload: Record<string, unknown>): UpdateDeficiencyDTO {
  const body: UpdateDeficiencyDTO = {}
  if (payload.description !== undefined) body.description = payload.description as string
  if (payload.location !== undefined) body.location = payload.location as string
  if (payload.severity !== undefined) {
    body.severity = payload.severity as UpdateDeficiencyDTO['severity']
  }
  if (payload.status !== undefined) body.status = payload.status as UpdateDeficiencyDTO['status']
  if (payload.codeReference !== undefined) {
    body.codeReference = payload.codeReference as UpdateDeficiencyDTO['codeReference']
  }
  if (payload.isStopWork !== undefined) body.isStopWork = Boolean(payload.isStopWork)
  if (payload.isUnsafe !== undefined) body.isUnsafe = Boolean(payload.isUnsafe)
  if (payload.dueDate !== undefined) body.dueDate = payload.dueDate as string
  if (payload.checklistItemId !== undefined) {
    body.checklistItemId = payload.checklistItemId as string
  }
  return UpdateDeficiencyDTOSchema.parse(body)
}

export async function reconcileDeficiencyFromServer(
  dexie: InspectorDB,
  previousLocalId: string,
  dto: DeficiencyDTO,
  createdById: string,
  etag?: string,
): Promise<void> {
  const syncedAt = new Date().toISOString()
  const row = deficiencyDtoToLocal(dto, createdById, {
    etag,
    isDirty: false,
    syncedAt,
  })
  if (previousLocalId !== dto.id) {
    await dexie.deficiencies.delete(previousLocalId)
  }
  await dexie.deficiencies.put(row)
}

export function inspectionDtoToLocal(
  dto: InspectionDTO,
  prev: LocalInspection | undefined,
  opts?: { isDirty?: boolean; syncedAt?: string },
): LocalInspection {
  const syncedAt = opts?.syncedAt ?? new Date().toISOString()
  return {
    id: dto.id,
    clientId: prev?.clientId ?? dto.id,
    permitId: dto.permitId ?? prev?.permitId ?? '',
    permitNumber: prev?.permitNumber,
    permitAddress: prev?.permitAddress,
    status: dto.status,
    scheduledDate: dto.scheduledDate,
    completedDate: dto.completedDate ?? prev?.completedDate,
    durationSeconds: prev?.durationSeconds,
    notes: dto.notes ?? prev?.notes,
    assignedInspectorId: dto.assignedInspectorId ?? prev?.assignedInspectorId,
    assignedToId: dto.assignedInspectorId ?? prev?.assignedToId ?? '',
    startLatitude: prev?.startLatitude,
    startLongitude: prev?.startLongitude,
    finalizeLatitude: prev?.finalizeLatitude,
    finalizeLongitude: prev?.finalizeLongitude,
    finalizeAccuracy: prev?.finalizeAccuracy,
    outcome: prev?.outcome,
    signatureDataUrl: prev?.signatureDataUrl,
    certificationSnapshot: prev?.certificationSnapshot,
    createdAt: dto.createdAt ?? prev?.createdAt ?? syncedAt,
    updatedAt: dto.updatedAt ?? syncedAt,
    syncedAt,
    isDirty: opts?.isDirty ?? false,
    etag: prev?.etag,
  }
}

export async function markInspectionSynced(
  dexie: InspectorDB,
  inspectionId: string,
  patch?: Partial<LocalInspection>,
): Promise<void> {
  const row = await dexie.inspections.get(inspectionId)
  if (!row) return
  const syncedAt = new Date().toISOString()
  await dexie.inspections.put({
    ...row,
    ...patch,
    isDirty: false,
    syncedAt,
    updatedAt: syncedAt,
  })
}

export async function reconcileChecklistFromExecution(
  dexie: InspectorDB,
  executionId: string,
  progress: number,
  completedAt?: string,
): Promise<void> {
  const row = await dexie.checklists.get(executionId)
  if (!row) return
  const syncedAt = new Date().toISOString()
  const updated: LocalChecklist = {
    ...row,
    progress,
    completedAt: completedAt ?? row.completedAt,
    isDirty: false,
    syncedAt,
    updatedAt: syncedAt,
  }
  await dexie.checklists.put(updated)
}

export function parseDeficiencyDto(text: string): DeficiencyDTO {
  const parsed = DeficiencyDTOSchema.safeParse(JSON.parse(text))
  if (!parsed.success) {
    throw new Error('Invalid deficiency response from server')
  }
  return parsed.data
}

/** Resolve server id when queue payload still references an offline/optimistic local id. */
export async function resolveDeficiencyServerId(
  dexie: InspectorDB,
  payload: Record<string, unknown>,
): Promise<string> {
  const payloadId = payload.id as string | undefined
  if (!payloadId) {
    throw new Error('deficiency.update: id is required')
  }
  if (!payloadId.startsWith('offline-') && !payloadId.startsWith('optimistic-')) {
    return payloadId
  }
  const clientId = payload.clientId as string | undefined
  if (clientId) {
    const current = await dexie.deficiencies.where('clientId').equals(clientId).first()
    if (current && !current.id.startsWith('offline-') && !current.id.startsWith('optimistic-')) {
      return current.id
    }
  }
  return payloadId
}

export function parseInspectionDto(text: string): InspectionDTO {
  const parsed = InspectionDTOSchema.safeParse(JSON.parse(text))
  if (!parsed.success) {
    throw new Error('Invalid inspection response from server')
  }
  return parsed.data
}
