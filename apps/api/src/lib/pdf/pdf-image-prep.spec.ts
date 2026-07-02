import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { PDF_EMBED_MAX_EDGE_PX, PDF_SKIP_RESIZE_IF_BYTES_BELOW } from './pdf-generation-config.js'
import {
  preparePhotoBufferForPdfEmbed,
  preparePhotoBuffersForPdf,
  resetPdfImageWorkerPoolForTests,
} from './pdf-image-prep.js'

const MINIMAL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

describe('pdf-image-prep (M11-S12)', () => {
  it('preparePhotoBufferForPdfEmbed returns JPEG within max edge', async () => {
    const large = await sharp({
      create: { width: 2400, height: 1800, channels: 3, background: '#336699' },
    })
      .jpeg()
      .toBuffer()

    const sourceMeta = await sharp(large).metadata()
    expect(Math.max(sourceMeta.width ?? 0, sourceMeta.height ?? 0)).toBeGreaterThan(
      PDF_EMBED_MAX_EDGE_PX,
    )

    const prepared = await preparePhotoBufferForPdfEmbed(large)
    const meta = await sharp(prepared).metadata()
    expect(meta.format).toBe('jpeg')
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(PDF_EMBED_MAX_EDGE_PX)
    expect(prepared.length).toBeLessThan(large.length)
  })

  it('preparePhotoBuffersForPdf processes photos with bounded concurrency and progress', async () => {
    const photos = Array.from({ length: 5 }, (_, i) => ({
      id: `ph-${i}`,
      storageKey: `key-${i}.jpg`,
    }))
    const progress: number[] = []

    const buffers = await preparePhotoBuffersForPdf(
      photos,
      async () => MINIMAL_PNG,
      (p) => {
        if (p.phase === 'preparing-images') progress.push(p.completed)
      },
    )

    expect(buffers).toHaveLength(5)
    expect(progress.some((n) => n === 5)).toBe(true)
  })

  it('preparePhotoBuffersForPdf skips failed fetches without failing the batch', async () => {
    const buffers = await preparePhotoBuffersForPdf(
      [{ id: 'a', storageKey: 'missing' }],
      async () => {
        throw new Error('storage down')
      },
    )
    expect(buffers).toHaveLength(0)
  })

  it('preparePhotoBufferForPdfEmbed returns raw buffer for small images within max edge', async () => {
    const tiny = await sharp({
      create: { width: 400, height: 300, channels: 3, background: '#112233' },
    })
      .jpeg()
      .toBuffer()

    expect(tiny.length).toBeLessThan(PDF_SKIP_RESIZE_IF_BYTES_BELOW)

    const prepared = await preparePhotoBufferForPdfEmbed(tiny)
    expect(prepared).toBe(tiny)
  })

  it('preparePhotoBufferForPdfEmbed returns raw buffer when metadata cannot be read', async () => {
    const invalid = Buffer.from('not-an-image')
    expect(invalid.length).toBeLessThan(PDF_SKIP_RESIZE_IF_BYTES_BELOW)

    const prepared = await preparePhotoBufferForPdfEmbed(invalid)
    expect(prepared).toBe(invalid)
  })

  it('preparePhotoBuffersForPdf ignores photos without storage keys', async () => {
    const fetchSpy = vi.fn(async () => MINIMAL_PNG)
    const buffers = await preparePhotoBuffersForPdf(
      [
        { id: 'skip', storageKey: null },
        { id: 'keep', storageKey: 'key.jpg' },
      ],
      fetchSpy,
    )

    expect(buffers).toHaveLength(1)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('preparePhotoBuffersForPdf skips null fetch results', async () => {
    const buffers = await preparePhotoBuffersForPdf(
      [{ id: 'missing', storageKey: 'key.jpg' }],
      async () => null,
    )
    expect(buffers).toHaveLength(0)
  })

  it('resetPdfImageWorkerPoolForTests is safe when no pool exists', async () => {
    await expect(resetPdfImageWorkerPoolForTests()).resolves.toBeUndefined()
  })
})
