import imageCompression from 'browser-image-compression'
import type { Options } from 'browser-image-compression'

/** Maximum stored inspection photo size (M11-S9 / M7-S4). */
export const INSPECTION_PHOTO_MAX_SIZE_BYTES = 500 * 1024

/** Longest edge cap for inspection evidence (M11-S9). */
export const INSPECTION_PHOTO_MAX_DIMENSION_PX = 1920

/** JPEG quality tuned for readable defects while staying under size targets (M11-S9). */
export const INSPECTION_PHOTO_INITIAL_QUALITY = 0.8

/** Compression must finish within this budget on mobile hardware (M11-S9). */
export const INSPECTION_PHOTO_MAX_COMPRESSION_MS = 2_000

/** Default compression for inspection evidence: ≤500 KB, max edge 1920px, JPEG 0.8, web worker when available */
export const DEFAULT_INSPECTION_PHOTO_COMPRESSION_OPTIONS: Options = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: INSPECTION_PHOTO_MAX_DIMENSION_PX,
  initialQuality: INSPECTION_PHOTO_INITIAL_QUALITY,
  useWebWorker: true,
  fileType: 'image/jpeg',
  preserveExif: false,
  alwaysKeepResolution: false,
  maxIteration: 10,
}

export function mergeInspectionPhotoCompressionOptions(overrides?: Partial<Options>): Options {
  return { ...DEFAULT_INSPECTION_PHOTO_COMPRESSION_OPTIONS, ...overrides }
}

export function meetsInspectionPhotoSizeTarget(file: Blob): boolean {
  return file.size <= INSPECTION_PHOTO_MAX_SIZE_BYTES
}

export function isAcceptableInspectionPhotoQuality(quality: number): boolean {
  return quality >= 0.7 && quality <= 0.9
}

function ensureFile(image: File | Blob, filename = 'inspection-photo.jpg'): File {
  if (image instanceof File) return image
  return new File([image], filename, {
    type: image.type || 'image/jpeg',
    lastModified: Date.now(),
  })
}

export class InspectionPhotoCompressionError extends Error {
  constructor(
    message: string,
    readonly code: 'timeout' | 'size_exceeded',
  ) {
    super(message)
    this.name = 'InspectionPhotoCompressionError'
  }
}

function linkAbortSignals(controller: AbortController, external?: AbortSignal): void {
  if (!external) return
  if (external.aborted) {
    controller.abort(external.reason)
    return
  }
  external.addEventListener('abort', () => controller.abort(external.reason), { once: true })
}

function isCompressionAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

async function enforceInspectionPhotoSizeTarget(compressed: File, options: Options): Promise<File> {
  if (meetsInspectionPhotoSizeTarget(compressed)) return compressed

  const fallbackQuality = Math.max(
    0.5,
    (options.initialQuality ?? INSPECTION_PHOTO_INITIAL_QUALITY) - 0.15,
  )
  const { signal: _signal, ...retryOptions } = options
  const retried = await imageCompression(compressed, {
    ...retryOptions,
    initialQuality: fallbackQuality,
  })

  if (!meetsInspectionPhotoSizeTarget(retried)) {
    throw new InspectionPhotoCompressionError(
      `Compressed inspection photo exceeds ${INSPECTION_PHOTO_MAX_SIZE_BYTES} bytes`,
      'size_exceeded',
    )
  }
  return retried
}

/**
 * Compress a captured inspection photo before offline/API storage.
 * Wraps `browser-image-compression` with story defaults; pass `overrides` to tune quality or disable web workers (e.g. tests).
 */
export async function compressInspectionPhoto(
  image: File | Blob,
  overrides?: Partial<Options>,
): Promise<File> {
  const options = mergeInspectionPhotoCompressionOptions(overrides)
  const file = ensureFile(image)

  const controller = new AbortController()
  linkAbortSignals(controller, overrides?.signal)

  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, INSPECTION_PHOTO_MAX_COMPRESSION_MS)

  try {
    const compressed = await imageCompression(file, {
      ...options,
      signal: controller.signal,
    })
    return await enforceInspectionPhotoSizeTarget(compressed, options)
  } catch (error) {
    if (timedOut && isCompressionAbortError(error)) {
      throw new InspectionPhotoCompressionError(
        `Inspection photo compression exceeded ${INSPECTION_PHOTO_MAX_COMPRESSION_MS}ms`,
        'timeout',
      )
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}
