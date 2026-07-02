/**
 * M10-S1: PDFKit smoke — validates PDF bytes without HTTP routes.
 */
import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import {
  generateInspectionPdfBuffer,
  generateTwoPageTextPdf,
} from '../../../../apps/api/src/lib/pdf/pdf-generator.js'

const MINIMAL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

let lastPdf: Buffer

When('PDFKit generates an inspection PDF from library code', async function () {
  const single = await generateInspectionPdfBuffer({
    title: 'E2E PDF smoke',
    bodyLines: ['Generated via PDFKit in Node'],
  })
  const multi = await generateTwoPageTextPdf()
  const withImage = await generateInspectionPdfBuffer({
    title: 'E2E with image',
    bodyLines: ['Evidence page follows'],
    embeddedImage: { buffer: MINIMAL_PNG },
  })
  expect(single.length).toBeGreaterThan(100)
  expect(multi.length).toBeGreaterThan(100)
  expect(withImage.length).toBeGreaterThan(single.length)
  lastPdf = withImage
})

Then('the PDF buffer should look valid', async function () {
  expect(lastPdf.subarray(0, 5).toString('utf8')).toBe('%PDF-')
  const tail = lastPdf.subarray(Math.max(0, lastPdf.length - 32)).toString('latin1')
  expect(tail).toMatch(/%%EOF/)
})
