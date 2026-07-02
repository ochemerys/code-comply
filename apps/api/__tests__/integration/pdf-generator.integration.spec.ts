import { describe, it, expect } from 'vitest'
import {
  generateInspectionPdfBuffer,
  generateTwoPageTextPdf,
} from '../../src/lib/pdf/pdf-generator.js'

describe('PDF generation (integration)', () => {
  it('generates valid PDF bytes in Node without external services', async () => {
    const buf = await generateInspectionPdfBuffer({
      title: 'Integration smoke',
      bodyLines: ['Docker-friendly PDFKit path'],
    })
    expect(buf.subarray(0, 5).toString('utf8')).toBe('%PDF-')
    expect(buf.length).toBeGreaterThan(200)
  })

  it('supports multi-page output', async () => {
    const buf = await generateTwoPageTextPdf()
    const pages = (buf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length
    expect(pages).toBeGreaterThanOrEqual(2)
  })
})
