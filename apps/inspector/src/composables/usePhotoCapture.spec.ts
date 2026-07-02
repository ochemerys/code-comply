import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { toRaw } from 'vue'
import {
  usePhotoCapture,
  captureStillFromStream,
  PHOTO_CAPTURE_CONSTRAINTS,
  PHOTO_CAPTURE_FALLBACK_CONSTRAINTS,
} from './usePhotoCapture'

function createMockStream(): MediaStream {
  const track = {
    stop: vi.fn(),
    kind: 'video',
  } as unknown as MediaStreamTrack
  return {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  } as unknown as MediaStream
}

describe('usePhotoCapture', () => {
  let getUserMedia: ReturnType<typeof vi.fn>

  beforeEach(() => {
    getUserMedia = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      writable: true,
      value: { getUserMedia },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('startCamera', () => {
    it('requests the camera with primary constraints', async () => {
      const mockStream = createMockStream()
      getUserMedia.mockResolvedValueOnce(mockStream)

      const { stream, error, startCamera } = usePhotoCapture()
      await startCamera()

      expect(getUserMedia).toHaveBeenCalledWith(PHOTO_CAPTURE_CONSTRAINTS)
      expect(toRaw(stream.value)).toBe(mockStream)
      expect(error.value).toBeNull()
    })

    it('falls back to simpler constraints when the first request fails (non-permission)', async () => {
      const mockStream = createMockStream()
      getUserMedia
        .mockRejectedValueOnce(new Error('Overconstrained'))
        .mockResolvedValueOnce(mockStream)

      const { stream, startCamera } = usePhotoCapture()
      await startCamera()

      expect(getUserMedia).toHaveBeenNthCalledWith(1, PHOTO_CAPTURE_CONSTRAINTS)
      expect(getUserMedia).toHaveBeenNthCalledWith(2, PHOTO_CAPTURE_FALLBACK_CONSTRAINTS)
      expect(toRaw(stream.value)).toBe(mockStream)
    })

    it('does not fall back on permission denied', async () => {
      const denied = new Error('Permission denied') as Error & { name: string }
      denied.name = 'NotAllowedError'
      getUserMedia.mockRejectedValue(denied)

      const { stream, error, startCamera } = usePhotoCapture()

      await expect(startCamera()).rejects.toThrow()
      expect(getUserMedia).toHaveBeenCalledTimes(1)
      expect(stream.value).toBeNull()
      expect(error.value?.name).toBe('NotAllowedError')
    })

    it('sets error when camera API is missing', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        writable: true,
        value: undefined,
      })

      const { stream, error, startCamera } = usePhotoCapture()
      await expect(startCamera()).rejects.toThrow(/not supported/)
      expect(stream.value).toBeNull()
      expect(error.value?.message).toMatch(/not supported/)
    })

    it('stops an existing stream before starting a new one', async () => {
      const first = createMockStream()
      const second = createMockStream()
      getUserMedia.mockResolvedValueOnce(first).mockResolvedValueOnce(second)

      const { startCamera } = usePhotoCapture()
      await startCamera()
      await startCamera()

      expect(first.getTracks()[0].stop).toHaveBeenCalled()
      expect(getUserMedia).toHaveBeenCalledTimes(2)
    })

    it('toggleFacingMode flips facing and reopens the camera when a stream is active', async () => {
      const first = createMockStream()
      const second = createMockStream()
      getUserMedia.mockResolvedValueOnce(first).mockResolvedValueOnce(second)

      const { facingMode, startCamera, toggleFacingMode } = usePhotoCapture()
      await startCamera()
      expect(facingMode.value).toBe('environment')

      await toggleFacingMode()

      expect(facingMode.value).toBe('user')
      expect(first.getTracks()[0].stop).toHaveBeenCalled()
      expect(getUserMedia).toHaveBeenCalledTimes(2)
      expect(getUserMedia).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          video: expect.objectContaining({ facingMode: 'user' }),
        }),
      )
    })
  })

  describe('capturePhoto', () => {
    it('throws when camera was not started', async () => {
      const { capturePhoto, error } = usePhotoCapture()
      await expect(capturePhoto()).rejects.toThrow(/not started/)
      expect(error.value?.message).toMatch(/not started/)
    })

    it('returns a blob and updates photo ref', async () => {
      const mockBlob = new Blob(['jpeg'], { type: 'image/jpeg' })
      const mockStream = createMockStream()
      getUserMedia.mockResolvedValue(mockStream)

      const originalCreate = document.createElement.bind(document)
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'video') {
          const v = originalCreate('video') as HTMLVideoElement
          Object.defineProperty(v, 'videoWidth', { value: 2, configurable: true })
          Object.defineProperty(v, 'videoHeight', { value: 2, configurable: true })
          v.play = vi.fn().mockResolvedValue(undefined)
          queueMicrotask(() => v.dispatchEvent(new Event('loadedmetadata')))
          return v
        }
        if (tag === 'canvas') {
          const c = originalCreate('canvas') as HTMLCanvasElement
          const ctx = { drawImage: vi.fn() }
          c.getContext = vi.fn().mockReturnValue(ctx)
          c.toBlob = vi.fn((cb: BlobCallback | null) => {
            if (cb) cb(mockBlob)
          })
          return c
        }
        return originalCreate(tag)
      })

      const { stream, photo, isCapturing, capturePhoto, startCamera } = usePhotoCapture()
      await startCamera()

      expect(isCapturing.value).toBe(false)
      const blob = await capturePhoto()

      expect(blob).toBe(mockBlob)
      expect(photo.value).toBe(mockBlob)
      expect(toRaw(stream.value)).toBe(mockStream)
    })
  })

  describe('stopCamera', () => {
    it('stops tracks and clears stream', async () => {
      const mockStream = createMockStream()
      getUserMedia.mockResolvedValue(mockStream)

      const { stream, stopCamera, startCamera } = usePhotoCapture()
      await startCamera()
      await stopCamera()

      expect(mockStream.getTracks()[0].stop).toHaveBeenCalled()
      expect(stream.value).toBeNull()
    })

    it('is safe when no stream is active', async () => {
      const { stopCamera } = usePhotoCapture()
      await expect(stopCamera()).resolves.toBeUndefined()
    })
  })
})

