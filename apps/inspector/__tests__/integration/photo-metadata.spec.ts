/**
 * Integration: photo metadata helpers + IndexedDB row shape (M7-S3).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { db } from '@/lib/db/dexie'
import type { LocalPhoto } from '@/lib/db/types'
import {
  buildEmbeddedPhotoMetadata,
  toPhotoMetadata,
  embedPhotoMetadataInImage,
} from '@/lib/photo/metadata'

describe('photo metadata integration', () => {
  beforeEach(async () => {
    await db.photos.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('persists LocalPhoto.metadata built from embedded metadata', async () => {
    const embedded = buildEmbeddedPhotoMetadata({
      capturedAt: new Date('2026-04-11T16:00:00.000Z'),
      gps: { latitude: 53.5, longitude: -113.5, accuracy: 8 },
      inspectorId: 'user-int',
      inspectorName: 'Integration Tester',
      permitNumber: 'BP-INT-7',
      deviceInfo: 'integration-ua',
    })
    const metadata = toPhotoMetadata(embedded, { hasWatermark: false })

    const row: LocalPhoto = {
      id: 'photo-int-1',
      clientId: 'client-int-1',
      deficiencyId: 'def-int-1',
      inspectionId: 'insp-int-1',
      filename: 'evidence.jpg',
      mimeType: 'image/jpeg',
      size: 100,
      metadata,
      createdAt: embedded.timestamp,
    }

    await db.photos.put(row)
    const read = await db.photos.get('photo-int-1')
    expect(read?.metadata.timestamp).toBe('2026-04-11T16:00:00.000Z')
    expect(read?.metadata.inspectorId).toBe('user-int')
    expect(read?.metadata.inspectorName).toBe('Integration Tester')
    expect(read?.metadata.permitNumber).toBe('BP-INT-7')
    expect(read?.metadata.deviceInfo).toBe('integration-ua')
    expect(read?.metadata.latitude).toBe(53.5)
    expect(read?.metadata.longitude).toBe(-113.5)
    expect(read?.metadata.accuracyMeters).toBe(8)
    expect(read?.metadata.hasWatermark).toBe(false)
  })

  it('produces JPEG blob via embedPhotoMetadataInImage with mocked bitmap pipeline', async () => {
    const originalCreateElement = document.createElement.bind(document)
    const outBlob = new Blob(['final-jpeg'], { type: 'image/jpeg' })
    const mockBitmap = { width: 4, height: 4, close: vi.fn() }
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

    const embedded = buildEmbeddedPhotoMetadata({
      capturedAt: new Date('2026-04-11T16:00:00.000Z'),
      inspectorId: 'u',
      inspectorName: 'W',
      deviceInfo: 'x',
    })

    const blob = await embedPhotoMetadataInImage(
      new Blob(['src'], { type: 'image/jpeg' }),
      embedded,
      { enabled: true },
    )
    expect(blob.type).toBe('image/jpeg')
  })
})
