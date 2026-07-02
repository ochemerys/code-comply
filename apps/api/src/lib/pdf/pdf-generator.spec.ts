import { describe, it, expect } from 'vitest'
import {
  DEFAULT_INSPECTION_PDF_LAYOUT,
  generateInspectionPdfBuffer,
  generateTwoPageTextPdf,
} from './pdf-generator'

/** 1×1 PNG (transparent). */
const MINIMAL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

function assertPdfMagic(buffer: Buffer) {
  expect(buffer.subarray(0, 5).toString('utf8')).toBe('%PDF-')
  expect(
    buffer
      .subarray(buffer.length - 6)
      .toString('utf8')
      .trimEnd(),
  ).toMatch(/%%EOF/)
}

function countPageObjects(buffer: Buffer): number {
  const s = buffer.toString('latin1')
  const matches = s.match(/\/Type\s*\/Page\b/g)
  return matches?.length ?? 0
}

describe('pdf-generator', () => {
  it('uses Letter layout and Helvetica defaults', () => {
    expect(DEFAULT_INSPECTION_PDF_LAYOUT.size).toBe('LETTER')
    expect(DEFAULT_INSPECTION_PDF_LAYOUT.margin).toBe(72)
    expect(DEFAULT_INSPECTION_PDF_LAYOUT.bodyFont).toBe('Helvetica')
  })

  it('creates a PDF buffer with title and body text', async () => {
    const buf = await generateInspectionPdfBuffer({
      title: 'Inspection summary',
      bodyLines: ['Line A', 'Line B'],
    })
    assertPdfMagic(buf)
    expect(buf.length).toBeGreaterThan(400)
  })

  it('embeds a PNG on a second page when embeddedImage is set', async () => {
    const withoutImage = await generateInspectionPdfBuffer({
      title: 'No image',
      bodyLines: ['Only text'],
    })
    const withImage = await generateInspectionPdfBuffer({
      title: 'With image',
      bodyLines: ['Body'],
      embeddedImage: { buffer: MINIMAL_PNG, maxWidth: 120 },
    })
    assertPdfMagic(withImage)
    expect(withImage.length).toBeGreaterThan(withoutImage.length)
    expect(countPageObjects(withImage)).toBeGreaterThanOrEqual(2)
  })

  it('produces a multi-page PDF for explicit page breaks', async () => {
    const buf = await generateTwoPageTextPdf()
    assertPdfMagic(buf)
    expect(countPageObjects(buf)).toBeGreaterThanOrEqual(2)
  })

  it('rejects when embedded image data is invalid', async () => {
    await expect(
      generateInspectionPdfBuffer({
        title: 'Bad image',
        bodyLines: ['x'],
        embeddedImage: { buffer: Buffer.from('not-a-real-image') },
      }),
    ).rejects.toThrow()
  })
})
