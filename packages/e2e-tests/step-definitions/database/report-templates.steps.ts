/**
 * M10-S3 — Template smoke via pdf-generator + template modules.
 */
import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { renderPdfBuffer } from '../../../../apps/api/src/lib/pdf/pdf-generator.js'
import { renderDeficiencyReportTemplate } from '../../../../apps/api/src/lib/pdf/templates/deficiency-report.js'
import { renderInspectionReportTemplate } from '../../../../apps/api/src/lib/pdf/templates/inspection-report.js'
import { renderNoEntryLetterTemplate } from '../../../../apps/api/src/lib/pdf/templates/no-entry-letter.js'

let buffers: Buffer[] = []

/** 1×1 transparent PNG stand-in for QR (valid for PDFKit). */
const qrPlaceholder = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

When('report PDF templates are rendered for M10-S3', async function () {
  const qr = qrPlaceholder
  const inspectionCtx = {
    inspectorName: 'E2E',
    designation: null,
    permit: { permitNumber: 'EP', address: 'A', scope: 'S' },
    inspection: {
      reportId: 'e2e-r',
      scheduledIso: new Date().toISOString(),
      completedIso: null,
      status: 'SCHEDULED',
      notes: null,
      outcomeLabel: null,
      certificationSummary: null,
    },
    checklistSummaryLines: ['• Smoke checklist'],
    deficiencies: [],
    documentHash: '11'.repeat(32),
    qrPng: qr,
  }
  const inspPdf = await renderPdfBuffer((doc) => {
    renderInspectionReportTemplate(doc, inspectionCtx)
  })
  const defPdf = await renderPdfBuffer((doc) => {
    renderDeficiencyReportTemplate(doc, {
      deficiencyId: 'd-e2e',
      recordedBy: 'E2E',
      severity: 'MINOR',
      status: 'OPEN',
      description: 'Desc',
      location: null,
      permitLine: null,
      documentHash: '22'.repeat(32),
      qrPng: qr,
      evidencePhotoBuffers: [],
    })
  })
  const letterPdf = await renderPdfBuffer((doc) => {
    renderNoEntryLetterTemplate(doc, {
      permitNumber: 'P',
      siteAddress: 'X',
      attemptDateIso: new Date().toISOString(),
      arrivalTimeDisplay: null,
      inspectorName: 'E2E',
      scoId: null,
      reasonLines: ['Other'],
      notificationOrdinal: 1,
      priorNotificationSummary: null,
      letterRecordId: 'L',
      documentHash: '33'.repeat(32),
      qrPng: qr,
    })
  })
  buffers = [inspPdf, defPdf, letterPdf]
})

Then('each output should be a valid PDF', async function () {
  expect(buffers.length).toBe(3)
  for (const b of buffers) {
    expect(b.subarray(0, 5).toString('utf8')).toBe('%PDF-')
  }
})
