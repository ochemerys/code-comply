/**
 * Maps queued sync operations to API calls for the inspector app.
 *
 * @see M5-S14-B1 — checklistResponse.update must be processed when online.
 */

import { getApiBaseUrl } from '@/lib/api-base'
import { apiFetch } from '@/utils/api-fetch'
import { db } from './dexie'
import type { InspectorDB } from './dexie'
import type { MutationProcessor } from './sync-engine'
import type { LocalInspection, SyncOperation } from './types'
import {
  clearChecklistResponseSyncAfterExecutionMissingOnServer,
  markChecklistResponseSyncedAfterSuccessfulPush,
} from './checklist-storage'
import {
  abandonPhotoUploadAfterInspectionMissingOnServer,
  applyServerPhotoAfterUpload,
  getOfflinePhoto,
} from './photo-storage'
import {
  ChecklistExecutionDTOSchema,
  ChecklistResponseDTOSchema,
  PhotoDTOSchema,
  SubmitVoCDTOSchema,
  UpdateInspectionDTOSchema,
  type PhotoDTO,
} from '@codecomply/validators'
import { syncAssignedPermitsFromApi } from './assigned-permits-sync'
import {
  buildCreateDeficiencyBody,
  buildUpdateDeficiencyBody,
  etagFromResponse,
  formatIfMatch,
  inspectionDtoToLocal,
  markInspectionSynced,
  parseDeficiencyDto,
  parseInspectionDto,
  readFriendlyErrorMessage,
  reconcileChecklistFromExecution,
  reconcileDeficiencyFromServer,
  resolveDeficiencyServerId,
} from './sync-mutation-helpers'

/**
 * GET /executions/:id already showed missing or completed; remaining queued checklistResponse rows
 * for this execution can be cleared without another round trip.
 */
const checklistExecutionTerminalIds = new Set<string>()

function rememberTerminalChecklistExecution(executionId: string) {
  checklistExecutionTerminalIds.add(executionId)
  if (checklistExecutionTerminalIds.size > 250) {
    checklistExecutionTerminalIds.clear()
  }
}

function isChecklistExecutionNotFoundResponse(status: number, bodyText: string): boolean {
  if (status !== 404) return false
  if (/checklist execution not found/i.test(bodyText)) return true
  try {
    const o = JSON.parse(bodyText) as { error?: string }
    return typeof o.error === 'string' && /checklist execution not found/i.test(o.error)
  } catch {
    return false
  }
}

function isCannotModifyCompletedChecklistResponse(status: number, bodyText: string): boolean {
  if (status !== 400) return false
  if (/cannot modify completed checklist execution/i.test(bodyText)) return true
  try {
    const o = JSON.parse(bodyText) as { error?: string }
    return (
      typeof o.error === 'string' && /cannot modify completed checklist execution/i.test(o.error)
    )
  } catch {
    return false
  }
}

function isInspectionNotFoundPhotoUpload(status: number, bodyText: string): boolean {
  if (status !== 404) return false
  if (/inspection not found/i.test(bodyText)) return true
  try {
    const o = JSON.parse(bodyText) as { error?: string }
    return typeof o.error === 'string' && /inspection not found/i.test(o.error)
  } catch {
    return false
  }
}

function apiPrefix(): string {
  const base = getApiBaseUrl()
  return base ? `${base}/api` : '/api'
}

function toFinalizeOutcome(payload: Record<string, unknown>): 'PASSED' | 'FAILED' {
  const explicit = payload.status
  if (explicit === 'PASSED' || explicit === 'FAILED') return explicit

  const o = payload.outcome
  // LocalInspection.outcome values:
  // - ACCEPTABLE / ACCEPTABLE_WITH_CONDITIONS => PASSED
  // - REFUSED => FAILED
  if (o === 'REFUSED') return 'FAILED'
  return 'PASSED'
}

