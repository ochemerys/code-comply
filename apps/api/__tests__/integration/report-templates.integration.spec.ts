import { describe, it, expect } from 'vitest'
import QRCode from 'qrcode'
import { renderPdfBuffer } from '../../src/lib/pdf/pdf-generator.js'
import {
  renderInspectionReportMainSections,
  renderInspectionReportIntegrityPage,
} from '../../src/lib/pdf/templates/inspection-report.js'
import { renderNoEntryLetterTemplate } from '../../src/lib/pdf/templates/no-entry-letter.js'

describe('report templates integration', () => {
  it('produces multi-section PDF without external services', async () => {
    const qr = await QRCode.toBuffer('verify:int', { type: 'png', width: 64, margin: 0 })
    const ctx = {
      inspectorName: 'Integration User',
      designation: 'X',
      permit: { permitNumber: 'PX', address: 'Y', scope: 'Z' },
      inspection: {
        reportId: 'int-1',
        scheduledIso: new Date().toISOString(),
        completedIso: null,
        status: 'PASSED',
        notes: null,
        outcomeLabel: 'Passed',
        certificationSummary: null,
      },
      checklistSummaryLines: [],
      deficiencies: [],
      documentHash: 'ee'.repeat(32),
      qrPng: qr,
    }
    const pdf = await renderPdfBuffer((doc) => {
      renderInspectionReportMainSections(doc, ctx)
      renderInspectionReportIntegrityPage(doc, ctx)
    })
    expect(pdf.length).toBeGreaterThan(800)
    expect(pdf.subarray(0, 5).toString('utf8')).toBe('%PDF-')
  })

  it('renders no-entry letter end-to-end', async () => {
    const qr = await QRCode.toBuffer('n/a', { type: 'png', width: 64, margin: 0 })
    const pdf = await renderPdfBuffer((doc) => {
      renderNoEntryLetterTemplate(doc, {
        permitNumber: 'PN',
        siteAddress: 'SA',
        attemptDateIso: new Date().toISOString(),
        arrivalTimeDisplay: null,
        inspectorName: 'I',
        scoId: null,
        reasonLines: ['Locked gate'],
        notificationOrdinal: 2,
        priorNotificationSummary: 'First notice issued 2026-01-01',
        letterRecordId: 'L1',
        documentHash: 'ff'.repeat(32),
        qrPng: qr,
      })
    })
    expect(pdf.subarray(0, 5).toString('utf8')).toBe('%PDF-')
  })
})
