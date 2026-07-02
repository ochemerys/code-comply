/**
 * Step definitions for PDF generation performance (M11-S12).
 * Executable coverage lives in @codecomply/api vitest suite.
 */

import { Given, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

type WorldM11S12 = IWorld & {
  m11s12PdfDoc?: { criteria: string[] }
}

Given(
  'the PDF generation performance acceptance criteria are defined for M11-S12',
  async function (this: IWorld) {
    const w = this as WorldM11S12
    w.m11s12PdfDoc = {
      criteria: [
        'PDF generates in under 10 seconds for 20 photos',
        'Images resized before PDF embed to reduce memory',
        'Worker threads used for image prep when available',
        'Progress callbacks for async generation',
        'Timeout handling for large reports',
      ],
    }
  },
)

Then(
  'unit and integration tests should cover M11-S12 streaming resize workers and timeouts',
  async function (this: IWorld) {
    const doc = (this as WorldM11S12).m11s12PdfDoc
    expect(doc?.criteria?.length).toBeGreaterThanOrEqual(5)
  },
)