describe('captureStillFromStream', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves a JPEG blob from stream frames', async () => {
    const mockBlob = new Blob(['x'], { type: 'image/jpeg' })
    const mockStream = {} as MediaStream

    const originalCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'video') {
        const v = originalCreate('video') as HTMLVideoElement
        Object.defineProperty(v, 'videoWidth', { value: 2, configurable: true })
        Object.defineProperty(v, 'videoHeight', { value: 2, configurable: true })
        v.play = vi.fn().mockResolvedValue(undefined)
        queueMicrotask(() => v.dispatchEvent(new Event('loadedmetadata')))
        return v
      }
      if (tag === 'canvas') {
        const c = originalCreate('canvas') as HTMLCanvasElement
        const ctx = { drawImage: vi.fn() }
        c.getContext = vi.fn().mockReturnValue(ctx)
        c.toBlob = vi.fn((cb: BlobCallback | null) => {
          if (cb) cb(mockBlob)
        })
        return c
      }
      return originalCreate(tag)
    })

    const blob = await captureStillFromStream(mockStream)
    expect(blob).toBe(mockBlob)
    expect(blob.type).toBe('image/jpeg')
  })

  it('rejects when canvas context is unavailable', async () => {
    const mockStream = {} as MediaStream
    const originalCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'video') {
        const v = originalCreate('video') as HTMLVideoElement
        Object.defineProperty(v, 'videoWidth', { value: 2, configurable: true })
        Object.defineProperty(v, 'videoHeight', { value: 2, configurable: true })
        v.play = vi.fn().mockResolvedValue(undefined)
        queueMicrotask(() => v.dispatchEvent(new Event('loadedmetadata')))
        return v
      }
      if (tag === 'canvas') {
        const c = originalCreate('canvas') as HTMLCanvasElement
        c.getContext = vi.fn().mockReturnValue(null)
        return c
      }
      return originalCreate(tag)
    })

    await expect(captureStillFromStream(mockStream)).rejects.toThrow(/2D context/)
  })
})
