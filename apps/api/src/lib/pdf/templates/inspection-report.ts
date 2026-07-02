import { DEFAULT_INSPECTION_PDF_LAYOUT, type PdfKitDocument } from '../pdf-generator.js'

/** Branding and copy configurable per jurisdiction / deployment. */
export type InspectionReportTemplateOptions = {
  organizationName: string
  documentSubtitle: string
  accentColor: string
  bodyFont: string
}

export const DEFAULT_INSPECTION_REPORT_TEMPLATE_OPTIONS: InspectionReportTemplateOptions = {
  // Neutral placeholder for the deploying agency (the official inspecting authority).
  // Override per deployment; not the product brand.
  organizationName: 'Inspection Authority',
  documentSubtitle: 'Official Inspection Report',
  accentColor: '#1a365d',
  bodyFont: DEFAULT_INSPECTION_PDF_LAYOUT.bodyFont,
}

export type InspectionReportTemplateContext = {
  inspectorName: string
  designation: string | null
  permit: {
    permitNumber: string
    address: string
    scope: string
  } | null
  inspection: {
    reportId: string
    scheduledIso: string
    completedIso: string | null
    status: string
    notes: string | null
    outcomeLabel: string | null
    certificationSummary: string | null
  }
  checklistSummaryLines: string[]
  deficiencies: Array<{
    severity: string
    status: string
    description: string
    location: string | null
  }>
  documentHash: string
  qrPng: Buffer
}

function hr(doc: PdfKitDocument, color: string) {
  const { margins } = doc.page
  const y = doc.y
  doc
    .save()
    .strokeColor(color)
    .lineWidth(1)
    .moveTo(margins.left, y)
    .lineTo(doc.page.width - margins.right, y)
    .stroke()
  doc.restore()
  doc.moveDown(0.35)
}

/**
 * Main sections only (header through certification). Append photo pages, then
 * {@link renderInspectionReportIntegrityPage}.
 */
export function renderInspectionReportMainSections(
  doc: PdfKitDocument,
  ctx: InspectionReportTemplateContext,
  opts?: Partial<InspectionReportTemplateOptions>,
): void {
  const o = { ...DEFAULT_INSPECTION_REPORT_TEMPLATE_OPTIONS, ...opts }
  doc.font(o.bodyFont)

  doc
    .fontSize(10)
    .fillColor(o.accentColor)
    .text(o.organizationName.toUpperCase(), { align: 'center' })
  doc.fontSize(16).fillColor('#000000').text('Inspection Report', { align: 'center' })
  doc.fontSize(9).fillColor('#444444').text(o.documentSubtitle, { align: 'center' })
  doc.moveDown(0.85)
  hr(doc, o.accentColor)

  doc.fontSize(12).fillColor(o.accentColor).text('Inspector', { underline: true })
  doc.fontSize(10).fillColor('#000000')
  doc.text(`Name: ${ctx.inspectorName}`)
  if (ctx.designation) doc.text(`SCO designation / ID: ${ctx.designation}`)
  doc.moveDown(0.5)

  if (ctx.permit) {
    doc.fontSize(12).fillColor(o.accentColor).text('Permit information', { underline: true })
    doc.fontSize(10).fillColor('#000000')
    doc.text(`Permit number: ${ctx.permit.permitNumber}`)
    doc.text(`Site address: ${ctx.permit.address}`)
    doc.text(`Scope: ${ctx.permit.scope}`)
    doc.moveDown(0.5)
  }

  doc.fontSize(12).fillColor(o.accentColor).text('Inspection details', { underline: true })
  doc.fontSize(10).fillColor('#000000')
  doc.text(`Report / legal ID: ${ctx.inspection.reportId}`)
  doc.text(`Scheduled: ${ctx.inspection.scheduledIso}`)
  doc.text(`Completed: ${ctx.inspection.completedIso ?? '—'}`)
  doc.text(`Workflow status: ${ctx.inspection.status}`)
  if (ctx.inspection.outcomeLabel) {
    doc.text(`Outcome: ${ctx.inspection.outcomeLabel}`)
  }
  if (ctx.inspection.notes) {
    doc.moveDown(0.25)
    doc.text(`Inspector notes: ${ctx.inspection.notes}`)
  }
  doc.moveDown(0.5)

  doc.fontSize(12).fillColor(o.accentColor).text('Checklist summary', { underline: true })
  doc.fontSize(10).fillColor('#000000')
  if (ctx.checklistSummaryLines.length === 0) {
    doc.text('No checklist execution records are attached to this inspection.')
  } else {
    for (const line of ctx.checklistSummaryLines) {
      doc.text(line)
    }
  }
  doc.moveDown(0.5)

  doc.fontSize(12).fillColor(o.accentColor).text('Deficiencies', { underline: true })
  doc.fontSize(10).fillColor('#000000')
  if (ctx.deficiencies.length === 0) {
    doc.text('None recorded.')
  } else {
    for (const d of ctx.deficiencies) {
      doc.moveDown(0.3)
      doc.text(`• [${d.severity}] ${d.status} — ${d.description}`)
      if (d.location) doc.text(`  Location: ${d.location}`)
    }
  }

  if (ctx.inspection.certificationSummary) {
    doc.moveDown(0.55)
    doc
      .fontSize(12)
      .fillColor(o.accentColor)
      .text('Inspector certification snapshot', { underline: true })
    doc.fontSize(9).fillColor('#000000').text(ctx.inspection.certificationSummary, {
      align: 'left',
      paragraphGap: 2,
    })
  }
}

