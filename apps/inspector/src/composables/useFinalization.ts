/**
 * Finalization workflow: GPS capture, timestamps, signature/outcome persistence,
 * certification snapshot, local inspection update, and inspection.finalize sync queue entry.
 *
 * @see M8-S6 — Implement Finalization Flow
 */
import { ref } from 'vue'
import type { UserDTO } from '@codecomply/validators'
import { db } from '@/lib/db/dexie'
import type { LocalInspection } from '@/lib/db/types'
import { useGeolocation } from '@/composables/useGeolocation'

export interface FinalizedGps {
  latitude: number
  longitude: number
  accuracy: number
}

export interface FinalizeInspectionParams {
  inspection: LocalInspection
  outcome: NonNullable<LocalInspection['outcome']>
  signatureDataUrl: string
  /** Active inspector profile — certifications are snapshotted for legal integrity */
  certificationSource?: Pick<UserDTO, 'certifications'> | null
}

export interface FinalizationResult {
  inspection: LocalInspection
  finalizedAt: string
  finalizedGps: FinalizedGps | null
}

function randomQueueId(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c?.randomUUID) return c.randomUUID()
  return `q-${Math.random().toString(16).slice(2)}-${Date.now()}`
}

export function buildCertificationSnapshot(
  finalizedAt: string,
  source?: Pick<UserDTO, 'certifications'> | null,
): string {
  return JSON.stringify({
    finalizedAt,
    certifications: source?.certifications ?? [],
  })
}

export function useFinalization() {
  const { getCurrentPosition } = useGeolocation()
  const isFinalizing = ref(false)

  async function finalizeInspection(params: FinalizeInspectionParams): Promise<FinalizationResult> {
    const { inspection, outcome, signatureDataUrl, certificationSource } = params

    isFinalizing.value = true
    try {
      const finalizedAt = new Date().toISOString()

      let finalizedGps: FinalizedGps | null = null
      let lat: number | undefined
      let lon: number | undefined
      let acc: number | undefined

      try {
        const pos = await getCurrentPosition()
        lat = pos.coords.latitude
        lon = pos.coords.longitude
        acc =
          typeof pos.coords.accuracy === 'number' && Number.isFinite(pos.coords.accuracy)
            ? pos.coords.accuracy
            : 0
        finalizedGps = { latitude: lat, longitude: lon, accuracy: acc }
      } catch {
        /* GPS unavailable or denied — persist without coordinates */
      }

      const certificationSnapshot = buildCertificationSnapshot(finalizedAt, certificationSource)

      const status: LocalInspection['status'] = outcome === 'REFUSED' ? 'FAILED' : 'PASSED'

      const updated: LocalInspection = {
        ...inspection,
        outcome,
        signatureDataUrl,
        certificationSnapshot,
        finalizeLatitude: lat,
        finalizeLongitude: lon,
        finalizeAccuracy: acc,
        completedDate: finalizedAt,
        status,
        updatedAt: finalizedAt,
        isDirty: true,
      }

      await db.inspections.put(updated)

      await db.syncQueue.put({
        id: randomQueueId(),
        clientId: randomQueueId(),
        operation: 'inspection.finalize',
        status: 'PENDING',
        payload: {
          inspectionId: updated.id,
          outcome: updated.outcome,
          signatureDataUrl: updated.signatureDataUrl,
          completedDate: updated.completedDate,
          finalizedAt,
          finalizedGps,
          finalizeLatitude: updated.finalizeLatitude,
          finalizeLongitude: updated.finalizeLongitude,
          finalizeAccuracy: updated.finalizeAccuracy,
          certificationSnapshot: updated.certificationSnapshot,
        },
        attempts: 0,
        maxAttempts: 10,
        createdAt: finalizedAt,
        priority: 0,
      })

      return { inspection: updated, finalizedAt, finalizedGps }
    } finally {
      isFinalizing.value = false
    }
  }

  return { finalizeInspection, isFinalizing }
}
