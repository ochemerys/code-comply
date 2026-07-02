import { describe, it, expect } from 'vitest'
import QRCode from 'qrcode'
import { renderPdfBuffer } from '../pdf-generator.js'
import { renderDeficiencyReportTemplate } from './deficiency-report.js'
import {
  embedPhotoEvidencePages,
  renderInspectionReportIntegrityPage,
  renderInspectionReportMainSections,
  renderInspectionReportTemplate,
} from './inspection-report.js'
import { renderNoEntryLetterTemplate } from './no-entry-letter.js'

const MINIMAL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

async function tinyQr(): Promise<Buffer> {
  return QRCode.toBuffer('verify:test', { type: 'png', width: 80, margin: 0 })
}

describe('PDF templates', () => {
  it('renders inspection main + integrity as valid PDF', async () => {
    const qr = await tinyQr()
    const ctx = {
      inspectorName: 'Pat Example',
      designation: 'SCO-9',
      permit: { permitNumber: 'P1', address: '1 Elm St', scope: 'New build' },
      inspection: {
        reportId: 'rep-1',
        scheduledIso: new Date().toISOString(),
        completedIso: null,
        status: 'IN_PROGRESS',
        notes: null,
        outcomeLabel: null,
        certificationSummary: null,
      },
      checklistSummaryLines: ['• Electrical checklist — 40% — in progress'],
      deficiencies: [
        { severity: 'MINOR', status: 'OPEN', description: 'Gap', location: 'North wall' },
      ],
      documentHash: 'aa'.repeat(32),
      qrPng: qr,
    }

    const pdf = await renderPdfBuffer((doc) => {
      renderInspectionReportMainSections(doc, ctx)
      embedPhotoEvidencePages(doc, 'Photos', [MINIMAL_PNG])
      renderInspectionReportIntegrityPage(doc, ctx)
    })
    expect(pdf.subarray(0, 5).toString('utf8')).toBe('%PDF-')
  })

  it('renders single-call inspection template', async () => {
    const qr = await tinyQr()
    const ctx = {
      inspectorName: 'Pat',
      designation: null,
      permit: null,
      inspection: {
        reportId: 'r',
        scheduledIso: new Date().toISOString(),
        completedIso: null,
        status: 'SCHEDULED',
        notes: null,
        outcomeLabel: null,
        certificationSummary: null,
      },
      checklistSummaryLines: [],
      deficiencies: [],
      documentHash: 'bb'.repeat(32),
      qrPng: qr,
    }
    const pdf = await renderPdfBuffer((doc) => {
      renderInspectionReportTemplate(doc, ctx)
    })
    expect(pdf.subarray(0, 5).toString('utf8')).toBe('%PDF-')
  })

  it('renders deficiency template', async () => {
    const qr = await tinyQr()
    const pdf = await renderPdfBuffer((doc) => {
      renderDeficiencyReportTemplate(doc, {
        deficiencyId: 'def-1',
        recordedBy: 'Sam',
        severity: 'MAJOR',
        status: 'OPEN',
        description: 'Missing rail',
        location: 'Stair',
        permitLine: 'P-2 — 9 Oak Ave',
        documentHash: 'cc'.repeat(32),
        qrPng: qr,
        evidencePhotoBuffers: [],
      })
    })
    expect(pdf.subarray(0, 5).toString('utf8')).toBe('%PDF-')
  })

  it('renders no-entry letter template', async () => {
    const qr = await tinyQr()
    const pdf = await renderPdfBuffer((doc) => {
      renderNoEntryLetterTemplate(doc, {
        permitNumber: 'P-3',
        siteAddress: '55 Pine Rd',
        attemptDateIso: new Date().toISOString(),
        arrivalTimeDisplay: '09:15',
        inspectorName: 'Jamie',
        scoId: 'SCO-7',
        reasonLines: ['No adult present on site'],
        notificationOrdinal: 1,
        priorNotificationSummary: null,
        letterRecordId: 'letter-1',
        documentHash: 'dd'.repeat(32),
        qrPng: qr,
      })
    })
    expect(pdf.subarray(0, 5).toString('utf8')).toBe('%PDF-')
  })
})
