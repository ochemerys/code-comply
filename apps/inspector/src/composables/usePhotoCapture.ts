import { ref, type Ref } from 'vue'

/** Constraints aligned with M7-S2; fallback used when strict ideal sizes fail (common on mobile Safari). */
export const PHOTO_CAPTURE_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: 'environment',
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
  audio: false,
}

export const PHOTO_CAPTURE_FALLBACK_CONSTRAINTS: MediaStreamConstraints = {
  video: { facingMode: 'environment' },
  audio: false,
}

export type PhotoFacingMode = 'environment' | 'user'

export function buildPhotoCaptureConstraints(facing: PhotoFacingMode): MediaStreamConstraints {
  return {
    video: {
      facingMode: facing,
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  }
}

export function buildPhotoCaptureFallbackConstraints(
  facing: PhotoFacingMode,
): MediaStreamConstraints {
  return { video: { facingMode: facing }, audio: false }
}

export interface UsePhotoCapture {
  stream: Ref<MediaStream | null>
  photo: Ref<Blob | null>
  isCapturing: Ref<boolean>
  error: Ref<Error | null>
  facingMode: Ref<PhotoFacingMode>
  startCamera: () => Promise<void>
  capturePhoto: () => Promise<Blob>
  stopCamera: () => Promise<void>
  toggleFacingMode: () => Promise<void>
}

function toError(value: unknown): Error {
  if (value instanceof Error) return value
  return new Error(typeof value === 'string' ? value : 'Unknown error')
}

function isPermissionDenied(err: unknown): boolean {
  if (err instanceof DOMException) {
    return err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
  }
  if (err instanceof Error) {
    return err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
  }
  return false
}

/**
 * Access device camera via Media Capture API (`getUserMedia`), capture still frames to JPEG blobs,
 * and release hardware cleanly. Optimized for field use (rear camera) and iOS Safari (`playsinline`).
 */
export function usePhotoCapture(): UsePhotoCapture {
  const stream = ref<MediaStream | null>(null)
  const photo = ref<Blob | null>(null)
  const isCapturing = ref(false)
  const error = ref<Error | null>(null)
  const facingMode = ref<PhotoFacingMode>('environment')

  async function acquireStream(): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera API is not supported in this browser')
    }
    const primary = buildPhotoCaptureConstraints(facingMode.value)
    const fallback = buildPhotoCaptureFallbackConstraints(facingMode.value)
    try {
      return await navigator.mediaDevices.getUserMedia(primary)
    } catch (first) {
      if (isPermissionDenied(first)) {
        throw toError(first)
      }
      try {
        return await navigator.mediaDevices.getUserMedia(fallback)
      } catch (second) {
        throw toError(second)
      }
    }
  }

  async function startCamera(): Promise<void> {
    error.value = null
    await stopCamera()
    try {
      stream.value = await acquireStream()
    } catch (e) {
      const err = toError(e)
      error.value = err
      stream.value = null
      throw err
    }
  }

  /**
   * Draws the current video frame from the active stream into a JPEG blob.
   * Uses an off-DOM video with `playsinline` / webkit hints for iOS Safari.
   */
  async function capturePhoto(): Promise<Blob> {
    const current = stream.value
    if (!current) {
      const err = new Error('Camera is not started')
      error.value = err
      throw err
    }

    isCapturing.value = true
    error.value = null

    try {
      const blob = await captureStillFromStream(current)
      photo.value = blob
      return blob
    } catch (e) {
      const err = toError(e)
      error.value = err
      throw err
    } finally {
      isCapturing.value = false
    }
  }

  async function stopCamera(): Promise<void> {
    const current = stream.value
    if (current) {
      current.getTracks().forEach((track) => track.stop())
      stream.value = null
    }
  }

  async function toggleFacingMode(): Promise<void> {
    facingMode.value = facingMode.value === 'environment' ? 'user' : 'environment'
    if (stream.value) {
      await startCamera()
    }
  }

  return {
    stream,
    photo,
    isCapturing,
    error,
    facingMode,
    startCamera,
    capturePhoto,
    stopCamera,
    toggleFacingMode,
  }
}

export function captureStillFromStream(mediaStream: MediaStream): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')
    video.muted = true
    video.playsInline = true
    video.srcObject = mediaStream

    const cleanup = (): void => {
      video.srcObject = null
      video.remove()
    }

    const fail = (reason: unknown): void => {
      cleanup()
      reject(toError(reason))
    }

    video.onerror = () => fail(new Error('Video element failed to load camera stream'))

    video.onloadedmetadata = () => {
      video
        .play()
        .then(() => {
          try {
            const w = video.videoWidth
            const h = video.videoHeight
            if (!w || !h) {
              fail(new Error('Video dimensions are not available'))
              return
            }

            const canvas = document.createElement('canvas')
            canvas.width = w
            canvas.height = h
            const ctx = canvas.getContext('2d')
            if (!ctx) {
              fail(new Error('Canvas 2D context is not available'))
              return
            }

            ctx.drawImage(video, 0, 0, w, h)

            canvas.toBlob(
              (b) => {
                cleanup()
                if (!b) {
                  reject(new Error('Failed to encode photo'))
                  return
                }
                resolve(b)
              },
              'image/jpeg',
              0.92,
            )
          } catch (e) {
            fail(e)
          }
        })
        .catch((e) => fail(e))
    }
  })
}