function toFinalizeGps(payload: Record<string, unknown>): {
  latitude: number
  longitude: number
  accuracy?: number
  timestamp: string
} {
  const tsRaw = payload.finalizedAt ?? payload.completedDate
  const timestamp =
    typeof tsRaw === 'string' && tsRaw.trim().length > 0 ? tsRaw.trim() : new Date().toISOString()

  const latRaw = payload.finalizeLatitude
  const lonRaw = payload.finalizeLongitude
  const accRaw = payload.finalizeAccuracy

  const latitude = typeof latRaw === 'number' && Number.isFinite(latRaw) ? latRaw : 0
  const longitude = typeof lonRaw === 'number' && Number.isFinite(lonRaw) ? lonRaw : 0
  const accuracy = typeof accRaw === 'number' && Number.isFinite(accRaw) ? accRaw : undefined

  return { latitude, longitude, ...(accuracy !== undefined ? { accuracy } : {}), timestamp }
}

async function markInspectionFinalizationSynced(
  dexie: InspectorDB,
  inspectionId: string,
  syncedAt: string,
): Promise<void> {
  const row = await dexie.inspections.get(inspectionId)
  if (!row) return
  const updated: LocalInspection = {
    ...row,
    isDirty: false,
    syncedAt,
    updatedAt: syncedAt,
  }
  await dexie.inspections.put(updated)
}

function buildChecklistResponsePatchBody(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    itemId: payload.itemId,
    result: payload.result,
    timestamp: payload.timestamp,
  }
  if (payload.codeReference !== undefined) body.codeReference = payload.codeReference
  if (payload.notes !== undefined) body.notes = payload.notes
  return body
}

export type InspectorSyncMutationProcessorOptions = {
  dexie?: InspectorDB
}

/**
 * Factory so tests can be written without touching the global `syncEngine` singleton.
 */
