<script setup lang="ts">
/**
 * M7-S13: Grid gallery for inspection evidence — thumbnails, full view, delete, add (camera), empty state, offline IndexedDB photos.
 */
import { onActivated, onMounted, onUnmounted, ref, watch, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PhotoThumbnail from '@/components/PhotoThumbnail.vue'
import { useOfflinePhotos } from '@/composables/useOfflinePhotos'
import { useAuthStore } from '@/stores/auth'
import { db } from '@/lib/db/dexie'
import type { LocalPhoto } from '@/lib/db/types'
import { buildEmbeddedPhotoMetadata, toPhotoMetadata } from '@/lib/photo/metadata'
import { compressInspectionPhoto } from '@/lib/photo/compression'
import { consumeLastAcceptedPhoto as consumePendingCapture } from '@/lib/photo/last-capture'

const props = withDefaults(
  defineProps<{
    inspectionId: string
    deficiencyId?: string
    checklistItemId?: string
    /** Route name passed to capture flow (`return` query); defaults to current route name. */
    captureReturnRoute?: string
    /** Extra query keys for capture-photo so return navigation can supply route params (e.g. checklist-execution). */
    captureReturnRouteQuery?: Record<string, string>
    /** When true, gallery is view-only (M8-S10). */
    readOnly?: boolean
  }>(),
  { readOnly: false },
)

const emit = defineEmits<{
  (e: 'error', err: Error): void
  /** Fired after the gallery list changes (load, delete, ingest) so parents can refresh aggregates (M7-S16). */
  (e: 'photos-updated'): void
}>()

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const offline = useOfflinePhotos()
const refreshChecklistPhotoCounts = inject<(() => void | Promise<void>) | null>(
  'refreshChecklistPhotoCounts',
  null,
)

const photos = ref<LocalPhoto[]>([])
const loading = ref(false)
const fullView = ref<LocalPhoto | null>(null)
const fullViewSrc = ref('')
const fullViewBlobUrl = ref<string | null>(null)
const deletePrompt = ref(false)
const gridObjectUrls = ref<string[]>([])
const libraryInputRef = ref<HTMLInputElement | null>(null)

function revokeGridObjectUrls() {
  for (const u of gridObjectUrls.value) {
    URL.revokeObjectURL(u)
  }
  gridObjectUrls.value = []
}

function revokeFullViewBlobUrl() {
  const u = fullViewBlobUrl.value
  if (u) {
    URL.revokeObjectURL(u)
    fullViewBlobUrl.value = null
  }
}

function displaySrcForGrid(photo: LocalPhoto): string {
  if (photo.thumbnail?.startsWith('data:')) return photo.thumbnail
  if (photo.blob && typeof URL.createObjectURL === 'function') {
    const u = URL.createObjectURL(photo.blob)
    gridObjectUrls.value.push(u)
    return u
  }
  return ''
}

function rebuildDisplaySources(list: LocalPhoto[]) {
  revokeGridObjectUrls()
  return list.map((p) => ({
    photo: p,
    src: displaySrcForGrid(p),
    alt: p.filename || 'Inspection photo',
  }))
}

const entries = ref<{ photo: LocalPhoto; src: string; alt: string }[]>([])

watch(
  () => photos.value,
  (list) => {
    entries.value = rebuildDisplaySources(list)
  },
  { deep: true },
)

async function notifyPhotosUpdated(): Promise<void> {
  emit('photos-updated')
  if (refreshChecklistPhotoCounts) {
    await refreshChecklistPhotoCounts()
  }
}

async function loadPhotos() {
  if (!props.inspectionId) return
  loading.value = true
  try {
    let list: LocalPhoto[]
    const defId = props.deficiencyId?.trim()
    if (defId) {
      list = await offline.listForDeficiency(defId)
    } else if (props.checklistItemId?.trim()) {
      list = await offline.listForChecklistItem(props.inspectionId, props.checklistItemId.trim())
    } else {
      list = await offline.listForInspection(props.inspectionId)
    }
    list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    photos.value = list
    await notifyPhotosUpdated()
  } catch (e) {
    emit('error', e instanceof Error ? e : new Error('Failed to load photos'))
  } finally {
    loading.value = false
  }
}

/** Resize to JPEG data URL for grid thumbnails (M7-S13). */
async function generateThumbnailDataUrl(imageBlob: Blob, maxEdge = 256): Promise<string> {
  const url = URL.createObjectURL(imageBlob)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Thumbnail image failed to load'))
      img.src = url
    })
    const w = img.naturalWidth
    const h = img.naturalHeight
    if (!w || !h) throw new Error('Invalid image dimensions')
    const scale = Math.min(1, maxEdge / Math.max(w, h))
    const tw = Math.max(1, Math.round(w * scale))
    const th = Math.max(1, Math.round(h * scale))
    const canvas = document.createElement('canvas')
    canvas.width = tw
    canvas.height = th
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas not available')
    ctx.drawImage(img, 0, 0, tw, th)
    return canvas.toDataURL('image/jpeg', 0.72)
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function persistAcceptedBlob(blob: Blob) {
  const userId = authStore.user?.id ?? 'offline-user'
  const now = new Date().toISOString()
  const inspectionRow = await db.inspections.get(props.inspectionId)
  const file = await compressInspectionPhoto(blob, { useWebWorker: false })

  let thumbnail: string | undefined
  try {
    thumbnail = await generateThumbnailDataUrl(file)
  } catch {
    thumbnail = undefined
  }

  const embedded = buildEmbeddedPhotoMetadata({
    capturedAt: new Date(now),
    inspectorId: userId,
    inspectorName: authStore.user?.name ?? 'Inspector',
    permitNumber: inspectionRow?.permitNumber,
  })

  const id = crypto.randomUUID()
  const photo: LocalPhoto = {
    id,
    clientId: crypto.randomUUID(),
    inspectionId: props.inspectionId,
    deficiencyId: props.deficiencyId,
    checklistItemId: props.checklistItemId,
    filename: file.name || `inspection-${id.slice(0, 8)}.jpg`,
    mimeType: file.type || 'image/jpeg',
    size: file.size,
    blob: file,
    thumbnail,
    metadata: toPhotoMetadata(embedded, { hasWatermark: false }),
    createdAt: now,
  }

  await offline.saveAndQueueUpload(photo)
}

