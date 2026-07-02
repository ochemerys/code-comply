<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PhotoGallery from '@/components/PhotoGallery.vue'
import GeofenceAttendanceBanner from '@/components/GeofenceAttendanceBanner.vue'
import { usePermitDetail } from '@/composables/usePermitDetail'
import { useGeolocation } from '@/composables/useGeolocation'
import { getApiBaseUrl } from '@/lib/api-base'
import { apiFetch } from '@/utils/api-error-handler'
import { db } from '@/lib/db/dexie'

/**
 * UnableToEnterView — field capture for LSC-A-03 (GPS proof, site photos, sync without checklist).
 */
const route = useRoute()
const router = useRouter()

const inspectionId = computed(() => String(route.params.inspectionId ?? ''))
const fromPermitId = computed(() => {
  const q = route.query.fromPermit
  return typeof q === 'string' && q.trim() ? q.trim() : ''
})

const { permit, isLoading, error } = usePermitDetail(
  computed(() => fromPermitId.value || undefined),
)
const { getCurrentPosition } = useGeolocation()

const comments = ref('')
const photoCount = ref(0)
const submitError = ref<string | null>(null)
const submitting = ref(false)
const submitSuccess = ref(false)

const permitLocation = computed(() => {
  const p = permit.value
  if (p?.latitude == null || p?.longitude == null) return null
  return { latitude: p.latitude, longitude: p.longitude }
})

const captureReturnQuery = computed((): Record<string, string> => {
  const q: Record<string, string> = { inspectionId: inspectionId.value }
  const fp = fromPermitId.value
  if (fp) q.fromPermit = fp
  return q
})

async function refreshPhotoCount() {
  const id = inspectionId.value.trim()
  if (!id) {
    photoCount.value = 0
    return
  }
  try {
    photoCount.value = await db.photos.where('inspectionId').equals(id).count()
  } catch {
    photoCount.value = 0
  }
}

async function onSubmit() {
  submitError.value = null
  const inspId = inspectionId.value.trim()
  if (!inspId) return
  if (!comments.value.trim()) {
    submitError.value = 'Describe why access was not possible.'
    return
  }
  if (photoCount.value < 1) {
    submitError.value = 'Capture at least one site photo before syncing.'
    return
  }

  submitting.value = true
  try {
    const position = await getCurrentPosition()
    const attemptAt = new Date().toISOString()
    const base = getApiBaseUrl()
    const prefix = base ? `${base}/api` : '/api'
    const res = await apiFetch(
      `${prefix}/inspections/${encodeURIComponent(inspId)}/unable-to-enter`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptAt,
          comments: comments.value.trim(),
          geofenceProof: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: attemptAt,
          },
        }),
      },
    )
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `Unable to enter sync failed (${res.status})`)
    }
    submitSuccess.value = true
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : 'Could not sync unable-to-enter attempt.'
  } finally {
    submitting.value = false
  }
}

function goBack() {
  const fp = fromPermitId.value
  if (fp) {
    void router.push({ name: 'permit-detail', params: { id: fp } })
    return
  }
  void router.push({ name: 'permits' })
}

void refreshPhotoCount()
</script>

<template>
  <div class="bg-bg-app min-h-screen">
    <main class="px-4 pt-3 tablet:px-6 tablet:pt-5 pb-8">
      <div class="max-w-2xl mx-auto w-full">
        <header class="flex items-center gap-3 mb-5">
          <button
            type="button"
            class="min-h-touch min-w-touch rounded-xl border border-border-subtle bg-bg-surface px-3 text-sm font-medium"
            data-testid="unable-to-enter-back"
            @click="goBack"
          >
            Back
          </button>
          <h1 class="text-xl font-bold text-text-primary">Unable to enter</h1>
        </header>

        <div v-if="isLoading" data-testid="unable-to-enter-loading">Loading…</div>
        <div v-else-if="error" class="text-red-600" data-testid="unable-to-enter-error">
          {{ error.message }}
        </div>
        <template v-else>
          <p class="mb-4 text-sm text-text-secondary" data-testid="unable-to-enter-intro">
            Document a failed access attempt with GPS proof and site photos. Do not run a full
            Pass/Fail checklist.
          </p>

          <GeofenceAttendanceBanner v-if="permitLocation" :permit="permitLocation" class="mb-4" />

          <label class="block mb-4">
            <span class="text-sm font-medium text-text-primary">Reason / comments</span>
            <textarea
              v-model="comments"
              rows="4"
              class="mt-2 w-full rounded-xl border border-border-subtle bg-bg-surface px-3 py-2 text-base"
              data-testid="unable-to-enter-comments"
              placeholder="Locked gate, no adult present, etc."
            />
          </label>

          <section class="mb-6" aria-label="Site photos">
            <h2 class="text-sm font-semibold text-text-primary mb-2">Site photos</h2>
            <PhotoGallery
              v-if="inspectionId"
              :inspection-id="inspectionId"
              capture-return-route="unable-to-enter"
              :capture-return-route-query="captureReturnQuery"
              @photos-updated="refreshPhotoCount"
            />
          </section>

          <p
            v-if="submitError"
            class="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
            data-testid="unable-to-enter-submit-error"
          >
            {{ submitError }}
          </p>
          <p
            v-if="submitSuccess"
            class="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
            data-testid="unable-to-enter-success"
          >
            Attempt synced. Return to the office for No Entry letter processing.
          </p>

          <button
            type="button"
            class="w-full min-h-[48px] rounded-xl bg-primary-600 text-white font-semibold disabled:opacity-50"
            data-testid="unable-to-enter-submit"
            :disabled="submitting || submitSuccess"
            @click="onSubmit"
          >
            {{ submitting ? 'Syncing…' : 'Sync unable-to-enter attempt' }}
          </button>
        </template>
      </div>
    </main>
  </div>
</template>
