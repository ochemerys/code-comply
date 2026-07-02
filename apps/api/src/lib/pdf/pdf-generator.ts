import PDFDocument from 'pdfkit'

/** PDFKit document instance used by report rendering. */
export type PdfKitDocument = InstanceType<typeof PDFDocument>

/** Letter size, 1" margins (72pt), Helvetica — aligns with M10 inspection report defaults. */
export const DEFAULT_INSPECTION_PDF_LAYOUT = {
  size: 'LETTER' as const,
  margin: 72,
  bodyFont: 'Helvetica' as const,
} as const

export type InspectionPdfContent = {
  title: string
  bodyLines: string[]
  /** When set, a second page is added with the image embedded (PNG or JPEG buffer). */
  embeddedImage?: { buffer: Buffer; maxWidth?: number }
}

/** Low-level helper for inspection/report PDFs (Letter, default margins, Helvetica). */
export function renderPdfBuffer(build: (doc: PdfKitDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const doc = new PDFDocument({
      size: DEFAULT_INSPECTION_PDF_LAYOUT.size,
      margin: DEFAULT_INSPECTION_PDF_LAYOUT.margin,
      autoFirstPage: true,
    })
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('error', reject)
    doc.on('end', () => resolve(Buffer.concat(chunks)))

    try {
      doc.font(DEFAULT_INSPECTION_PDF_LAYOUT.bodyFont)
      build(doc as PdfKitDocument)
      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * Generates inspection-report-style PDF bytes using PDFKit (no headless browser).
 * Suitable for Docker/CI and offline API workers.
 */
export async function generateInspectionPdfBuffer(content: InspectionPdfContent): Promise<Buffer> {
  return renderPdfBuffer((doc: PdfKitDocument) => {
    doc.fontSize(14).text(content.title, { align: 'center' })
    doc.moveDown(1.2)
    doc.fontSize(11)
    for (const line of content.bodyLines) {
      doc.text(line)
      doc.moveDown(0.35)
    }

    if (content.embeddedImage) {
      const maxW =
        content.embeddedImage.maxWidth ??
        doc.page.width - doc.page.margins.left - doc.page.margins.right
      doc.addPage()
      doc.font(DEFAULT_INSPECTION_PDF_LAYOUT.bodyFont).fontSize(11)
      doc.text('Embedded evidence', { underline: true })
      doc.moveDown(0.75)
      doc.image(content.embeddedImage.buffer, {
        fit: [maxW, doc.page.height - doc.page.margins.top - doc.page.margins.bottom - 48],
        align: 'center',
      })
    }
  })
}

/** Minimal two-page PDF to validate explicit page breaks (`addPage`). */
export async function generateTwoPageTextPdf(): Promise<Buffer> {
  return renderPdfBuffer((doc: PdfKitDocument) => {
    doc.fontSize(12).text('Page one body')
    doc.addPage()
    doc.text('Page two body')
  })
}
