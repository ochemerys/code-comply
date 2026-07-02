/**
 * Hands off the last accepted camera capture to the next route (M7-S11).
 * History state is not reliable for Blob across environments; callers use `consumeLastAcceptedPhoto` after navigation.
 *
 * Scoping:
 * - When `checklistItemId` is set on the pending capture, only a gallery for that line may consume
 *   (multiple `PhotoGallery` instances can mount on the checklist page).
 * - When `deficiencyId` is set, only the deficiency-scoped gallery may consume (M7-I1).
 * - Do not pass both ids from `CapturePhotoView` in one session (v1); `setLastAcceptedPhoto` prefers
 *   deficiency when both would be set (should not occur).
 */

export type ConsumeCaptureScope = {
  checklistItemId?: string
  deficiencyId?: string
}

type PendingAcceptedPhoto = {
  blob: Blob
  checklistItemId?: string
  deficiencyId?: string
}

let pending: PendingAcceptedPhoto | null = null

export function setLastAcceptedPhoto(
  blob: Blob,
  options?: { checklistItemId?: string; deficiencyId?: string },
): void {
  const cid = options?.checklistItemId?.trim()
  const did = options?.deficiencyId?.trim()
  if (did && cid) {
    // v1: mutually exclusive scopes; deficiency detail flow takes precedence if both slipped through
    pending = { blob, deficiencyId: did, checklistItemId: undefined }
    return
  }
  if (did) {
    pending = { blob, deficiencyId: did }
    return
  }
  if (cid) {
    pending = { blob, checklistItemId: cid }
    return
  }
  pending = { blob }
}

/**
 * Returns the blob and clears the buffer when this consumer is allowed to take it.
 * @param scopeOrChecklist — pass a checklist line id (string, legacy) or a scope object. Omit for unscoped pending.
 */
export function consumeLastAcceptedPhoto(
  scopeOrChecklist?: string | ConsumeCaptureScope,
): Blob | null {
  const scope: ConsumeCaptureScope =
    typeof scopeOrChecklist === 'string'
      ? { checklistItemId: scopeOrChecklist || undefined }
      : (scopeOrChecklist ?? {})

  const p = pending
  if (!p) return null

  if (p.deficiencyId) {
    const want = scope.deficiencyId?.trim()
    if (!want || want !== p.deficiencyId) return null
    pending = null
    return p.blob
  }

  if (p.checklistItemId) {
    const want = scope.checklistItemId?.trim()
    if (!want || want !== p.checklistItemId) return null
    pending = null
    return p.blob
  }

  pending = null
  return p.blob
}

/** Drops any buffered capture (test isolation; cancel flows). */
export function clearPendingAcceptedPhoto(): void {
  pending = null
}
