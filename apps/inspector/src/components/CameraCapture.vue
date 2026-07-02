<script setup lang="ts">
/**
 * M7-S11: Camera viewfinder, capture, preview, retake/accept. Uses `usePhotoCapture` (iOS-friendly playsinline path).
 * Flash/torch and flip use device capabilities when available.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { usePhotoCapture } from '@/composables/usePhotoCapture'

const emit = defineEmits<{
  accept: [blob: Blob]
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const previewObjectUrl = ref<string | null>(null)
const torchSupported = ref(false)
const torchOn = ref(false)
const torchError = ref<string | null>(null)

const {
  stream,
  photo,
  isCapturing,
  error,
  startCamera,
  capturePhoto,
  stopCamera,
  toggleFacingMode,
} = usePhotoCapture()

const showPreview = computed(() => previewObjectUrl.value !== null)

watch([stream, videoRef], ([nextStream, el]) => {
  if (!el) return
  el.srcObject = nextStream ?? null
  if (nextStream) {
    try {
      const maybePromise = el.play()
      if (maybePromise !== undefined && typeof maybePromise.catch === 'function') {
        void maybePromise.catch(() => {
          /* autoplay policies; user gesture may be required on some builds */
        })
      }
    } catch {
      /* jsdom and strict autoplay environments */
    }
    const track = nextStream.getVideoTracks()[0]
    const caps = track?.getCapabilities?.() as Record<string, unknown> & { torch?: boolean }
    torchSupported.value = caps?.torch === true
  } else {
    torchSupported.value = false
    torchOn.value = false
  }
})

onMounted(() => {
  void startCamera()
})

onUnmounted(() => {
  if (previewObjectUrl.value) {
    URL.revokeObjectURL(previewObjectUrl.value)
    previewObjectUrl.value = null
  }
  void stopCamera()
})

async function onCaptureTap() {
  torchError.value = null
  const blob = await capturePhoto()
  if (previewObjectUrl.value) URL.revokeObjectURL(previewObjectUrl.value)
  previewObjectUrl.value = URL.createObjectURL(blob)
}

function onRetake() {
  if (previewObjectUrl.value) {
    URL.revokeObjectURL(previewObjectUrl.value)
    previewObjectUrl.value = null
  }
  photo.value = null
}

function onAccept() {
  const blob = photo.value
  if (!blob) return
  emit('accept', blob)
}

async function onFlipCamera() {
  torchError.value = null
  try {
    await toggleFacingMode()
  } catch {
    /* error surfaced via composable `error` */
  }
}

async function onTorchToggle() {
  torchError.value = null
  const track = stream.value?.getVideoTracks()[0]
  if (!track || !torchSupported.value) return
  torchOn.value = !torchOn.value
  try {
    type ConstraintsArg = Parameters<MediaStreamTrack['applyConstraints']>[0]
    await track.applyConstraints({
      // `torch` is valid in Chromium; DOM typings omit it — cast via unknown
      advanced: [{ torch: torchOn.value }] as unknown as NonNullable<ConstraintsArg>['advanced'],
    })
  } catch {
    torchOn.value = !torchOn.value
    torchError.value = 'Flash is not available on this device.'
  }
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col bg-black" data-testid="camera-capture">
    <div class="relative min-h-0 flex-1 overflow-hidden">
      <video
        ref="videoRef"
        class="h-full w-full object-cover"
        playsinline
        webkit-playsinline
        muted
        autoplay
        data-testid="camera-viewfinder"
      />
      <img
        v-if="showPreview && previewObjectUrl"
        :src="previewObjectUrl"
        alt="Captured preview"
        class="absolute inset-0 h-full w-full object-cover"
        data-testid="camera-preview"
      />

      <div
        v-if="error"
        class="absolute inset-0 flex items-center justify-center bg-black/80 p-4"
        role="alert"
      >
        <p class="text-center text-base text-white">
          {{ error.message }}
        </p>
      </div>
    </div>

    <div
      class="flex shrink-0 flex-col gap-3 border-t border-white/10 bg-slate-900 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <p
        v-if="torchError"
        class="text-center text-sm text-amber-300"
        data-testid="camera-torch-error"
      >
        {{ torchError }}
      </p>

      <div v-if="!showPreview" class="flex items-center justify-center gap-3">
        <button
          v-if="torchSupported"
          type="button"
          class="min-h-touch min-w-touch rounded-full border border-white/30 bg-white/10 px-4 text-base font-medium text-white"
          :aria-pressed="torchOn"
          data-testid="camera-flash-toggle"
          @click="onTorchToggle"
        >
          {{ torchOn ? 'Flash on' : 'Flash off' }}
        </button>
        <button
          type="button"
          class="min-h-touch min-w-touch rounded-full border border-white/30 bg-white/10 px-4 text-base font-medium text-white"
          data-testid="camera-switch"
          @click="onFlipCamera"
        >
          Switch camera
        </button>
      </div>

      <div v-if="!showPreview" class="flex justify-center">
        <button
          type="button"
          class="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/90 text-slate-900 shadow-lg ring-2 ring-white/40 disabled:opacity-50"
          :disabled="!!error || isCapturing || !stream"
          data-testid="camera-shutter"
          aria-label="Take photo"
          @click="onCaptureTap"
        >
          <span class="h-12 w-12 rounded-full bg-slate-900" />
        </button>
      </div>

      <div v-else class="flex gap-3">
        <button
          type="button"
          class="min-h-touch flex-1 rounded-lg border border-white/20 bg-white/10 py-3 text-base font-medium text-white"
          data-testid="camera-retake"
          @click="onRetake"
        >
          Retake
        </button>
        <button
          type="button"
          class="min-h-touch flex-1 rounded-lg bg-blue-600 py-3 text-base font-medium text-white hover:bg-blue-700"
          data-testid="camera-accept"
          @click="onAccept"
        >
          Use photo
        </button>
      </div>
    </div>
  </div>
</template>