function captureConsumeScope(): { deficiencyId: string } | { checklistItemId: string } | undefined {
  const defId = props.deficiencyId?.trim()
  if (defId) return { deficiencyId: defId }
  const lineId = props.checklistItemId?.trim()
  if (lineId) return { checklistItemId: lineId }
  return undefined
}

async function tryIngestLastCapture() {
  const scope = captureConsumeScope()
  const blob = scope === undefined ? consumePendingCapture() : consumePendingCapture(scope)
  if (!blob || !props.inspectionId) return
  try {
    await persistAcceptedBlob(blob)
    await loadPhotos()
  } catch (e) {
    emit('error', e instanceof Error ? e : new Error('Could not save captured photo'))
  }
}

function openLibraryPicker() {
  if (props.readOnly) return
  libraryInputRef.value?.click()
}

async function onLibraryFileChange(ev: Event) {
  if (props.readOnly) return
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !props.inspectionId) return
  try {
    await persistAcceptedBlob(file)
    await loadPhotos()
  } catch (e) {
    emit('error', e instanceof Error ? e : new Error('Could not save photo from library'))
  }
}

function openFullView(photo: LocalPhoto) {
  deletePrompt.value = false
  revokeFullViewBlobUrl()
  fullView.value = photo
  if (photo.thumbnail?.startsWith('data:')) {
    fullViewSrc.value = photo.thumbnail
  } else if (photo.blob && typeof URL.createObjectURL === 'function') {
    const u = URL.createObjectURL(photo.blob)
    fullViewBlobUrl.value = u
    fullViewSrc.value = u
  } else {
    fullViewSrc.value = ''
  }
}

function closeFullView() {
  fullView.value = null
  fullViewSrc.value = ''
  revokeFullViewBlobUrl()
  deletePrompt.value = false
  void loadPhotos()
}

function requestDelete() {
  if (props.readOnly) return
  deletePrompt.value = true
}

function cancelDelete() {
  deletePrompt.value = false
}

async function confirmDelete() {
  if (props.readOnly) return
  const p = fullView.value
  if (!p) return
  try {
    await offline.queueDelete({ id: p.id, clientId: p.clientId })
    await offline.removeLocalPhoto(p.id)
    closeFullView()
    await loadPhotos()
  } catch (e) {
    emit('error', e instanceof Error ? e : new Error('Could not delete photo'))
  }
}

function openCamera() {
  if (props.readOnly) return
  const ret =
    props.captureReturnRoute ??
    (typeof route.name === 'string' && route.name.length > 0 ? route.name : 'home')
  const name = router.hasRoute(ret) ? ret : 'home'
  const query: Record<string, string> = { return: name }
  const extra = props.captureReturnRouteQuery
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      const s = v != null ? String(v).trim() : ''
      if (s.length > 0) query[k] = s
    }
  }
  const lineId = props.checklistItemId?.trim()
  if (lineId) query.checklistItemId = lineId
  const defId = props.deficiencyId?.trim()
  if (defId) query.deficiencyId = defId
  void router.push({ name: 'capture-photo', query })
}

onMounted(async () => {
  await tryIngestLastCapture()
  await loadPhotos()
})

onActivated(async () => {
  await tryIngestLastCapture()
  await loadPhotos()
})

watch(
  () => [props.inspectionId, props.checklistItemId, props.deficiencyId] as const,
  async () => {
    await loadPhotos()
  },
)

