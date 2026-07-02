/**
 * Integration: compress inspection photo then persist LocalPhoto row (M7-S4).
 * `browser-image-compression` does not complete under jsdom; the module is mocked like other canvas-heavy paths.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { db } from '@/lib/db/dexie'
import type { LocalPhoto } from '@/lib/db/types'
import { buildEmbeddedPhotoMetadata, toPhotoMetadata } from '@/lib/photo/metadata'
import { compressInspectionPhoto } from '@/lib/photo/compression'

const imageCompressionMock = vi.hoisted(() => vi.fn())

vi.mock('browser-image-compression', () => ({
  default: imageCompressionMock,
}))

describe('photo compression integration', () => {
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

  it('stores compressed blob on LocalPhoto with metadata from M7-S3 helpers', async () => {
    const raw = new File([new Uint8Array(900 * 1024)], 'evidence-raw.jpg', { type: 'image/jpeg' })
    const compressed = await compressInspectionPhoto(raw, { useWebWorker: false })

    expect(compressed.size).toBeLessThan(raw.size)
    expect(compressed.size).toBeLessThanOrEqual(500 * 1024)

    const embedded = buildEmbeddedPhotoMetadata({
      capturedAt: new Date('2026-04-11T17:00:00.000Z'),
      inspectorId: 'user-compress',
      inspectorName: 'Compress Tester',
      permitNumber: 'BP-CMP-7',
      deviceInfo: 'integration',
    })
    const metadata = toPhotoMetadata(embedded, { hasWatermark: false })

    const row: LocalPhoto = {
      id: 'photo-cmp-1',
      clientId: 'client-cmp-1',
      deficiencyId: 'def-cmp-1',
      inspectionId: 'insp-cmp-1',
      filename: compressed.name,
      mimeType: compressed.type,
      size: compressed.size,
      metadata,
      createdAt: embedded.timestamp,
    }

    await db.photos.put(row)
    const read = await db.photos.get('photo-cmp-1')
    expect(read?.size).toBe(compressed.size)
    expect(read?.mimeType).toBe('image/jpeg')
    expect(read?.metadata.permitNumber).toBe('BP-CMP-7')
  })
})