/** Hash + QR footer page — call after photo appendices. */
export function renderInspectionReportIntegrityPage(
  doc: PdfKitDocument,
  ctx: InspectionReportTemplateContext,
  opts?: Partial<InspectionReportTemplateOptions>,
): void {
  const o = { ...DEFAULT_INSPECTION_REPORT_TEMPLATE_OPTIONS, ...opts }
  doc.font(o.bodyFont)
  doc.addPage()
  doc.fontSize(12).fillColor(o.accentColor).text('Record integrity', { underline: true })
  doc.fontSize(9).fillColor('#000000')
  doc.text(`Report ID: ${ctx.inspection.reportId}`)
  doc.text(`Document hash (SHA-256): ${ctx.documentHash}`)
  doc.moveDown(0.45)
  doc.image(ctx.qrPng, { fit: [100, 100] })
  doc.moveDown(0.25)
  doc
    .fontSize(8)
    .fillColor('#444444')
    .text('Scan the QR code to verify this hash against the issued record.')
  doc.text('Generated by CodeComply in alignment with Alberta Safety Codes Act requirements.')
  doc.fillColor('#000000')
}

/** Full report without embedded photo appendix pages (use when no photos). */
export function renderInspectionReportTemplate(
  doc: PdfKitDocument,
  ctx: InspectionReportTemplateContext,
  opts?: Partial<InspectionReportTemplateOptions>,
): void {
  renderInspectionReportMainSections(doc, ctx, opts)
  renderInspectionReportIntegrityPage(doc, ctx, opts)
}

/** Full-page photo appendix used by inspection and deficiency flows. */
export function embedPhotoEvidencePages(
  doc: PdfKitDocument,
  title: string,
  buffers: Buffer[],
): void {
  if (buffers.length === 0) return
  doc.addPage()
  doc.fontSize(12).text(title, { underline: true })
  doc.moveDown(0.5)
  doc.fontSize(10)
  for (const buf of buffers) {
    doc.addPage()
    try {
      doc.image(buf, {
        fit: [
          doc.page.width - doc.page.margins.left - doc.page.margins.right,
          doc.page.height - doc.page.margins.top - doc.page.margins.bottom - 40,
        ],
        align: 'center',
      })
    } catch {
      doc.text('(Photo could not be rendered in this PDF viewer.)')
    }
  }
}
