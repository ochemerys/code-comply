/**
 * Integration: M11-S9 optimized compression path with IndexedDB persistence.
 * `browser-image-compression` is mocked (canvas/worker unavailable in jsdom).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { db } from '@/lib/db/dexie'
import type { LocalPhoto } from '@/lib/db/types'
import { buildEmbeddedPhotoMetadata, toPhotoMetadata } from '@/lib/photo/metadata'
import {
  compressInspectionPhoto,
  INSPECTION_PHOTO_MAX_SIZE_BYTES,
  INSPECTION_PHOTO_INITIAL_QUALITY,
  isAcceptableInspectionPhotoQuality,
  meetsInspectionPhotoSizeTarget,
} from '@/lib/photo/compression'

const imageCompressionMock = vi.hoisted(() => vi.fn())

vi.mock('browser-image-compression', () => ({
  default: imageCompressionMock,
}))

describe('photo compression performance integration (M11-S9)', () => {
  beforeEach(async () => {
    await db.photos.clear()
    vi.clearAllMocks()
    imageCompressionMock.mockImplementation(async (file: File) => {
      const reduced = new Uint8Array(Math.min(file.size, 400 * 1024))
      return new File([reduced], file.name.replace(/\.[^.]+$/, '') + '-compressed.jpg', {
        type: 'image/jpeg',
        lastModified: Date.now(),
      })
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('compresses under 500KB with story quality defaults within the time budget', async () => {
    const raw = new File([new Uint8Array(900 * 1024)], 'evidence-raw.jpg', { type: 'image/jpeg' })
    const started = performance.now()
    const compressed = await compressInspectionPhoto(raw, { useWebWorker: false })
    const elapsedMs = performance.now() - started

    expect(compressed.size).toBeLessThan(raw.size)
    expect(meetsInspectionPhotoSizeTarget(compressed)).toBe(true)
    expect(compressed.size).toBeLessThanOrEqual(INSPECTION_PHOTO_MAX_SIZE_BYTES)
    expect(elapsedMs).toBeLessThan(2000)
    expect(isAcceptableInspectionPhotoQuality(INSPECTION_PHOTO_INITIAL_QUALITY)).toBe(true)

    const embedded = buildEmbeddedPhotoMetadata({
      capturedAt: new Date('2026-05-19T12:00:00.000Z'),
      inspectorId: 'user-m11-s9',
      inspectorName: 'Performance Tester',
      permitNumber: 'BP-M11-S9',
      deviceInfo: 'integration',
    })
    const metadata = toPhotoMetadata(embedded, { hasWatermark: false })

    const row: LocalPhoto = {
      id: 'photo-m11-s9-1',
      clientId: 'client-m11-s9-1',
      deficiencyId: 'def-m11-s9-1',
      inspectionId: 'insp-m11-s9-1',
      filename: compressed.name,
      mimeType: compressed.type,
      size: compressed.size,
      metadata,
      createdAt: embedded.timestamp,
    }

    await db.photos.put(row)
    const read = await db.photos.get('photo-m11-s9-1')
    expect(read?.size).toBe(compressed.size)
    expect(read?.mimeType).toBe('image/jpeg')
    expect(read?.metadata.permitNumber).toBe('BP-M11-S9')
  })
})
