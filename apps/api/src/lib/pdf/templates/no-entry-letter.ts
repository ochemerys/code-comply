import { DEFAULT_INSPECTION_PDF_LAYOUT, type PdfKitDocument } from '../pdf-generator.js'

/**
 * Jurisdiction-specific fees, contact, and notice text (append-only configuration at deploy time).
 */
export type NoEntryLetterTemplateOptions = {
  organizationName: string
  bodyFont: string
  accentColor: string
  noEntryFeeDisplay: string
  organizationContact: string
  liabilityDisclaimer: string
}

export const DEFAULT_NO_ENTRY_LETTER_TEMPLATE_OPTIONS: NoEntryLetterTemplateOptions = {
  // Neutral placeholder for the deploying agency (the official inspecting authority).
  // Override per deployment; not the product brand.
  organizationName: 'Inspection Authority',
  bodyFont: DEFAULT_INSPECTION_PDF_LAYOUT.bodyFont,
  accentColor: '#9a3412',
  noEntryFeeDisplay: '$100.00',
  organizationContact: 'See municipal permitting portal or inspection scheduling desk.',
  liabilityDisclaimer:
    'The permit holder remains responsible for compliance with applicable safety codes. Schedule a new inspection once access can be arranged.',
}

export type NoEntryLetterTemplateContext = {
  permitNumber: string | null
  siteAddress: string | null
  attemptDateIso: string
  arrivalTimeDisplay: string | null
  inspectorName: string
  scoId: string | null
  /** Human-readable lines for “reason(s)” section (checkbox labels expanded). */
  reasonLines: string[]
  notificationOrdinal: 1 | 2 | 3
  priorNotificationSummary: string | null
  letterRecordId: string
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
 * Structured “Notice of unable to gain entry” aligned with jurisdictional no-entry letter sections.
 */
export function renderNoEntryLetterTemplate(
  doc: PdfKitDocument,
  ctx: NoEntryLetterTemplateContext,
  opts?: Partial<NoEntryLetterTemplateOptions>,
): void {
  const o = { ...DEFAULT_NO_ENTRY_LETTER_TEMPLATE_OPTIONS, ...opts }
  doc.font(o.bodyFont)

  doc
    .fontSize(10)
    .fillColor(o.accentColor)
    .text(o.organizationName.toUpperCase(), { align: 'center' })
  doc
    .fontSize(15)
    .fillColor('#000000')
    .text('NOTICE: UNABLE TO GAIN ENTRY / NO ACCESS', { align: 'center' })
  doc.fontSize(9).fillColor('#444444').text('Notification of failed access', {
    align: 'center',
  })
  doc.moveDown(0.9)
  hr(doc, o.accentColor)

  doc.fontSize(11).fillColor(o.accentColor).text('Part 1 — Inspection details', { underline: true })
  doc.fontSize(10).fillColor('#000000')
  doc.text(`Permit number: ${ctx.permitNumber ?? '—'}`)
  doc.text(`Attempt date: ${ctx.attemptDateIso}`)
  doc.text(`Arrival time: ${ctx.arrivalTimeDisplay ?? '—'}`)
  doc.text(`Site address: ${ctx.siteAddress ?? '—'}`)
  doc.moveDown(0.35)
  doc.text(`Inspector: ${ctx.inspectorName}`)
  doc.text(`SCO ID: ${ctx.scoId ?? '—'}`)
  doc.moveDown(0.55)

  doc
    .fontSize(11)
    .fillColor(o.accentColor)
    .text('Part 2 — Reason for no entry', { underline: true })
  doc.fontSize(10).fillColor('#000000')
  doc.text(
    'An attempt was made to conduct a scheduled inspection, but entry could not be obtained for the following reason(s):',
    { align: 'justify' },
  )
  doc.moveDown(0.35)
  if (ctx.reasonLines.length === 0) {
    doc.text('• Other / not specified — see agency records.')
  } else {
    for (const line of ctx.reasonLines) {
      doc.text(`• ${line}`)
    }
  }
  doc.moveDown(0.55)

  doc
    .fontSize(11)
    .fillColor(o.accentColor)
    .text('Part 3 — Notification history', { underline: true })
  doc.fontSize(10).fillColor('#000000')
  const ordLabel =
    ctx.notificationOrdinal === 1
      ? '1st notification'
      : ctx.notificationOrdinal === 2
        ? '2nd notification'
        : '3rd or subsequent notification'
  doc.text(`This notice represents the ${ordLabel}.`)
  if (ctx.priorNotificationSummary) {
    doc.moveDown(0.25)
    doc.text(ctx.priorNotificationSummary)
  }
  doc.moveDown(0.55)

  doc
    .fontSize(11)
    .fillColor(o.accentColor)
    .text('Part 4 — Required action & fees', { underline: true })
  doc.fontSize(10).fillColor('#000000')
  doc.text(
    `1. Re-inspection / no-entry fee (if applicable): ${o.noEntryFeeDisplay} — confirm with local bylaws.`,
    { align: 'justify' },
  )
  doc.text(`2. Reschedule: ${o.organizationContact}`, { align: 'justify' })
  doc.text(`3. ${o.liabilityDisclaimer}`, { align: 'justify' })
  doc.moveDown(0.55)

  doc.fontSize(11).fillColor(o.accentColor).text('Part 5 — Official record', { underline: true })
  doc.fontSize(9).fillColor('#000000')
  doc.text(`Letter record ID: ${ctx.letterRecordId}`)
  doc.text(`Document hash (SHA-256): ${ctx.documentHash}`)
  doc.moveDown(0.45)
  doc.image(ctx.qrPng, { fit: [88, 88] })
  doc.moveDown(0.35)
  doc
    .fontSize(8)
    .fillColor('#444444')
    .text('Digital verification QR — integrity hash embedded above.')
  doc.text('Generated by CodeComply in alignment with Alberta Safety Codes Act requirements.')
  doc.fillColor('#000000')
}
