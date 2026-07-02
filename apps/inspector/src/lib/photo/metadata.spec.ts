import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  buildEmbeddedPhotoMetadata,
  toPhotoMetadata,
  watermarkLines,
  drawWatermarkOnCanvas,
  embedPhotoMetadataInImage,
  getDefaultDeviceInfo,
  type EmbeddedPhotoMetadata,
} from './metadata'

describe('photo metadata (M7-S3)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const fixedDate = new Date('2026-04-11T15:30:00.000Z')
  const baseInput = {
    capturedAt: fixedDate,
    inspectorId: 'inspector-42',
    inspectorName: 'Alex Inspector',
    permitNumber: 'BP-2026-001',
    deviceInfo: 'vitest-test-agent',
  }

  describe('buildEmbeddedPhotoMetadata', () => {
    it('sets ISO 8601 timestamp', () => {
      const m = buildEmbeddedPhotoMetadata(baseInput)
      expect(m.timestamp).toBe('2026-04-11T15:30:00.000Z')
    })

    it('embeds inspector id and name', () => {
      const m = buildEmbeddedPhotoMetadata(baseInput)
      expect(m.inspectorId).toBe('inspector-42')
      expect(m.inspectorName).toBe('Alex Inspector')
    })

    it('embeds permit number', () => {
      const m = buildEmbeddedPhotoMetadata(baseInput)
      expect(m.permitNumber).toBe('BP-2026-001')
    })

    it('embeds device info when provided', () => {
      const m = buildEmbeddedPhotoMetadata(baseInput)
      expect(m.deviceInfo).toBe('vitest-test-agent')
    })

    it('uses navigator.userAgent when deviceInfo omitted', () => {
      vi.stubGlobal('navigator', { userAgent: 'stubbed-ua' })
      const m = buildEmbeddedPhotoMetadata({
        inspectorId: 'i',
        inspectorName: 'N',
      })
      expect(m.deviceInfo).toBe('stubbed-ua')
    })

    it('embeds GPS when provided', () => {
      const m = buildEmbeddedPhotoMetadata({
        ...baseInput,
        gps: { latitude: 53.5461, longitude: -113.4938, accuracy: 12.5 },
      })
      expect(m.gps).toEqual({
        latitude: 53.5461,
        longitude: -113.4938,
        accuracy: 12.5,
      })
    })

    it('uses null gps when omitted', () => {
      const m = buildEmbeddedPhotoMetadata(baseInput)
      expect(m.gps).toBeNull()
    })
  })

  describe('toPhotoMetadata', () => {
    it('maps embedded fields for Dexie storage', () => {
      const embedded = buildEmbeddedPhotoMetadata({
        ...baseInput,
        gps: { latitude: 1, longitude: 2, accuracy: 5 },
      })
      const stored = toPhotoMetadata(embedded, { hasWatermark: true })
      expect(stored.timestamp).toBe(embedded.timestamp)
      expect(stored.inspectorId).toBe('inspector-42')
      expect(stored.inspectorName).toBe('Alex Inspector')
      expect(stored.permitNumber).toBe('BP-2026-001')
      expect(stored.deviceInfo).toBe('vitest-test-agent')
      expect(stored.latitude).toBe(1)
      expect(stored.longitude).toBe(2)
      expect(stored.accuracyMeters).toBe(5)
      expect(stored.hasWatermark).toBe(true)
    })

    it('marks watermark off when disabled', () => {
      const embedded = buildEmbeddedPhotoMetadata(baseInput)
      const stored = toPhotoMetadata(embedded, { hasWatermark: false })
      expect(stored.hasWatermark).toBe(false)
    })
  })

  describe('watermarkLines', () => {
    it('includes timestamp, inspector name, and permit', () => {
      const embedded = buildEmbeddedPhotoMetadata(baseInput)
      const lines = watermarkLines(embedded)
      expect(lines[0]).toBe('2026-04-11T15:30:00.000Z')
      expect(lines[1]).toBe('Alex Inspector')
      expect(lines[2]).toBe('BP-2026-001')
    })
  })

  describe('drawWatermarkOnCanvas', () => {
    it('draws semi-transparent box and text lines', () => {
      const embedded = buildEmbeddedPhotoMetadata(baseInput)
      const ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        measureText: vi.fn(() => ({ width: 80 })),
        fillRect: vi.fn(),
        fillText: vi.fn(),
        font: '',
        fillStyle: '',
      } as unknown as CanvasRenderingContext2D

      drawWatermarkOnCanvas(ctx, 640, 480, embedded)

      expect(ctx.save).toHaveBeenCalled()
      expect(ctx.measureText).toHaveBeenCalled()
      expect(ctx.fillRect).toHaveBeenCalled()
      expect(ctx.fillText).toHaveBeenCalled()
      expect(ctx.restore).toHaveBeenCalled()
    })
  })

  describe('embedPhotoMetadataInImage', () => {
    const embedded: EmbeddedPhotoMetadata = {
      timestamp: '2026-04-11T15:30:00.000Z',
      gps: null,
      inspectorId: 'i',
      inspectorName: 'Pat',
      permitNumber: 'P-1',
      deviceInfo: 'ua',
    }

    let originalCreateElement: typeof document.createElement

    beforeEach(() => {
      originalCreateElement = document.createElement.bind(document)
      vi.stubGlobal('URL', {
        createObjectURL: vi.fn(() => 'blob:vitest-mock'),
        revokeObjectURL: vi.fn(),
      } as unknown as typeof URL)
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('rejects non-image blobs', async () => {
      await expect(
        embedPhotoMetadataInImage(new Blob(['x'], { type: 'text/plain' }), embedded, {
          enabled: false,
        }),
      ).rejects.toThrow(/image/i)
    })

    it('returns JPEG with watermark when enabled', async () => {
      const outBlob = new Blob(['jpeg-out'], { type: 'image/jpeg' })
      const mockBitmap = { width: 8, height: 6, close: vi.fn() }
      vi.stubGlobal(
        'createImageBitmap',
        vi.fn().mockResolvedValue(mockBitmap as unknown as ImageBitmap),
      )

      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') {
          const c = originalCreateElement('canvas') as HTMLCanvasElement
          c.getContext = vi.fn().mockReturnValue({
            drawImage: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            measureText: vi.fn(() => ({ width: 40 })),
            fillRect: vi.fn(),
            fillText: vi.fn(),
            font: '',
            fillStyle: '',
          })
          c.toBlob = vi.fn((cb: BlobCallback | null) => {
            if (cb) cb(outBlob)
          })
          return c
        }
        return originalCreateElement(tag)
      })

      const result = await embedPhotoMetadataInImage(
        new Blob(['img'], { type: 'image/jpeg' }),
        embedded,
        { enabled: true },
      )
      expect(result.type).toBe('image/jpeg')
      expect(globalThis.createImageBitmap).toHaveBeenCalled()
      expect(mockBitmap.close).toHaveBeenCalled()
    })

    it('throws when canvas 2d context is unavailable', async () => {
      const mockBitmap = { width: 4, height: 4, close: vi.fn() }
      vi.stubGlobal(
        'createImageBitmap',
        vi.fn().mockResolvedValue(mockBitmap as unknown as ImageBitmap),
      )
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') {
          const c = originalCreateElement('canvas') as HTMLCanvasElement
          c.getContext = vi.fn().mockReturnValue(null)
          return c
        }
        return originalCreateElement(tag)
      })
      await expect(
        embedPhotoMetadataInImage(new Blob(['img'], { type: 'image/jpeg' }), embedded, {
          enabled: false,
        }),
      ).rejects.toThrow(/Canvas 2D context/)
    })

    it('falls back to HTML Image when createImageBitmap is unavailable', async () => {
      const outBlob = new Blob(['jpeg-fallback'], { type: 'image/jpeg' })
      vi.stubGlobal('createImageBitmap', undefined)
      class MockImage {
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        naturalWidth = 12
        naturalHeight = 8
        set src(_value: string) {
          queueMicrotask(() => this.onload?.())
        }
      }
      vi.stubGlobal('Image', MockImage as unknown as typeof Image)

      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') {
          const c = originalCreateElement('canvas') as HTMLCanvasElement
          c.getContext = vi.fn().mockReturnValue({
            drawImage: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            measureText: vi.fn(() => ({ width: 40 })),
            fillRect: vi.fn(),
            fillText: vi.fn(),
            font: '',
            fillStyle: '',
          })
          c.toBlob = vi.fn((cb: BlobCallback | null) => {
            if (cb) cb(outBlob)
          })
          return c
        }
        return originalCreateElement(tag)
      })

      const result = await embedPhotoMetadataInImage(
        new Blob(['img'], { type: 'image/jpeg' }),
        embedded,
        { enabled: false },
      )
      expect(result).toBe(outBlob)
    })

    it('falls back to HTML Image when createImageBitmap rejects', async () => {
      const outBlob = new Blob(['jpeg-fallback'], { type: 'image/jpeg' })
      vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('bitmap failed')))
      class MockImage {
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        naturalWidth = 12
        naturalHeight = 8
        set src(_value: string) {
          queueMicrotask(() => this.onload?.())
        }
      }
      vi.stubGlobal('Image', MockImage as unknown as typeof Image)

      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') {
          const c = originalCreateElement('canvas') as HTMLCanvasElement
          c.getContext = vi.fn().mockReturnValue({
            drawImage: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            measureText: vi.fn(() => ({ width: 40 })),
            fillRect: vi.fn(),
            fillText: vi.fn(),
            font: '',
            fillStyle: '',
          })
          c.toBlob = vi.fn((cb: BlobCallback | null) => {
            if (cb) cb(outBlob)
          })
          return c
        }
        return originalCreateElement(tag)
      })

      const result = await embedPhotoMetadataInImage(
        new Blob(['img'], { type: 'image/jpeg' }),
        embedded,
        { enabled: false },
      )
      expect(result).toBe(outBlob)
    })

    it('rejects when HTML Image fails to load', async () => {
      vi.stubGlobal('createImageBitmap', undefined)
      class BadImage {
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        set src(_value: string) {
          queueMicrotask(() => this.onerror?.())
        }
      }
      vi.stubGlobal('Image', BadImage as unknown as typeof Image)

      await expect(
        embedPhotoMetadataInImage(new Blob(['img'], { type: 'image/jpeg' }), embedded, {
          enabled: false,
        }),
      ).rejects.toThrow(/Failed to load image/)
    })

    it('rejects when HTML Image has no dimensions', async () => {
      vi.stubGlobal('createImageBitmap', undefined)
      class ZeroImage {
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        naturalWidth = 0
        naturalHeight = 0
        set src(_value: string) {
          queueMicrotask(() => this.onload?.())
        }
      }
      vi.stubGlobal('Image', ZeroImage as unknown as typeof Image)

      await expect(
        embedPhotoMetadataInImage(new Blob(['img'], { type: 'image/jpeg' }), embedded, {
          enabled: false,
        }),
      ).rejects.toThrow(/dimensions/)
    })
  })

  describe('getDefaultDeviceInfo', () => {
    it('returns user agent in browser-like env', () => {
      vi.stubGlobal('navigator', { userAgent: 'ua-from-nav' })
      expect(getDefaultDeviceInfo()).toBe('ua-from-nav')
    })
  })
})