onUnmounted(() => {
  revokeFullViewBlobUrl()
  revokeGridObjectUrls()
})
</script>

<template>
  <section class="flex flex-col gap-3" data-testid="photo-gallery" :aria-busy="loading">
    <header class="flex flex-wrap items-center justify-between gap-2">
      <p
        class="text-base font-semibold text-gray-900 dark:text-gray-100"
        data-testid="photo-gallery-count"
      >
        Photos
        <span class="font-normal text-gray-600 dark:text-gray-400">({{ photos.length }})</span>
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <input
          ref="libraryInputRef"
          type="file"
          accept="image/*"
          class="sr-only"
          data-testid="photo-gallery-library-input"
          @change="onLibraryFileChange"
        />
        <button
          type="button"
          class="inline-flex min-h-touch min-w-touch items-center justify-center rounded-lg border border-border-subtle bg-bg-elevated px-4 text-base font-medium text-gray-900 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:text-gray-100 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-900"
          data-testid="photo-gallery-library"
          aria-label="Choose photo from library"
          :disabled="readOnly"
          :class="readOnly ? 'cursor-not-allowed opacity-50' : ''"
          @click="openLibraryPicker"
        >
          Library
        </button>
        <button
          type="button"
          class="inline-flex min-h-touch min-w-touch items-center justify-center rounded-lg bg-blue-600 px-4 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          data-testid="photo-gallery-add"
          aria-label="Add photo with camera"
          :disabled="readOnly"
          :class="readOnly ? 'cursor-not-allowed opacity-50' : ''"
          @click="openCamera"
        >
          Add
        </button>
      </div>
    </header>

    <p
      v-if="loading"
      class="text-sm text-gray-600 dark:text-gray-400"
      data-testid="photo-gallery-loading"
    >
      Loading photos…
    </p>

    <div
      v-else-if="photos.length === 0"
      class="rounded-lg border border-dashed border-border-subtle bg-bg-elevated px-4 py-10 text-center text-sm text-gray-600 dark:border-slate-700 dark:text-gray-400"
      data-testid="photo-gallery-empty"
    >
      No photos yet. Tap Add to capture evidence. Photos stay available offline once saved.
    </div>

    <div
      v-else
      class="grid grid-cols-3 gap-2 tablet:grid-cols-4 tablet-l:grid-cols-5"
      data-testid="photo-gallery-grid"
    >
      <PhotoThumbnail
        v-for="row in entries"
        :key="row.photo.id"
        :src="row.src"
        :alt="row.alt"
        @click="openFullView(row.photo)"
      />
    </div>

    <Teleport to="body">
      <div
        v-if="fullView && fullViewSrc"
        class="fixed inset-x-0 inset-y-0 z-modal flex flex-col bg-black/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]"
        data-testid="photo-gallery-full-view"
        role="dialog"
        aria-modal="true"
        :aria-label="`Full view: ${fullView.filename}`"
      >
        <div class="flex shrink-0 justify-end gap-2 px-3">
          <button
            type="button"
            class="min-h-touch rounded-lg border border-white/20 px-4 text-base font-medium text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white"
            data-testid="photo-gallery-close-full"
            @click="closeFullView"
          >
            Close
          </button>
        </div>
        <div class="flex min-h-0 flex-1 items-center justify-center px-2">
          <img
            :src="fullViewSrc"
            :alt="fullView.filename"
            class="max-h-[min(85dvh,100%)] max-w-full object-contain"
          />
        </div>
        <div v-if="!deletePrompt" class="flex shrink-0 justify-center px-4 pt-2">
          <button
            type="button"
            class="min-h-touch w-full max-w-sm rounded-lg border border-red-400/80 bg-red-600/90 px-4 text-base font-medium text-white hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400"
            data-testid="photo-gallery-delete"
            :disabled="readOnly"
            :class="readOnly ? 'cursor-not-allowed opacity-50' : ''"
            @click="requestDelete"
          >
            Delete photo
          </button>
        </div>
        <div
          v-else
          class="flex shrink-0 flex-col gap-2 px-4 pt-2"
          data-testid="photo-gallery-delete-confirm"
        >
          <p class="text-center text-sm text-white">
            Remove this photo from the device and queue server delete when online?
          </p>
          <div class="flex gap-2">
            <button
              type="button"
              class="min-h-touch flex-1 rounded-lg border border-white/30 bg-white/10 px-3 text-base font-medium text-white hover:bg-white/20"
              data-testid="photo-gallery-delete-cancel"
              @click="cancelDelete"
            >
              Cancel
            </button>
            <button
              type="button"
              class="min-h-touch flex-1 rounded-lg bg-red-600 px-3 text-base font-medium text-white hover:bg-red-700"
              data-testid="photo-gallery-delete-confirm-btn"
              @click="confirmDelete"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>
