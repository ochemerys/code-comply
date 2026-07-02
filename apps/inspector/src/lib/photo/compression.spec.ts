import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  DEFAULT_INSPECTION_PHOTO_COMPRESSION_OPTIONS,
  INSPECTION_PHOTO_INITIAL_QUALITY,
  INSPECTION_PHOTO_MAX_COMPRESSION_MS,
  INSPECTION_PHOTO_MAX_DIMENSION_PX,
  INSPECTION_PHOTO_MAX_SIZE_BYTES,
  InspectionPhotoCompressionError,
  mergeInspectionPhotoCompressionOptions,
  compressInspectionPhoto,
  meetsInspectionPhotoSizeTarget,
  isAcceptableInspectionPhotoQuality,
} from './compression'

const imageCompressionMock = vi.hoisted(() => vi.fn())

vi.mock('browser-image-compression', () => ({
  default: imageCompressionMock,
}))

describe('photo compression (M7-S4, M11-S9)', () => {
  beforeEach(() => {
    imageCompressionMock.mockImplementation(async (file: File) => file)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('story targets (M11-S9)', () => {
    it('exports size, dimension, quality, and deadline constants', () => {
      expect(INSPECTION_PHOTO_MAX_SIZE_BYTES).toBe(500 * 1024)
      expect(INSPECTION_PHOTO_MAX_DIMENSION_PX).toBe(1920)
      expect(INSPECTION_PHOTO_INITIAL_QUALITY).toBe(0.8)
      expect(INSPECTION_PHOTO_MAX_COMPRESSION_MS).toBe(2000)
    })

    it('meetsInspectionPhotoSizeTarget respects 500KB cap', () => {
      expect(meetsInspectionPhotoSizeTarget(new Blob([new Uint8Array(400 * 1024)]))).toBe(true)
      expect(meetsInspectionPhotoSizeTarget(new Blob([new Uint8Array(501 * 1024)]))).toBe(false)
    })

    it('isAcceptableInspectionPhotoQuality allows inspection-grade JPEG quality band', () => {
      expect(isAcceptableInspectionPhotoQuality(0.8)).toBe(true)
      expect(isAcceptableInspectionPhotoQuality(0.69)).toBe(false)
      expect(isAcceptableInspectionPhotoQuality(0.91)).toBe(false)
    })
  })

  describe('DEFAULT_INSPECTION_PHOTO_COMPRESSION_OPTIONS', () => {
    it('matches M11-S9 targets: 500KB cap, 1920 edge, JPEG 0.8, web worker, memory-friendly flags', () => {
      expect(DEFAULT_INSPECTION_PHOTO_COMPRESSION_OPTIONS.maxSizeMB).toBe(0.5)
      expect(DEFAULT_INSPECTION_PHOTO_COMPRESSION_OPTIONS.maxWidthOrHeight).toBe(1920)
      expect(DEFAULT_INSPECTION_PHOTO_COMPRESSION_OPTIONS.initialQuality).toBe(0.8)
      expect(DEFAULT_INSPECTION_PHOTO_COMPRESSION_OPTIONS.useWebWorker).toBe(true)
      expect(DEFAULT_INSPECTION_PHOTO_COMPRESSION_OPTIONS.fileType).toBe('image/jpeg')
      expect(DEFAULT_INSPECTION_PHOTO_COMPRESSION_OPTIONS.preserveExif).toBe(false)
      expect(DEFAULT_INSPECTION_PHOTO_COMPRESSION_OPTIONS.alwaysKeepResolution).toBe(false)
    })
  })

  describe('mergeInspectionPhotoCompressionOptions', () => {
    it('merges overrides while keeping other defaults', () => {
      const merged = mergeInspectionPhotoCompressionOptions({
        maxSizeMB: 0.25,
        useWebWorker: false,
      })
      expect(merged.maxSizeMB).toBe(0.25)
      expect(merged.useWebWorker).toBe(false)
      expect(merged.maxWidthOrHeight).toBe(1920)
      expect(merged.initialQuality).toBe(0.8)
      expect(merged.fileType).toBe('image/jpeg')
    })
  })

  describe('compressInspectionPhoto', () => {
    it('calls imageCompression with merged defaults', async () => {
      const file = new File([new Uint8Array([1, 2, 3])], 'a.jpg', { type: 'image/jpeg' })
      await compressInspectionPhoto(file)
      expect(imageCompressionMock).toHaveBeenCalledTimes(1)
      expect(imageCompressionMock).toHaveBeenCalledWith(
        file,
        expect.objectContaining(DEFAULT_INSPECTION_PHOTO_COMPRESSION_OPTIONS),
      )
    })

    it('wraps Blob as File before compression', async () => {
      const blob = new Blob([new Uint8Array([9, 9])], { type: 'image/jpeg' })
      await compressInspectionPhoto(blob)
      const passed = imageCompressionMock.mock.calls[0][0] as File
      expect(passed).toBeInstanceOf(File)
      expect(passed.name).toBe('inspection-photo.jpg')
      expect(passed.type).toBe('image/jpeg')
    })

    it('passes partial options to the library', async () => {
      const file = new File([new Uint8Array([1])], 'b.jpg', { type: 'image/jpeg' })
      await compressInspectionPhoto(file, { maxSizeMB: 0.2, initialQuality: 0.85 })
      expect(imageCompressionMock).toHaveBeenCalledWith(
        file,
        expect.objectContaining({
          maxSizeMB: 0.2,
          initialQuality: 0.85,
          maxWidthOrHeight: 1920,
        }),
      )
    })

    it('returns smaller file when the library reduces size', async () => {
      const large = new File([new Uint8Array(800_000)], 'big.jpg', { type: 'image/jpeg' })
      const small = new File([new Uint8Array(100_000)], 'small.jpg', { type: 'image/jpeg' })
      imageCompressionMock.mockResolvedValueOnce(small)

      const out = await compressInspectionPhoto(large)
      expect(out.size).toBeLessThan(large.size)
      expect(out.size).toBeLessThanOrEqual(INSPECTION_PHOTO_MAX_SIZE_BYTES)
    })

    it('retries with lower quality when first pass still exceeds 500KB', async () => {
      const raw = new File([new Uint8Array(900_000)], 'oversized.jpg', { type: 'image/jpeg' })
      const stillLarge = new File([new Uint8Array(600_000)], 'still-large.jpg', {
        type: 'image/jpeg',
      })
      const withinTarget = new File([new Uint8Array(450_000)], 'within.jpg', {
        type: 'image/jpeg',
      })
      imageCompressionMock.mockResolvedValueOnce(stillLarge).mockResolvedValueOnce(withinTarget)

      const out = await compressInspectionPhoto(raw)
      expect(imageCompressionMock).toHaveBeenCalledTimes(2)
      expect(out.size).toBeLessThanOrEqual(INSPECTION_PHOTO_MAX_SIZE_BYTES)
      const retryOpts = imageCompressionMock.mock.calls[1][1] as { initialQuality?: number }
      expect(retryOpts.initialQuality).toBeLessThan(0.8)
    })

    it('throws size_exceeded when output remains above 500KB after retry', async () => {
      const huge = new File([new Uint8Array(900_000)], 'huge.jpg', { type: 'image/jpeg' })
      const stillHuge = new File([new Uint8Array(700_000)], 'still-huge.jpg', {
        type: 'image/jpeg',
      })
      imageCompressionMock.mockResolvedValue(stillHuge)

      await expect(compressInspectionPhoto(huge)).rejects.toMatchObject({
        code: 'size_exceeded',
        name: 'InspectionPhotoCompressionError',
      })
    })

    it('rejects when compression exceeds the 2 second budget', async () => {
      vi.useFakeTimers()
      const file = new File([new Uint8Array([1])], 'slow.jpg', { type: 'image/jpeg' })
      imageCompressionMock.mockImplementation(
        (_input: File, opts?: { signal?: AbortSignal }) =>
          new Promise<File>((_resolve, reject) => {
            opts?.signal?.addEventListener(
              'abort',
              () => reject(new DOMException('Aborted', 'AbortError')),
              { once: true },
            )
          }),
      )

      const pending = compressInspectionPhoto(file)
      const assertion = expect(pending).rejects.toMatchObject({
        code: 'timeout',
        name: 'InspectionPhotoCompressionError',
      })
      await vi.advanceTimersByTimeAsync(INSPECTION_PHOTO_MAX_COMPRESSION_MS + 1)
      await assertion
      vi.clearAllTimers()
      vi.useRealTimers()
    })

    it('preserves dimensions intent via maxWidthOrHeight in options', async () => {
      const file = new File([new Uint8Array([1])], 'c.jpg', { type: 'image/jpeg' })
      await compressInspectionPhoto(file)
      const opts = imageCompressionMock.mock.calls[0][1] as { maxWidthOrHeight?: number }
      expect(opts.maxWidthOrHeight).toBe(1920)
    })

    it('defaults useWebWorker true for mobile-friendly offload', async () => {
      const file = new File([new Uint8Array([1])], 'd.jpg', { type: 'image/jpeg' })
      await compressInspectionPhoto(file)
      const opts = imageCompressionMock.mock.calls[0][1] as { useWebWorker?: boolean }
      expect(opts.useWebWorker).toBe(true)
    })

    it('skips EXIF preservation to reduce memory footprint on device', async () => {
      const file = new File([new Uint8Array([1])], 'e.jpg', { type: 'image/jpeg' })
      await compressInspectionPhoto(file)
      const opts = imageCompressionMock.mock.calls[0][1] as { preserveExif?: boolean }
      expect(opts.preserveExif).toBe(false)
    })
  })
})
