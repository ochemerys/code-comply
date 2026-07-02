<script setup lang="ts">
/**
 * M7-S11: Full-screen capture flow for inspection evidence (mobile-first).
 * Optional query `return` (route name), `checklistItemId` (checklist line), `deficiencyId` (deficiency detail).
 * Galleries read the blob via `consumeLastAcceptedPhoto` from `@/lib/photo/last-capture`.
 */
import { useRoute, useRouter } from 'vue-router'
import CameraCapture from '@/components/CameraCapture.vue'
import { setLastAcceptedPhoto } from '@/lib/photo/last-capture'

const route = useRoute()
const router = useRouter()

function goBack() {
  if (window.history.length > 1) void router.back()
  else void router.push({ name: 'home' })
}

function onAccept(blob: Blob) {
  const dq = route.query.deficiencyId
  const deficiencyId = typeof dq === 'string' && dq.trim().length > 0 ? dq.trim() : undefined
  const cq = route.query.checklistItemId
  const checklistItemId = typeof cq === 'string' && cq.trim().length > 0 ? cq.trim() : undefined

  if (deficiencyId) {
    setLastAcceptedPhoto(blob, { deficiencyId })
  } else {
    setLastAcceptedPhoto(blob, { checklistItemId })
  }

  const ret = route.query.return
  const raw = typeof ret === 'string' && ret.length > 0 ? ret : 'home'
  const name = router.hasRoute(raw) ? raw : 'home'

  /** M7-S11-B1: checklist-execution requires params; use `replace` when returning (M7-S14-B2). */
  if (name === 'checklist-execution') {
    const inspectionId =
      typeof route.query.inspectionId === 'string' ? route.query.inspectionId.trim() : ''
    const executionId =
      typeof route.query.executionId === 'string' ? route.query.executionId.trim() : ''
    if (inspectionId && executionId) {
      /** Replace so "Back" on checklist does not reopen capture (M7-S14-B2). */
      const query: Record<string, string> = {}
      const fp = route.query.fromPermit
      if (typeof fp === 'string' && fp.trim().length > 0) query.fromPermit = fp.trim()
      void router.replace({
        name: 'checklist-execution',
        params: { inspectionId, executionId },
        ...(Object.keys(query).length > 0 ? { query } : {}),
      })
      return
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      void router.back()
      return
    }
  }

  /** M7-I1: deficiency-detail — replace so Back does not reopen capture. */
  if (name === 'deficiency-detail') {
    const inspectionId =
      typeof route.query.inspectionId === 'string' ? route.query.inspectionId.trim() : ''
    const did = typeof route.query.deficiencyId === 'string' ? route.query.deficiencyId.trim() : ''
    if (inspectionId && did) {
      void router.replace({
        name: 'deficiency-detail',
        params: { inspectionId, deficiencyId: did },
      })
      return
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      void router.back()
      return
    }
  }

  void router.push({ name })
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-black" data-testid="capture-photo-view">
    <CameraCapture class="min-h-0 flex-1" @accept="onAccept" />
    <div
      class="shrink-0 border-t border-white/10 bg-bg-app px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <button
        type="button"
        class="min-h-touch w-full rounded-lg border border-white/20 bg-white/10 py-3 text-base font-medium text-white"
        data-testid="capture-photo-cancel"
        @click="goBack"
      >
        Cancel
      </button>
    </div>
  </div>
</template>