export function createInspectorSyncMutationProcessor(
  options: InspectorSyncMutationProcessorOptions = {},
): MutationProcessor {
  const dexie = options.dexie ?? db

  return async (operation: SyncOperation, payload: Record<string, unknown>) => {
    switch (operation) {
      case 'inspection.finalize': {
        const inspectionId = payload.inspectionId as string
        if (!inspectionId) {
          throw new Error('inspection.finalize: inspectionId is required')
        }

        const signature = payload.signatureDataUrl as string | undefined
        if (!signature || signature.trim().length === 0) {
          throw new Error('inspection.finalize: signatureDataUrl is required')
        }

        const res = await apiFetch(
          `${apiPrefix()}/inspections/${encodeURIComponent(inspectionId)}/finalize`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              signature,
              outcome: toFinalizeOutcome(payload),
              gps: toFinalizeGps(payload),
            }),
          },
        )

        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || `Inspection finalize failed (${res.status})`)
        }

        await markInspectionFinalizationSynced(dexie, inspectionId, new Date().toISOString())
        return { ok: true }
      }
      case 'photo.upload': {
        const photoId = payload.photoId as string
        if (!photoId) {
          throw new Error('photo.upload: photoId is required')
        }
        const local = await getOfflinePhoto(dexie, photoId)
        if (!local) {
          throw new Error('photo.upload: local photo not found')
        }
        if (!local.blob) {
          throw new Error('photo.upload: blob missing (re-capture or restore photo before sync)')
        }

        const form = new FormData()
        form.append('file', local.blob, local.filename)
        form.append('clientId', local.clientId)
        form.append('inspectionId', local.inspectionId)
        form.append('metadata', JSON.stringify(local.metadata))
        if (local.deficiencyId) form.append('deficiencyId', local.deficiencyId)
        if (local.checklistItemId) form.append('checklistItemId', local.checklistItemId)
        if (local.annotations !== undefined && local.annotations !== '') {
          form.append('annotations', local.annotations)
        }

        const res = await apiFetch(`${apiPrefix()}/photos`, { method: 'POST', body: form })
        const text = await res.text()

        // Handle both 201 (created) and 200 (idempotent) as success
        if (!res.ok && res.status !== 200) {
          if (isInspectionNotFoundPhotoUpload(res.status, text)) {
            await abandonPhotoUploadAfterInspectionMissingOnServer(dexie, photoId)
            return { dropped: true }
          }
          throw new Error(
            `Photo upload failed (${res.status}): ${text || 'No error details provided'}`,
          )
        }

        let dto: PhotoDTO
        try {
          dto = PhotoDTOSchema.parse(JSON.parse(text))
        } catch {
          throw new Error('photo.upload: invalid JSON response')
        }
        await applyServerPhotoAfterUpload(dexie, photoId, {
          id: dto.id,
          clientId: dto.clientId,
          storageKey: dto.storageKey,
          syncedAt: dto.syncedAt ?? undefined,
        })
        return { ok: true }
      }
      case 'photo.delete': {
        const photoId = payload.photoId as string
        const clientId = payload.clientId as string | undefined
        if (!photoId) {
          throw new Error('photo.delete: photoId is required')
        }
        const q = clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''
        const res = await apiFetch(`${apiPrefix()}/photos/${encodeURIComponent(photoId)}${q}`, {
          method: 'DELETE',
        })

        // Idempotent: 2xx and 404 are success
        if (res.ok || res.status === 404) {
          return { ok: true }
        }

        const text = await res.text()
        throw new Error(
          `Photo delete failed (${res.status}): ${text || 'No error details provided'}`,
        )
      }
      case 'checklistResponse.update': {
        const executionId = payload.executionId as string
        if (!executionId || typeof payload.itemId !== 'string') {
          throw new Error('checklistResponse.update: executionId and itemId are required')
        }

        if (checklistExecutionTerminalIds.has(executionId)) {
          await clearChecklistResponseSyncAfterExecutionMissingOnServer(executionId, payload.itemId)
          return { dropped: true }
        }

        const base = apiPrefix()
        const getRes = await apiFetch(
          `${base}/checklists/executions/${encodeURIComponent(executionId)}`,
        )

        if (getRes.status === 404) {
          rememberTerminalChecklistExecution(executionId)
          await clearChecklistResponseSyncAfterExecutionMissingOnServer(executionId, payload.itemId)
          return { dropped: true }
        }

        if (getRes.ok) {
          const rawText = await getRes.text()
          try {
            const parsed = ChecklistExecutionDTOSchema.safeParse(JSON.parse(rawText))
            if (parsed.success && parsed.data.completedAt) {
              rememberTerminalChecklistExecution(executionId)
              await clearChecklistResponseSyncAfterExecutionMissingOnServer(
                executionId,
                payload.itemId,
              )
              return { dropped: true }
            }
          } catch {
            /* fall through to PATCH */
          }
        }

        const url = `${base}/checklists/executions/${encodeURIComponent(executionId)}/responses`
        const res = await apiFetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            ChecklistResponseDTOSchema.parse(buildChecklistResponsePatchBody(payload)),
          ),
        })
        if (!res.ok) {
          const text = await res.text()
          if (isChecklistExecutionNotFoundResponse(res.status, text)) {
            rememberTerminalChecklistExecution(executionId)
            await clearChecklistResponseSyncAfterExecutionMissingOnServer(
              executionId,
              payload.itemId,
            )
            return { dropped: true }
          }
          if (isCannotModifyCompletedChecklistResponse(res.status, text)) {
            rememberTerminalChecklistExecution(executionId)
            await clearChecklistResponseSyncAfterExecutionMissingOnServer(
              executionId,
              payload.itemId,
            )
            return { dropped: true }
          }
          throw new Error(text || `Checklist response sync failed (${res.status})`)
        }
        await markChecklistResponseSyncedAfterSuccessfulPush(executionId, payload.itemId)
        return { ok: true }
      }
      case 'deficiency.create': {
        const body = buildCreateDeficiencyBody(payload)
        const localId =
          (payload.id as string) ||
          (typeof payload.clientId === 'string' ? `offline-${payload.clientId}` : '')
        const createdById = (payload.createdById as string) || 'offline-user'

        const res = await apiFetch(`${apiPrefix()}/deficiencies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const text = await res.text()

        if (res.status === 404) {
          if (localId) await dexie.deficiencies.delete(localId).catch(() => {})
          return { dropped: true }
        }

        if (!res.ok) {
          throw new Error(await readFriendlyErrorMessage(res))
        }

        const dto = parseDeficiencyDto(text)
        await reconcileDeficiencyFromServer(
          dexie,
          localId || dto.id,
          dto,
          createdById,
          etagFromResponse(res),
        )
        return { ok: true }
      }
      case 'deficiency.update': {
        const deficiencyId = await resolveDeficiencyServerId(dexie, payload)

        const local =
          (await dexie.deficiencies.get(deficiencyId)) ??
          (typeof payload.clientId === 'string'
            ? await dexie.deficiencies.where('clientId').equals(payload.clientId).first()
            : undefined) ??
          (typeof payload.id === 'string' ? await dexie.deficiencies.get(payload.id) : undefined)
        const createdById =
          local?.createdById ?? ((payload.createdById as string) || 'offline-user')
        const mergePayload = local ? { ...local, ...payload } : payload
        const patchBody = buildUpdateDeficiencyBody(mergePayload)
        const etag = local?.etag ?? (payload.etag as string | undefined)

        const res = await apiFetch(
          `${apiPrefix()}/deficiencies/${encodeURIComponent(deficiencyId)}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...formatIfMatch(etag),
            },
            body: JSON.stringify(patchBody),
          },
        )
        const text = await res.text()

        if (res.status === 404) {
          const offlineOnly =
            deficiencyId.startsWith('offline-') || deficiencyId.startsWith('optimistic-')
          if (offlineOnly) {
            throw new Error(
              'Deficiency is not on the server yet; sync will retry after create completes',
            )
          }
          if (local) await dexie.deficiencies.delete(local.id)
          return { dropped: true }
        }

        if (res.status === 409) {
          const serverId = local?.id && !local.id.startsWith('offline-') ? local.id : deficiencyId
          const getRes = await apiFetch(
            `${apiPrefix()}/deficiencies/${encodeURIComponent(serverId)}`,
          )
          if (!getRes.ok) {
            throw new Error(await readFriendlyErrorMessage(getRes))
          }
          const serverDto = parseDeficiencyDto(await getRes.text())
          await reconcileDeficiencyFromServer(
            dexie,
            local?.id ?? deficiencyId,
            serverDto,
            createdById,
            etagFromResponse(getRes),
          )
          return { ok: true, conflict: true }
        }

        if (!res.ok) {
          throw new Error(await readFriendlyErrorMessage(res))
        }

        const dto = parseDeficiencyDto(text)
        await reconcileDeficiencyFromServer(
          dexie,
          local?.id ?? deficiencyId,
          dto,
          createdById,
          etagFromResponse(res),
        )
        return { ok: true }
      }
      case 'deficiency.delete': {
        const deficiencyId = payload.id as string
        if (!deficiencyId) {
          throw new Error('deficiency.delete: id is required')
        }

        const res = await apiFetch(
          `${apiPrefix()}/deficiencies/${encodeURIComponent(deficiencyId)}`,
          { method: 'DELETE' },
        )

        if (res.ok || res.status === 404) {
          return { ok: true }
        }

        throw new Error(await readFriendlyErrorMessage(res))
      }
      case 'inspection.update': {
        const inspectionId = payload.id as string
        if (!inspectionId) {
          throw new Error('inspection.update: id is required')
        }

        const local = await dexie.inspections.get(inspectionId)
        const patchBody: Record<string, string> = {}
        if (local?.notes !== undefined) patchBody.notes = local.notes
        if (local?.scheduledDate) patchBody.scheduledDate = local.scheduledDate
        const body = UpdateInspectionDTOSchema.parse(patchBody)

        const res = await apiFetch(
          `${apiPrefix()}/inspections/${encodeURIComponent(inspectionId)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
        )
        const text = await res.text()

        if (res.status === 404) {
          return { dropped: true }
        }

        if (res.status === 409) {
          const getRes = await apiFetch(
            `${apiPrefix()}/inspections/${encodeURIComponent(inspectionId)}`,
          )
          if (!getRes.ok) {
            throw new Error(await readFriendlyErrorMessage(getRes))
          }
          const dto = parseInspectionDto(await getRes.text())
          await dexie.inspections.put(
            inspectionDtoToLocal(dto, local ?? undefined, { isDirty: false }),
          )
          return { ok: true, conflict: true }
        }

        if (!res.ok) {
          throw new Error(await readFriendlyErrorMessage(res))
        }

        const dto = parseInspectionDto(text)
        await dexie.inspections.put(
          inspectionDtoToLocal(dto, local ?? undefined, { isDirty: false }),
        )
        return { ok: true }
      }
      case 'inspection.create': {
        const inspectionId = payload.id as string
        if (!inspectionId) {
          throw new Error('inspection.create: id is required')
        }

        const res = await apiFetch(
          `${apiPrefix()}/inspections/${encodeURIComponent(inspectionId)}`,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } },
        )

        if (res.status === 404) {
          await markInspectionSynced(dexie, inspectionId)
          return { dropped: true }
        }

        if (!res.ok) {
          throw new Error(await readFriendlyErrorMessage(res))
        }

        const local = await dexie.inspections.get(inspectionId)
        const dto = parseInspectionDto(await res.text())
        await dexie.inspections.put(
          inspectionDtoToLocal(dto, local ?? undefined, { isDirty: false }),
        )
        return { ok: true }
      }
      case 'checklist.update': {
        const executionId = (payload.id ?? payload.checklistId ?? payload.executionId) as string
        if (!executionId) {
          throw new Error('checklist.update: execution id is required')
        }

        const res = await apiFetch(
          `${apiPrefix()}/checklists/executions/${encodeURIComponent(executionId)}`,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } },
        )

        if (res.status === 404) {
          return { dropped: true }
        }

        if (!res.ok) {
          throw new Error(await readFriendlyErrorMessage(res))
        }

        const rawText = await res.text()
        const parsed = ChecklistExecutionDTOSchema.safeParse(JSON.parse(rawText))
        if (!parsed.success) {
          throw new Error('checklist.update: invalid execution response')
        }

        await reconcileChecklistFromExecution(
          dexie,
          executionId,
          parsed.data.progress,
          parsed.data.completedAt,
        )
        return { ok: true }
      }
      case 'permit.sync': {
        await syncAssignedPermitsFromApi()
        return { ok: true }
      }
      case 'deficiency.voc.submit': {
        const deficiencyId = payload.deficiencyId as string
        const vocPayload = payload.payload as Record<string, unknown>
        if (!deficiencyId || !vocPayload) {
          throw new Error('deficiency.voc.submit: deficiencyId and payload are required')
        }
        const body = SubmitVoCDTOSchema.parse(vocPayload)

        const res = await apiFetch(
          `${apiPrefix()}/deficiencies/${encodeURIComponent(deficiencyId)}/voc`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
        )
        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || `VoC submit failed (${res.status})`)
        }

        const prev = await dexie.deficiencies.get(deficiencyId)
        if (prev) {
          const syncedAt = new Date().toISOString()
          await dexie.deficiencies.put({
            ...prev,
            status: 'VOC_SUBMITTED',
            isDirty: false,
            syncedAt,
            updatedAt: syncedAt,
          })
        }
        return { ok: true }
      }
      default:
        throw new Error(`Sync not implemented for operation: ${operation}`)
    }
  }
}
